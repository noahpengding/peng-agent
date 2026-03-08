import boto3
from botocore.exceptions import ClientError
from config.config import config
from utils.log import output_log
import os
import threading


_clients = {}
_lock = threading.RLock()


def _get_user_s3_credentials(user_name: str):
    try:
        # Lazy import avoids circular import issues at module load time.
        from services.redis_service import get_table_record

        user = get_table_record("user", user_name)
        if not user:
            return None, None
        access_key = (user.get("s3_access_key") or "").strip()
        secret_key = (user.get("s3_secret_key") or "").strip()
        return access_key, secret_key
    except Exception as e:
        output_log(f"Error loading user S3 credentials for {user_name}: {e}", "error")
        return None, None


class MinioStorage:
    def __init__(self, user_name: str = "default"):
        self.entrypoint = config.s3_url
        self.access_key = config.s3_access_key
        self.secret_key = config.s3_secret_key
        self.region = config.s3_region
        self.user_name = user_name or "default"
        self.client = None

        cache_key = (self.user_name, self.access_key, self.secret_key)

        global _clients
        if cache_key in _clients.keys():
            self.client = _clients[cache_key]
        if self.user_name != "default" and self.client is None:
            user_access_key, user_secret_key = _get_user_s3_credentials(self.user_name)
            if user_access_key and user_secret_key:
                self.access_key = user_access_key
                self.secret_key = user_secret_key

        if cache_key not in _clients:
            with _lock:
                    output_log(
                        f"S3 connection to {self.entrypoint}",
                        "debug",
                    )
                    _clients[cache_key] = boto3.client(
                        's3',
                        endpoint_url=self.entrypoint,
                        aws_access_key_id=self.access_key,
                        aws_secret_access_key=self.secret_key,
                        region_name=self.region,
                    )
            self.client = _clients[cache_key]


    # @file_path: Local file path
    # @file_name: File name to be saved in S3
    # @content_type: Content type of the file:
    #   - application/json
    #   - application/pdf
    #   - image/jpeg
    #   - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    def file_upload(
        self, file_path, file_name, content_type, bucket_name=config.s3_bucket
    ):
        try:
            file_name = file_name.replace("\\", "/").replace("//", "/")
            self.client.upload_file(
                file_path, bucket_name, file_name,
                ExtraArgs={'ContentType': content_type}
            )
            os.remove(file_path)
        except ClientError as e:
            output_log(f"Error uploading file to S3: {e}", "error")
            return False
        except Exception as e:
            output_log(f"Error uploading file to S3: {e}", "error")
            return False
        return True

    def file_upload_from_string(
        self,
        file_content,
        file_name,
        content_type,
        bucket_name=config.s3_bucket,
    ):
        try:
            file_name = file_name.replace("\\", "/").replace("//", "/")
            output_log(f"Uploading file to S3: {file_name} with content type {content_type}", "debug")
            self.client.put_object(
                Bucket=bucket_name,
                Key=file_name,
                Body=file_content,
                ContentType=content_type,
            )
        except Exception as e:
            output_log(f"Error uploading file to S3: {e}", "error")
            return False
        return True

    def file_download(self, file_name, download_path, bucket_name=config.s3_bucket):
        try:
            if len(file_name.split("://")) > 1:
                bucket_name = file_name.split("://")[0]
                file_name = file_name.split("://")[1]
            file_name = file_name.replace("\\", "/")
            file_name = file_name.replace("//", "/")
            self.client.download_file(bucket_name, file_name, download_path)
        except Exception as e:
            output_log(f"Error downloading file from S3: {e}", "error")
            return False
        return True

    def file_download_to_memory(self, file_name, bucket_name=config.s3_bucket):
        try:
            if len(file_name.split("://")) > 1:
                bucket_name = file_name.split("://")[0]
                file_name = file_name.split("://")[1]
            file_name = file_name.replace("\\", "/")
            file_name = file_name.replace("//", "/")
            response = self.client.get_object(Bucket=bucket_name, Key=file_name)
            body = response['Body']
            try:
                return body.read()
            finally:
                body.close()
        except Exception as e:
            output_log(f"Error downloading file from S3 to memory: {e}", "error")
            return None

    def file_list_name(self, prefix="", bucket_name=config.s3_bucket):
        try:
            if len(prefix.split("://")) > 1:
                bucket_name = prefix.split("://")[0]
                prefix = prefix.split("://")[1]
            prefix = prefix.replace("\\", "/")
            prefix = prefix.replace("//", "/")
            output_log(
                f"Listing files from S3 with prefix {prefix}; Bucket_name: {bucket_name}",
                "debug",
            )
            paginator = self.client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket_name, Prefix=prefix)
            
            file_list = []
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        file_list.append(obj['Key'])
            return file_list
        except ClientError as e:
            output_log(f"Error listing files from S3: {e}", "error")
            return None
        except Exception as e:
            output_log(f"Error listing files from S3: {e}", "error")
            return None

    def file_exists(self, file_name, bucket_name=config.s3_bucket):
        try:
            file_name = file_name.replace("\\", "/")
            self.client.head_object(Bucket=bucket_name, Key=file_name)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            output_log(f"Error checking file from S3: {e}", "error")
            return False
        except Exception as e:
            output_log(f"Error checking file from S3: {e}", "error")
            return False

    def remove_file(self, file_name, bucket_name=config.s3_bucket):
        try:
            self.client.delete_object(Bucket=bucket_name, Key=file_name)
        except ClientError as e:
            output_log(f"Error removing file from S3: {e}", "error")
            return False
        except Exception as e:
            output_log(f"Error removing file from S3: {e}", "error")
            return False
        return True
