from langchain_core.tools import StructuredTool
from utils.minio_connection import MinioStorage
from config.config import config


def minio_file_upload_tool(file_content: str, file_name: str, content_type: str) -> str:
    minio_storage = MinioStorage()
    import io

    file_content_encoded = io.BytesIO(file_content.encode("utf-8"))
    if "/" not in file_name and "\\" not in file_name:
        file_name = config.s3_base_path + "/" + file_name

    success = minio_storage.file_upload_from_string(
        file_content=file_content_encoded,
        file_name=file_name,
        file_length=len(file_content),
        content_type=content_type,
    )
    if success:
        return f"File '{file_name}' uploaded successfully to Minio."
    return f"Failed to upload file '{file_name}' to Minio."


def minio_file_download_tool(file_name: str) -> str:
    minio_storage = MinioStorage()
    file_content = minio_storage.file_download_to_memory(file_name=file_name)
    if file_content is not None:
        try:
            return file_content.decode("utf-8")
        except UnicodeDecodeError:
            return f"Error: File '{file_name}' content is not valid UTF-8 text."
    return f"Failed to download file '{file_name}' from Minio."


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
