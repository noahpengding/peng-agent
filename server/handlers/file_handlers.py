from utils.minio_connection import MinioStorage
from pdf2image import convert_from_path
from config.config import config
from io import BytesIO
import base64
import datetime
import mimetypes
import os
import re


def file_uploader(file_content: str, content_type: str, upload_file_path: str, user_name: str = "default"):
    m = MinioStorage(user_name=user_name)
    bucket_name = config.s3_bucket
    if len(upload_file_path.split("://")) > 1:
        bucket_name = upload_file_path.split("://")[0]
        upload_file_path = upload_file_path.split("://")[1]
    if not m.file_upload_from_string(
        file_content,
        upload_file_path,
        content_type,
        bucket_name,
    ):
        return ["", False]
    return [f"{bucket_name}://{upload_file_path}", True]


def file_upload_frontend(file_content: str, content_type: str, user_name: str = "default"):
    return file_upload_frontend_with_name(file_content, content_type, None, user_name)


def _safe_file_name(file_name: str) -> str:
    base_name = os.path.basename((file_name or "").strip())
    if not base_name:
        return ""
    return base_name.replace("\x00", "")


def _extension_from_content_type(content_type: str) -> str:
    guessed_extension = mimetypes.guess_extension(content_type or "")
    if guessed_extension:
        return guessed_extension.lstrip(".")
    if "/" in content_type:
        return content_type.split("/")[-1].split("+")[0]
    return "bin"


def file_upload_frontend_with_name(
    file_content: str,
    content_type: str,
    file_name: str = None,
    user_name: str = "default",
):
    if not file_content or not content_type:
        return ["Invalid upload payload", False]

    payload = file_content.strip()
    data_url_match = re.match(r"^data:([^;]+);base64,(.+)$", payload, re.DOTALL)
    if data_url_match:
        content_type = data_url_match.group(1).strip()
        payload = data_url_match.group(2).strip()

    padded_content = payload + ("=" * (-len(payload) % 4))
    try:
        decoded_content = base64.b64decode(padded_content)
    except Exception:
        return ["Invalid base64 file content", False]

    timestamp = int(datetime.datetime.now().timestamp() * 1000)
    date_prefix = datetime.datetime.now().strftime("%Y/%m/%d")
    safe_file_name = _safe_file_name(file_name or "")
    extension = _extension_from_content_type(content_type)

    if content_type == "application/pdf":
        pdf_name = safe_file_name or f"temp_{timestamp}.pdf"
        if not pdf_name.lower().endswith(".pdf"):
            pdf_name = f"{pdf_name}.pdf"
        upload_path = f"{config.s3_base_path}/{user_name}/uploads/{date_prefix}/{pdf_name}" if user_name else f"{config.s3_base_path}/uploads/{date_prefix}/{pdf_name}"
    else:
        upload_path = f"{config.s3_base_path}/{user_name}/uploads/{date_prefix}/temp_{timestamp}.{extension}" if user_name else f"{config.s3_base_path}/uploads/{date_prefix}/temp_{timestamp}.{extension}"

    return file_uploader(decoded_content, content_type, upload_path, user_name=user_name)


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
