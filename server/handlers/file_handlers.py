from utils.minio_connection import MinioStorage
from pdf2image import convert_from_path
from config.config import config
import base64
from io import BytesIO


def file_downloader(message_file_path: str):
    m = MinioStorage()
    bucket_name = config.s3_bucket
    if len(message_file_path.split("://")) > 1:
        bucket_name = message_file_path.split("://")[0]
        message_file_path = message_file_path.split("://")[1]
    if not m.file_exists(message_file_path, bucket_name):
        return [
            f"File {message_file_path} does not exist in bucket {bucket_name}",
            False,
        ]
    download_path = f"tmp/{message_file_path}"
    if not m.file_download(message_file_path, download_path, bucket_name):
        return [
            f"Error downloading file {message_file_path} from bucket {bucket_name}",
            False,
        ]
    return [download_path, True]


def file_operator(local_file_path: str):
    with open(local_file_path, "r") as file:
        return file.read()


def file_operator_image(local_file_path: str):
    if local_file_path.endswith(".pdf"):
        images = convert_from_path(local_file_path, dpi=300)
        base64_images = []
        for img in images:
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            buffer.seek(0)
            base64_images.append(base64.b64encode(buffer.read()).decode("utf-8"))
        return base64_images
    with open(local_file_path, "rb") as f:
        try:
            return [base64.b64encode(f.read()).decode("utf-8")]
        except Exception as e:
            return [f"Error reading file {local_file_path}: {str(e)}"]
        finally:
            f.close()


def file_extention(local_file_path: str) -> bool:
    if local_file_path.endswith(".pdf"):
        return False
    if (
        local_file_path.endswith(".png")
        or local_file_path.endswith(".jpg")
        or local_file_path.endswith(".jpeg")
    ):
        return False
    return True
