from utils.mysql_connect import MysqlConnect
from utils.minio_connection import MinioStorage
from utils.log import output_log


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
    minio.file_download("peng-bot/peng-agent/tools.xlsx", "tools.xlsx")
    import pandas as pd

    tools = pd.read_excel("tools.xlsx")
    tools = tools.fillna("")
    mysql = MysqlConnect()
    for index, row in tools.iterrows():
        tool_data = {
            "name": row["name"],
            "type": row["type"],
            "url": row["url"],
        }
        try:
            mysql.delete_record("tools", {"name": tool_data["name"]})
            mysql.create_record("tools", tool_data)
        except Exception as e:
            output_log(f"Error updating tool {tool_data['name']}: {e}", "error")
    mysql.close()
