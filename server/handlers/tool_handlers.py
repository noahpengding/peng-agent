from utils.mysql_connect import MysqlConnect
from utils.minio_connection import MinioStorage
from utils.log import output_log
from config.config import config
from services.redis_service import (
    create_table_record,
    get_table_record,
    get_table_records,
    refresh_table_cache,
)


def get_all_tools():
    tools = get_table_records("tools")
    return tools if tools else []


def get_tool_by_name(tool_name: str):
    return get_table_record("tools", tool_name)


def update_tools():
    minio = MinioStorage()
    minio.file_download(f"{config.s3_base_path}/tools.xlsx", "tools.xlsx")
    import pandas as pd

    tools = pd.read_excel("tools.xlsx")
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
            create_table_record("tools", tool_data, redis_id="name")
        except Exception as e:
            output_log(f"Error updating tool {tool_data['name']}: {e}", "error")
    mysql.close()
    refresh_table_cache("tools")
