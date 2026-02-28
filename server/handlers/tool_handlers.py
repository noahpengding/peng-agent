from utils.mysql_connect import MysqlConnect
from utils.minio_connection import MinioStorage
from utils.log import output_log
from config.config import config
from io import BytesIO
import pandas as pd


def get_all_tools():
    mysql = MysqlConnect()
    tools = mysql.read_records("tools")
    mysql.close()
    return tools if tools else []


def get_tool_by_name(tool_name: str):
    mysql = MysqlConnect()
    tool = mysql.read_records("tools", {"name": tool_name})
    mysql.close()
    return tool[0] if tool else None


def update_tools():
    minio = MinioStorage()
    tool_data = minio.file_download_to_memory(f"{config.s3_base_path}/tools.xlsx")
    if tool_data is None:
        output_log("No tool data found in S3 to update tools.", "warning")
        return
    tools = pd.read_excel(BytesIO(tool_data))
    tools = tools.fillna("")
    mysql = MysqlConnect()
    mysql.delete_record("tools", None)
    for index, row in tools.iterrows():
        tool_data = {
            "name": row["name"],
            "type": row["type"],
            "url": row["url"],
        }
        try:
            mysql.create_record("tools", tool_data)
        except Exception as e:
            output_log(f"Error updating tool {tool_data['name']}: {e}", "error")
    mysql.close()
