import unittest
from unittest.mock import patch
import os
import importlib
import config.config

class TestConfig(unittest.TestCase):
    def setUp(self):
        self.required_env = {
            "APP_NAME": "TestApp",
            "ENV": "test",
            "LOG_LEVEL": "DEBUG",
            "HOST": "0.0.0.0",
            "PORT": "8000",
            "S3_URL": "http://minio:9000",
            "S3_BUCKET": "test",
            "S3_ACCESS_KEY": "access",
            "S3_SECRET_KEY": "secret",
            "S3_BASE_PATH": "base",
            "S3_REGION": "us-east-1",
            "QDRANT_HOST": "qdrant",
            "QDRANT_PORT": "6333",
            "DEFAULT_OPERATOR": "op",
            "DEFAULT_BASE_MODEL": "model",
            "EMBEDDING_OPERATOR": "op",
            "EMBEDDING_MODEL": "emb",
            "EMBEDDING_SIZE": "1536",
            "DD_API_KEY": "key",
            "DD_SITE": "site",
            "DD_SERVICE": "svc",
            "MYSQL_HOST": "localhost",
            "MYSQL_USER": "user",
            "MYSQL_PASSWORD": "pass",
            "MYSQL_DATABASE": "db",
            "REDIS_HOST": "localhost",
            "REDIS_PORT": "6379",
            "REDIS_DB": "0",
            "REDIS_PASSWORD": "pass",
            "JWT_SECRET_KEY": "secret",
            "ADMIN_PASSWORD": "admin",
            "TAVILY_API_KEY": "key",
            "WEB_SEARCH_MAX_RESULTS": "5",
            "CRAWLER4AI_URL": "http://crawl",
            "INPUT_MAX_LENGTH": "4096",
            "OUTPUT_MAX_LENGTH": "4096",
            "SMTP_SERVER": "smtp",
            "SMTP_PORT": "587",
            "SMTP_USE_SSL": "False",
            "SMTP_USERNAME": "user",
            "SMTP_PASSWORD": "pass"
        }

    def test_config_load(self):
        with patch.dict(os.environ, self.required_env):
            # Reload the module to pick up the patched environment
            importlib.reload(config.config)
            test_config = config.config.config
            self.assertEqual(test_config.app_name, "TestApp")
            self.assertEqual(test_config.log_level, "DEBUG")

    def test_config_defaults(self):
        with patch.dict(os.environ, self.required_env):
            importlib.reload(config.config)
            test_config = config.config.config
            self.assertEqual(test_config.s3_bucket, "test")
            self.assertEqual(test_config.jwt_secret_key, "secret")

if __name__ == '__main__':
    unittest.main()
