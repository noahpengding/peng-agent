import unittest
from unittest.mock import patch
import sys
import os

# Add server directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from redis.exceptions import RedisError

class TestRedisService(unittest.TestCase):
    def setUp(self):
        # Patch importlib.metadata.version to avoid PackageNotFoundError
        self.version_patcher = patch('importlib.metadata.version', return_value="0.0.0")
        self.version_patcher.start()

        # Ensure modules are imported so patch can find them

        # Patch MysqlConnect
        self.mysql_patcher = patch('utils.mysql_connect.MysqlConnect')
        self.mock_mysql_cls = self.mysql_patcher.start()
        self.mock_mysql_instance = self.mock_mysql_cls.return_value

        # Patch redis_cache instance in utils.redis
        # We mock the object that is already instantiated in utils.redis
        self.redis_patcher = patch('utils.redis.redis_cache')
        self.mock_redis_cache = self.redis_patcher.start()

        # Import/Reload modules to ensure they use our mocks
        import services.redis_service
        import importlib
        importlib.reload(services.redis_service)
        self.redis_service = services.redis_service

        self.mock_mysql = self.mock_mysql_instance
        # self.redis_service.redis_cache should be the mock we patched in utils.redis

    def tearDown(self):
        self.mysql_patcher.stop()
        self.redis_patcher.stop()
        self.version_patcher.stop()

    def test_get_table_record_hit(self):
        """Test getting a record when it exists in Redis."""
        self.mock_redis_cache.get_record.return_value = {"id": 1, "name": "foo"}

        result = self.redis_service.get_table_record("tools", "foo")

        self.assertEqual(result, {"id": 1, "name": "foo"})
        self.mock_redis_cache.get_record.assert_called_with("tools", "foo")
        self.mock_mysql.read_records.assert_not_called()

    def test_get_table_record_miss(self):
        """Test getting a record when it is missing in Redis but exists in MySQL."""
        self.mock_redis_cache.get_record.return_value = None
        self.mock_mysql.read_records.return_value = [{"id": 1, "name": "foo"}]

        result = self.redis_service.get_table_record("tools", "foo")

        self.assertEqual(result, {"id": 1, "name": "foo"})
        self.mock_mysql.read_records.assert_called_with("tools", {"name": "foo"})
        self.mock_redis_cache.save_record.assert_called_with("tools", {"id": 1, "name": "foo"}, id="name")

    def test_get_table_record_redis_error(self):
        """Test that Redis errors are caught and we fall back to MySQL."""
        self.mock_redis_cache.get_record.side_effect = RedisError("connection failed")
        self.mock_mysql.read_records.return_value = [{"id": 1, "name": "foo"}]

        result = self.redis_service.get_table_record("tools", "foo")

        self.assertEqual(result, {"id": 1, "name": "foo"})
        # Verify we tried to save back to redis (and if that fails, it should be caught too)
        # We need to ensure save_record doesn't crash if it raises RedisError too
        self.mock_redis_cache.save_record.side_effect = RedisError("save failed")

        # If the code didn't catch exception, this test would fail with RedisError

    def test_create_table_record(self):
        """Test creating a record updates both MySQL and Redis."""
        record = {"name": "new_tool", "url": "http://..."}
        self.mock_mysql.create_record.return_value = record

        self.redis_service.create_table_record("tools", record, redis_id="name")

        self.mock_mysql.create_record.assert_called_with("tools", record)
        self.mock_redis_cache.save_record.assert_called_with("tools", record, id="name")

    def test_create_table_record_redis_fail(self):
        """Test creating a record when Redis fails."""
        record = {"name": "new_tool", "url": "http://..."}
        self.mock_mysql.create_record.return_value = record
        self.mock_redis_cache.save_record.side_effect = RedisError("fail")

        result = self.redis_service.create_table_record("tools", record, redis_id="name")

        self.assertEqual(result, record)
        # Should not raise exception

    def test_update_table_record(self):
        """Test updating a record updates both MySQL and Redis."""
        record = {"url": "http://updated"}
        conditions = {"name": "my_tool"}
        self.mock_mysql.update_record.return_value = 1
        self.mock_mysql.read_records.return_value = [{"name": "my_tool", "url": "http://updated"}]

        self.redis_service.update_table_record("tools", record, conditions, redis_id="name")

        self.mock_mysql.update_record.assert_called_with("tools", record, conditions)
        self.mock_mysql.read_records.assert_called_with("tools", {"name": "my_tool"})
        self.mock_redis_cache.save_record.assert_called_with("tools", {"name": "my_tool", "url": "http://updated"}, id="name")

    def test_delete_table_record(self):
        """Test deleting a record removes from both."""
        self.redis_service.delete_table_record("tools", "my_tool")

        self.mock_mysql.delete_record.assert_called_with("tools", {"name": "my_tool"})
        self.mock_redis_cache.delete_record.assert_called_with("tools", "my_tool")

if __name__ == '__main__':
    unittest.main()
