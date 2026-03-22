import unittest
from unittest.mock import patch
import json
from utils.redis import RedisCache

class TestRedisCache(unittest.TestCase):
    @patch('redis.Redis')
    def setUp(self, mock_redis):
        self.cache = RedisCache()
        self.mock_client = self.cache.client

    def test_save_record(self):
        record = {"id": "1", "name": "test"}
        self.cache.save_record("user", record)
        
        # Verify pipeline was used
        self.mock_client.pipeline.assert_called_once()
        mock_pipe = self.mock_client.pipeline.return_value
        mock_pipe.set.assert_called_once_with("user:1", json.dumps(record, default=str))
        mock_pipe.sadd.assert_called_once_with("user:ids", "1")
        mock_pipe.execute.assert_called_once()

    def test_get_record(self):
        record = {"id": "1", "name": "test"}
        self.mock_client.get.return_value = json.dumps(record)
        
        result = self.cache.get_record("user", "1")
        self.mock_client.get.assert_called_once_with("user:1")
        self.assertEqual(result, record)

    def test_get_record_not_found(self):
        self.mock_client.get.return_value = None
        result = self.cache.get_record("user", "nonexistent")
        self.assertIsNone(result)

    def test_delete_record(self):
        self.cache.delete_record("user", "1")
        mock_pipe = self.mock_client.pipeline.return_value
        mock_pipe.delete.assert_called_once_with("user:1")
        mock_pipe.srem.assert_called_once_with("user:ids", "1")
        mock_pipe.execute.assert_called_once()

    def test_unsupported_table(self):
        with self.assertRaises(ValueError):
            self.cache.get_record("unsupported", "1")

if __name__ == '__main__':
    unittest.main()
