import os
import sys

if __name__ == "__main__":
    dotenv_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "../../test/.env"
    )
    with open(dotenv_path, "r") as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                key, value = line.strip().split("=", 1)
                os.environ[key] = value

    SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
    sys.path.append(os.path.dirname(SCRIPT_DIR + "../"))
    from utils.minio_connection import MinioStorage
    from config.config import config

    image_name = "20260621011748.png"
    m = MinioStorage()
    upload = m.file_upload(f"../{image_name}", f"generated_images/{image_name}", "image/png", bucket_name=config.s3_public_bucket)
    if upload:
        image_url = f"{config.webdav_public_url}/generated_images/{image_name}"
        print(image_url)
    else:
        print("Upload failed.")