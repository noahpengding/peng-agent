import json
import os
from pydantic import BaseModel, ValidationError
from typing import List

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

try:
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    config_sample = os.path.join(os.path.dirname(__file__), 'config_sample.json')
    config_data = {}
    if os.path.exists(config_sample):
        with open(config_sample) as f:
            sample_data = json.load(f)
        for key, value in sample_data.items():
            config_data[key] = value
    env_vars = {
        "log_level": os.environ.get('log_level') or "INFO",
        "host": os.environ.get('host') or "0.0.0.0",
        "port": int(os.environ.get('port')) if os.environ.get('port') else 8000,
        "s3_url": os.environ.get('s3_url') if os.environ.get('s3_url') else "http://localhost:9000",
        "s3_bucket": os.environ.get('s3_bucket') if os.environ.get('s3_bucket') else "test",
        "s3_access_key": os.environ.get('s3_access_key') if os.environ.get('s3_access_key') else "minioadmin",
        "s3_secret_key": os.environ.get('s3_secret_key') if os.environ.get('s3_secret_key') else "minioadmin",
        "openai_api_key": os.environ.get('openai_api_key') if os.environ.get('openai_api_key') else "sk-1234567890",
        "openai_organization_id": os.environ.get('openai_organization_id') if os.environ.get('openai_organization_id') else "org-1234567890",
        "openai_project_id": os.environ.get('openai_project_id') if os.environ.get('openai_project_id') else "proj-1234567890",
        "start_prompt": os.environ.get('start_prompt') if os.environ.get('start_prompt') else "The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.",
        "qdrant_host": os.environ.get('qdrant_host') if os.environ.get('qdrant_host') else "localhost",
        "qdrant_port": int(os.environ.get('qdrant_port')) if os.environ.get('qdrant_port') else 6333,
        "ollama_url": os.environ.get('ollama_url') if os.environ.get('ollama_url') else "http://localhost:11434",
        "default_base_model": os.environ.get('default_base_model') if os.environ.get('default_base_model') else "gpt-3.5-turbo",
        "default_embedding_model": os.environ.get('default_embedding_model') if os.environ.get('default_embedding_model') else "nomic-embed-text",
        "mysql_host": os.environ.get('MYSQL_HOST') if os.environ.get('MYSQL_HOST') else "localhost",
        "mysql_user": os.environ.get('MYSQL_USER') if os.environ.get('MYSQL_USER') else "root",
        "mysql_password": os.environ.get('MYSQL_PASSWORD') if os.environ.get('MYSQL_PASSWORD') else "password",
        "mysql_database": os.environ.get('MYSQL_DATABASE') if os.environ.get('MYSQL_DATABASE') else "test"
    }
    for key, value in env_vars.items():
        if value is not None:
            config_data[key] = value
    if os.path.exists(config_path):
        with open(config_path) as f:
            config_data = json.load(f)
    config = Config(**config_data)
except (json.JSONDecodeError, FileNotFoundError) as e:
    print(f"Error reading config file: {e}")
    raise
