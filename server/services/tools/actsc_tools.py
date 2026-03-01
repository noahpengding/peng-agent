from langchain_core.tools import StructuredTool
from utils.minio_connection import MinioStorage
import tempfile
from math import *
import pandas as pd

def actsc_life_table(from_x: int, to_x: int, interest=0.05, A=0.00022, B=0.0000027, c=1.124):
    def p_x(x):
        return exp(-A) * exp(- (B * c ** x)/log(c) * (c - 1))
    from_x = max(20, from_x)
    to_x = min(110, to_x)
    if from_x > to_x:
        temp = from_x
        from_x = to_x
        to_x = temp
    
    ages = range(20, 111)
    p_vals = [p_x(x) for x in ages]
    q_vals = [1 - p for p in p_vals]
    l_x = [100000]
    for p in p_vals[:-1]:
        l_x.append(max(l_x[-1] * p, 0))
    d_x = [prev - curr for prev, curr in zip(l_x, l_x[1:])] + [l_x[-1]]
    a_due_x = [
        sum(l / l_x[x - 20] * (1 + interest) ** (-t) for t, l in enumerate(l_x[x - 20:91]))
        for x in ages
    ]
    A_x = [
        sum(d / l_x[x - 20] * (1 + interest) ** (-t - 1) for t, d in enumerate(d_x[x - 20:91]))
        for x in ages
    ]
    return pd.DataFrame({
        'x': ages,
        'p_x': p_vals,
        'q_x': q_vals,
        'l_x': l_x,
        'a_due_x': a_due_x,
        'A_x': A_x
    }).loc[lambda d: (d['x'] >= from_x) & (d['x'] <= to_x)].to_string(index=False)

def actsc_service_table(from_x: int, to_x: int):
    from_x = max(20, from_x)
    to_x = min(65, to_x)
    minio = MinioStorage()
    with tempfile.NamedTemporaryFile() as temp_file:
        minio.file_download('peng://Actuarial/ExamALTAM/altam_tables.xlsx', temp_file.name)
        df = pd.read_excel(temp_file.name, sheet_name='Service Table', header=0, skiprows=4)
    return df.loc[lambda d: (d['x'] >= from_x) & (d['x'] <= to_x)].to_string(index=False)

def actsc_standard_mortality_table(from_x: int, to_x: int):
    from_x = max(20, from_x)
    to_x = min(100, to_x)
    minio = MinioStorage()
    with tempfile.NamedTemporaryFile() as temp_file:
        minio.file_download('peng://Actuarial/ExamALTAM/altam_tables.xlsx', temp_file.name)
        df_single = pd.read_excel(temp_file.name, sheet_name='Single Life', header=0, skiprows=2)
        df_joint = pd.read_excel(temp_file.name, sheet_name='Joint Life', header=0, skiprows=2)
    df = pd.merge(df_single, df_joint, on='x', how='left')
    df = df.rename(columns={"Unnamed: 6": "äx_10", "Unnamed: 7": "Ax_10", "Unnamed: 8_x": "äx_20", "Unnamed: 9": "Ax_20", "Unnamed: 4": "äxx_10"})
    df = df.drop(columns=['Unnamed: 13', 'Unnamed: 14', 'Unnamed: 8_y'])
    return df.loc[lambda d: (d['x'] >= from_x) & (d['x'] <= to_x)].to_string(index=False)

actsc_life_table_tool = StructuredTool.from_function(
    func=actsc_life_table,
    name="actsc_life_table",
    description="Returns a life table for ages between from_x and to_x, inclusive. The table includes columns for age (x), probability of survival (p_x), probability of death (q_x), number of survivors (l_x), present value of annuity due (a_due_x), and present value of whole life insurance (A_x). You can specify the interest rate, and parameters A, B, and c for the Gompertz–Makeham Mortality Model (exp(-A-Bc^x/ln(c)*(c-1))). Use this tool when you have a question for specific interest rates and custom survival model parameters.",
    args_schema={
        "type": "object",
        "properties": {
            "from_x": {"type": "integer", "description": "The starting age for the life table (must be between 20 and 110)."},
            "to_x": {"type": "integer", "description": "The ending age for the life table (must be between 20 and 110)."},
            "interest": {"type": "number", "description": "The interest rate to use for present value calculations (default is 0.05)."},
            "A": {"type": "number", "description": "The first params in Gompertz–Makeham Mortality Model (default is 0.00022)"},
            "B": {"type": "number", "description": "The second params in Gompertz–Makeham Mortality Model (default is 0.0000027)"},
            "c": {"type": "number", "description": "The third params in Gompertz–Makeham Mortality Model (default is 1.124)"},
        },
        "required": ["from_x", "to_x"],
    },
    return_direct=False,
)

actsc_service_table_tool = StructuredTool.from_function(
    func=actsc_service_table,
    name="actsc_service_table",
    description="Returns a service table for ages between from_x and to_x, inclusive. The table includes columns for age (x), number of survivors (lx), number of withdrawals (dx), number of disability (ix), numerber of retirement (rx), and number of death (mx). Use this tool when you have a question about the service table or retirement pension plans.",
    args_schema={
        "type": "object",
        "properties": {
            "from_x": {"type": "integer", "description": "The starting age for the service table (must be between 20 and 65)."},
            "to_x": {"type": "integer", "description": "The ending age for the service table (must be between 20 and 65)."},
        },
        "required": ["from_x", "to_x"],
    },
    return_direct=False,
)

actsc_standard_mortality_table_tool = StructuredTool.from_function(
    func=actsc_standard_mortality_table,
    name="actsc_standard_mortality_table",
    description="Returns a standard ultimate life table (i=5%) for ages between from_x and to_x inclusive for both single life and joint life including number of survivors, present value of annuity due, and present value of whole life insurance. Use this tool when you have a question about the standard ultimate life table (SULT) or any other cases with specific mortality models or interest rates.",
    args_schema={
        "type": "object",
        "properties": {
            "from_x": {"type": "integer", "description": "The starting age for the mortality table (must be between 20 and 100)."},
            "to_x": {"type": "integer", "description": "The ending age for the mortality table (must be between 20 and 100)."},
        },
        "required": ["from_x", "to_x"],
    },
    return_direct=False,
)

actuarial_tools = [actsc_life_table_tool, actsc_service_table_tool, actsc_standard_mortality_table_tool]
