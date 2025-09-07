from langchain_core.tools import StructuredTool
from utils.minio_connection import MinioStorage
import os


def minio_file_upload_tool(file_content: str, file_name: str, content_type: str) -> str:
    minio_storage = MinioStorage()
    import io

    file_content_encoded = io.BytesIO(file_content.encode("utf-8"))
    success = minio_storage.file_upload_from_string(
        file_content=file_content_encoded,
        file_name=file_name,
        file_length=len(file_content),
        content_type=content_type,
    )
    if success:
        return f"File '{file_name}' uploaded successfully to Minio."
    else:
        return f"Failed to upload file '{file_name}' to Minio."    

def minio_file_download_tool(file_name: str) -> str:
    minio_storage = MinioStorage()
    file_content = minio_storage.file_download_to_string(file_name=file_name, download_path=f"/tmp/{file_name.split('/')[-1]}")
    file_content = ""
    with open(f"/tmp/{file_name.split('/')[-1]}", "r", encoding="utf-8") as f:
        file_content = f.read()
    os.remove(f"/tmp/{file_name.split('/')[-1]}")
    return file_content


minio_tool = [
    StructuredTool.from_function(
        func=minio_file_upload_tool,
        name="minio_file_upload_tool",
        description="Upload data and file content to Minio S3 storage.",
        args_schema={
            "type": "object",
            "properties": {
                "file_content": {
                    "type": "string",
                    "description": "The content of the file to be uploaded.",
                },
                "file_name": {
                    "type": "string",
                    "description": "The name of the file and the path to be saved in Minio.",
                },
                "content_type": {
                    "type": "string",
                    "description": "The content type of the file (e.g., application/json, image/jpeg).",
                },
            },
            "required": ["file_content", "file_name", "content_type"],
        },
        return_direct=True,
    ),
    StructuredTool.from_function(
        func=minio_file_download_tool,
        name="minio_file_download_tool",
        description="Read data and file content from Minio S3 storage.",
        args_schema={
            "type": "object",
            "properties": {
                "file_name": {
                    "type": "string",
                    "description": "The name of the file and the path to be downloaded from Minio.",
                },
            },
            "required": ["file_name"],
        },
        return_direct=True,
    ),
]

