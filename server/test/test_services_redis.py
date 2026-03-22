import unittest
from unittest.mock import patch
from services.redis_service import get_table_record, get_table_records, create_table_record, update_table_record

class TestRedisService(unittest.TestCase):
    @patch('services.redis_service.mysql_client')
    @patch('services.redis_service.redis_cache')
    def test_get_table_record_cache_hit(self, mock_redis, mock_mysql):
        mock_redis.get_record.return_value = {"id": 1, "user_name": "test"}
        
        result = get_table_record("user", "test")
        
        self.assertEqual(result["user_name"], "test")
        mock_redis.get_record.assert_called_once_with("user", "test")
        mock_mysql.read_records.assert_not_called()

    @patch('services.redis_service.mysql_client')
    @patch('services.redis_service.redis_cache')
    def test_get_table_record_cache_miss(self, mock_redis, mock_mysql):
        mock_redis.get_record.return_value = None
        mock_mysql.read_records.return_value = [{"id": 1, "user_name": "test"}]
        
        result = get_table_record("user", "test")
        
        self.assertEqual(result["user_name"], "test")
        mock_mysql.read_records.assert_called_once()
        mock_redis.save_record.assert_called_once()

    @patch('services.redis_service.mysql_client')
    @patch('services.redis_service.redis_cache')
    def test_get_table_records(self, mock_redis, mock_mysql):
        mock_redis.get_records.return_value = [{"id": 1}, {"id": 2}]
        
        result = get_table_records("model")
        
        self.assertEqual(len(result), 2)
        mock_redis.get_records.assert_called_once_with("model")

    @patch('services.redis_service.mysql_client')
    @patch('services.redis_service.redis_cache')
    def test_create_table_record(self, mock_redis, mock_mysql):
        mock_mysql.create_record.return_value = {"id": 1, "name": "new"}
        
        result = create_table_record("tools", {"name": "new"}, redis_id="name")
        
        self.assertEqual(result["name"], "new")
        mock_mysql.create_record.assert_called_once()
        mock_redis.save_record.assert_called_once_with("tools", result, id="name")

    @patch('services.redis_service.mysql_client')
    @patch('services.redis_service.redis_cache')
    def test_update_table_record(self, mock_redis, mock_mysql):
        mock_mysql.update_record.return_value = 1
        mock_mysql.read_records.return_value = [{"id": 1, "user_name": "updated"}]
        
        result = update_table_record("user", {"email": "new@ex.com"}, {"user_name": "test"}, redis_id="user_name")
        
        self.assertEqual(result, 1)
        mock_mysql.update_record.assert_called_once()
        mock_redis.delete_record.assert_called_once_with("user", "test")
        mock_redis.save_record.assert_called_once()

if __name__ == '__main__':
    unittest.main()
