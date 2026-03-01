from utils.minio_connection import MinioStorage
from utils.log import output_log
from config.config import config
from services.redis_service import (
    create_table_record,
    get_table_record,
    get_table_records,
    delete_table_record
)
from io import BytesIO
import pandas as pd


def get_all_tools():
    tools = get_table_records("tools")
    return tools if tools else []


def get_tool_by_name(tool_name: str):
    return get_table_record("tools", tool_name)


def update_tools():
    minio = MinioStorage()
    tool_data = minio.file_download_to_memory(f"{config.s3_base_path}/tools.xlsx")
    if tool_data is None:
        output_log("No tool data found in S3 to update tools.", "warning")
        return
    tools = pd.read_excel(BytesIO(tool_data))
    tools = tools.fillna("")
    delete_table_record("tools", "*")
    for index, row in tools.iterrows():
        tool_data = {
            "name": row["name"],
            "type": row["type"],
            "url": row["url"],
        }
        create_table_record("tools", tool_data, redis_id="name")
