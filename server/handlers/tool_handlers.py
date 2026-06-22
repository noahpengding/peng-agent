from utils.minio_connection import MinioStorage
from utils.log import output_log
from config.config import config
from utils.redis import redis_cache
from io import BytesIO
import pandas as pd


def get_all_tools():
    tools = redis_cache.get_records("tools")
    return sorted(tools, key=lambda x: x["id"]) if tools else []


def get_tool_by_name(tool_name: str):
    return redis_cache.get_record("tools", tool_name)


def update_tools():
    minio = MinioStorage()
    tool_data = minio.file_download_to_memory(f"{config.s3_base_path}/tools.xlsx")
    if tool_data is None:
        output_log("No tool data found in S3 to update tools.", "warning")
        return
    
    tools_df = pd.read_excel(BytesIO(tool_data))
    tools_df = tools_df.fillna("")
    
    # Clear existing tools in Redis
    redis_cache.clear_table("tools")
    
    for index, row in tools_df.iterrows():
        tool_record = row.to_dict()
        if "name" not in tool_record:
            output_log(f"Tool record at index {index} is missing 'name' field. Skipping.", "warning")
            continue
        
        redis_cache.save_record("tools", tool_record, id="name")
    
    output_log("Successfully reloaded tools from S3 to Redis.", "info")
