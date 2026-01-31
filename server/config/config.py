import json
import os
from pydantic import BaseModel
import importlib.metadata


class Config(BaseModel):
    app_name: str
    env: str
    log_level: str
    host: str
    port: int
    recursion_limit: int
    s3_url: str
    s3_bucket: str
    s3_access_key: str
    s3_secret_key: str
    s3_base_path: str
    s3_region: str
    qdrant_host: str
    qdrant_port: int
    default_operator: str
    default_base_model: str
    embedding_operator: str
    embedding_model: str
    embedding_size: int
    dd_api_key: str
    dd_site: str
    dd_service: str
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
    redis_host: str
    redis_port: int
    redis_db: int
    redis_password: str | None = None


try:
    config_data = {}
    env_vars = {
        "app_name": os.environ.get("APP_NAME") or "peng-chat",
        "env": os.environ.get("ENV") or "prod",
        "log_level": os.environ.get("LOG_LEVEL") or "INFO",
        "host": os.environ.get("HOST") or "0.0.0.0",
        "port": int(os.environ.get("PORT")) if os.environ.get("PORT") else 8000,
        "recursion_limit": int(os.environ.get("RECURSION_LIMIT"))
        if os.environ.get("RECURSION_LIMIT")
        else 100,
        "s3_url": os.environ.get("S3_URL")
        if os.environ.get("S3_URL")
        else "http://localhost:9000",
        "s3_bucket": os.environ.get("S3_BUCKET")
        if os.environ.get("S3_BUCKET")
        else "test",
        "s3_access_key": os.environ.get("S3_ACCESS_KEY")
        if os.environ.get("S3_ACCESS_KEY")
        else "minioadmin",
        "s3_secret_key": os.environ.get("S3_SECRET_KEY")
        if os.environ.get("S3_SECRET_KEY")
        else "minioadmin",
        "s3_region": os.environ.get("S3_REGION")
        if os.environ.get("S3_REGION")
        else "us-east-1",
        "s3_base_path": os.environ.get("S3_BASE_PATH")
        if os.environ.get("S3_BASE_PATH")
        else "files",
        "qdrant_host": os.environ.get("QDRANT_HOST")
        if os.environ.get("QDRANT_HOST")
        else "localhost",
        "qdrant_port": int(os.environ.get("QDRANT_PORT"))
        if os.environ.get("QDRANT_PORT")
        else 6333,
        "default_operator": os.environ.get("DEFAULT_OPERATOR")
        if os.environ.get("DEFAULT_OPERATOR")
        else "openai_response",
        "default_base_model": os.environ.get("DEFAULT_BASE_MODEL")
        if os.environ.get("DEFAULT_BASE_MODEL")
        else "gpt-3.5-turbo",
        "embedding_operator": os.environ.get("EMBEDDING_OPERATOR")
        if os.environ.get("EMBEDDING_OPERATOR")
        else "openai_response",
        "embedding_model": os.environ.get("EMBEDDING_MODEL")
        if os.environ.get("EMBEDDING_MODEL")
        else "text-embedding-ada-002",
        "embedding_size": int(os.environ.get("EMBEDDING_SIZE"))
        if os.environ.get("EMBEDDING_SIZE")
        else 1536,
        "dd_api_key": os.environ.get("DD_API_KEY")
        if os.environ.get("DD_API_KEY")
        else "asdasdasdsadasdasdas",
        "dd_site": os.environ.get("DD_SITE")
        if os.environ.get("DD_SITE")
        else "us5.datadoghq.com",
        "dd_service": os.environ.get("DD_SERVICE")
        if os.environ.get("DD_SERVICE")
        else "peng-agent",
        "input_max_length": int(os.environ.get("INPUT_MAX_LENGTH"))
        if os.environ.get("INPUT_MAX_LENGTH")
        else 4096,
        "output_max_length": int(os.environ.get("OUTPUT_MAX_LENGTH"))
        if os.environ.get("OUTPUT_MAX_LENGTH")
        else 8192,
        "mysql_host": os.environ.get("MYSQL_HOST")
        if os.environ.get("MYSQL_HOST")
        else "localhost",
        "mysql_user": os.environ.get("MYSQL_USER")
        if os.environ.get("MYSQL_USER")
        else "root",
        "mysql_password": os.environ.get("MYSQL_PASSWORD")
        if os.environ.get("MYSQL_PASSWORD")
        else "password",
        "mysql_database": os.environ.get("MYSQL_DATABASE")
        if os.environ.get("MYSQL_DATABASE")
        else "test",
        "jwt_secret_key": os.environ.get("JWT_SECRET_KEY")
        if os.environ.get("JWT_SECRET_KEY")
        else "randome-secret-key",
        "admin_password": os.environ.get("ADMIN_PASSWORD")
        if os.environ.get("ADMIN_PASSWORD")
        else "admin",
        "azure_document_endpoint": os.environ.get("AZURE_DOCUMENT_ENDPOINT")
        if os.environ.get("AZURE_DOCUMENT_ENDPOINT")
        else "https://test.cognitiveservices.azure.com/",
        "azure_document_key": os.environ.get("AZURE_DOCUMENT_KEY")
        if os.environ.get("AZURE_DOCUMENT_KEY")
        else "asdadasdasd",
        "tavily_api_key": os.environ.get("TAVILY_API_KEY")
        if os.environ.get("TAVILY_API_KEY")
        else "tavily_api_key",
        "web_search_max_results": int(os.environ.get("WEB_SEARCH_MAX_RESULTS"))
        if os.environ.get("WEB_SEARCH_MAX_RESULTS")
        else 5,
        "smtp_server": os.environ.get("SMTP_SERVER")
        if os.environ.get("SMTP_SERVER")
        else "smtp.example.com",
        "smtp_port": int(os.environ.get("SMTP_PORT"))
        if os.environ.get("SMTP_PORT")
        else 587,
        "smtp_use_ssl": os.environ.get("SMTP_USE_SSL") == "true"
        if os.environ.get("SMTP_USE_SSL") is not None
        else False,
        "smtp_username": os.environ.get("SMTP_USERNAME")
        if os.environ.get("SMTP_USERNAME")
        else "username",
        "smtp_password": os.environ.get("SMTP_PASSWORD")
        if os.environ.get("SMTP_PASSWORD")
        else "password",
        "redis_host": os.environ.get("REDIS_HOST")
        if os.environ.get("REDIS_HOST")
        else "localhost",
        "redis_port": int(os.environ.get("REDIS_PORT"))
        if os.environ.get("REDIS_PORT")
        else 6379,
        "redis_db": int(os.environ.get("REDIS_DB"))
        if os.environ.get("REDIS_DB")
        else 0,
        "redis_password": os.environ.get("REDIS_PASSWORD"),
    }
    for key, value in env_vars.items():
        if value is not None:
            config_data[key] = value
    config = Config(**config_data)

    # Datadog Related
    os.environ["DD_TRACE_ENABLED"] = "true"
    os.environ["DD_ENV"] = config.env
    os.environ["DD_SERVICE"] = config.dd_service
    os.environ["DD_VERSION"] = importlib.metadata.version("Peng-Agent")
except (json.JSONDecodeError, FileNotFoundError) as e:
    print(f"Error reading config file: {e}")
    raise
