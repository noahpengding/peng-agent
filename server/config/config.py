import json
import os
from pydantic import BaseModel


class Config(BaseModel):
    log_level: str
    host: str
    port: int
    s3_url: str
    s3_bucket: str
    s3_access_key: str
    s3_secret_key: str
    openai_api_key: str
    openai_organization_id: str
    openai_project_id: str
    start_prompt: str
    qdrant_host: str
    qdrant_port: int
    ollama_url: str
    default_base_model: str
    default_embedding_model: str
    mysql_host: str
    mysql_user: str
    mysql_password: str
    mysql_database: str
    jwt_secret_key: str = "your-secret-key-here"
    azure_document_endpoint: str
    azure_document_key: str
    input_max_length: int
    output_max_length: int


try:
    config_data = {}
    env_vars = {
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
        "openai_api_key": os.environ.get("openai_api_key")
        if os.environ.get("openai_api_key")
        else "sk-1234567890",
        "openai_organization_id": os.environ.get("openai_organization_id")
        if os.environ.get("openai_organization_id")
        else "org-1234567890",
        "openai_project_id": os.environ.get("openai_project_id")
        if os.environ.get("openai_project_id")
        else "proj-1234567890",
        "start_prompt": os.environ.get("start_prompt")
        if os.environ.get("start_prompt")
        else "The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.",
        "qdrant_host": os.environ.get("qdrant_host")
        if os.environ.get("qdrant_host")
        else "localhost",
        "qdrant_port": int(os.environ.get("qdrant_port"))
        if os.environ.get("qdrant_port")
        else 6333,
        "ollama_url": os.environ.get("ollama_url")
        if os.environ.get("ollama_url")
        else "http://localhost:11434",
        "default_base_model": os.environ.get("default_base_model")
        if os.environ.get("default_base_model")
        else "gpt-3.5-turbo",
        "default_embedding_model": os.environ.get("default_embedding_model")
        if os.environ.get("default_embedding_model")
        else "nomic-embed-text",
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
        "azure_document_endpoint": os.environ.get("azure_document_endpoint")
        if os.environ.get("azure_document_endpoint")
        else "https://test.cognitiveservices.azure.com/",
        "azure_document_key": os.environ.get("azure_document_key")
        if os.environ.get("azure_document_key")
        else "asdadasdasd",
        "input_max_length": int(os.environ.get("input_max_length"))
        if os.environ.get("input_max_length")
        else 4096,
        "output_max_length": int(os.environ.get("output_max_length"))
        if os.environ.get("output_max_length")
        else 8192,
    }
    for key, value in env_vars.items():
        if value is not None:
            config_data[key] = value
    config = Config(**config_data)
except (json.JSONDecodeError, FileNotFoundError) as e:
    print(f"Error reading config file: {e}")
    raise
