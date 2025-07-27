import json
import os
from pydantic import BaseModel


class Config(BaseModel):
    app_name: str
    log_level: str
    host: str
    port: int
    s3_url: str
    s3_bucket: str
    s3_access_key: str
    s3_secret_key: str
    qdrant_host: str
    qdrant_port: int
    default_operator: str
    default_base_model: str
    huggingface_cache_dir: str
    embedding_operator: str
    embedding_model: str
    embedding_size: int
    mysql_host: str
    mysql_user: str
    mysql_password: str
    mysql_database: str
    jwt_secret_key: str
    admin_password: str
    azure_document_endpoint: str
    azure_document_key: str
    tavily_api_key: str
    web_search_max_results: int
    input_max_length: int
    output_max_length: int
    smtp_server: str
    smtp_port: int
    smtp_use_ssl: bool
    smtp_username: str
    smtp_password: str


try:
    config_data = {}
    env_vars = {
        "app_name": os.environ.get("app_name") or "peng-chat",
        "log_level": os.environ.get("log_level") or "INFO",
        "host": os.environ.get("host") or "0.0.0.0",
        "port": int(os.environ.get("port")) if os.environ.get("port") else 8000,
        "s3_url": os.environ.get("s3_url")
        if os.environ.get("s3_url")
        else "http://localhost:9000",
        "s3_bucket": os.environ.get("s3_bucket")
        if os.environ.get("s3_bucket")
        else "test",
        "s3_access_key": os.environ.get("s3_access_key")
        if os.environ.get("s3_access_key")
        else "minioadmin",
        "s3_secret_key": os.environ.get("s3_secret_key")
        if os.environ.get("s3_secret_key")
        else "minioadmin",
        "qdrant_host": os.environ.get("qdrant_host")
        if os.environ.get("qdrant_host")
        else "localhost",
        "qdrant_port": int(os.environ.get("qdrant_port"))
        if os.environ.get("qdrant_port")
        else 6333,
        "default_operator": os.environ.get("default_operator")
        if os.environ.get("default_operator")
        else "openai_response",
        "default_base_model": os.environ.get("default_base_model")
        if os.environ.get("default_base_model")
        else "gpt-3.5-turbo",
        "huggingface_cache_dir": os.environ.get("huggingface_cache_dir")
        if os.environ.get("huggingface_cache_dir")
        else os.path.join(os.path.expanduser("~"), ".cache", "huggingface"),
        "embedding_operator": os.environ.get("embedding_operator")
        if os.environ.get("embedding_operator")
        else "openai_response",
        "embedding_model": os.environ.get("embedding_model")
        if os.environ.get("embedding_model")
        else "text-embedding-ada-002",
        "embedding_size": int(os.environ.get("embedding_size"))
        if os.environ.get("embedding_size")
        else 1536,
        "mysql_host": os.environ.get("mysql_host")
        if os.environ.get("mysql_host")
        else "localhost",
        "mysql_user": os.environ.get("mysql_user")
        if os.environ.get("mysql_user")
        else "root",
        "mysql_password": os.environ.get("mysql_password")
        if os.environ.get("mysql_password")
        else "password",
        "mysql_database": os.environ.get("mysql_database")
        if os.environ.get("mysql_database")
        else "test",
        "jwt_secret_key": os.environ.get("jwt_secret_key")
        if os.environ.get("jwt_secret_key")
        else "randome-secret-key",
        "admin_password": os.environ.get("admin_password")
        if os.environ.get("admin_password")
        else "admin",
        "azure_document_endpoint": os.environ.get("azure_document_endpoint")
        if os.environ.get("azure_document_endpoint")
        else "https://test.cognitiveservices.azure.com/",
        "azure_document_key": os.environ.get("azure_document_key")
        if os.environ.get("azure_document_key")
        else "asdadasdasd",
        "tavily_api_key": os.environ.get("tavily_api_key")
        if os.environ.get("tavily_api_key")
        else "tavily_api_key",
        "web_search_max_results": int(os.environ.get("web_search_max_results"))
        if os.environ.get("web_search_max_results")
        else 5,
        "input_max_length": int(os.environ.get("input_max_length"))
        if os.environ.get("input_max_length")
        else 4096,
        "output_max_length": int(os.environ.get("output_max_length"))
        if os.environ.get("output_max_length")
        else 8192,
        "smtp_server": os.environ.get("smtp_server")
        if os.environ.get("smtp_server")
        else "smtp.example.com",
        "smtp_port": int(os.environ.get("smtp_port"))
        if os.environ.get("smtp_port")
        else 587,
        "smtp_use_ssl": os.environ.get("smtp_use_ssl") == "true"
        if os.environ.get("smtp_use_ssl") is not None
        else False,
        "smtp_username": os.environ.get("smtp_username")
        if os.environ.get("smtp_username")
        else "username",
        "smtp_password": os.environ.get("smtp_password")
        if os.environ.get("smtp_password")
        else "password",
    }
    for key, value in env_vars.items():
        if value is not None:
            config_data[key] = value
    config = Config(**config_data)
except (json.JSONDecodeError, FileNotFoundError) as e:
    print(f"Error reading config file: {e}")
    raise
