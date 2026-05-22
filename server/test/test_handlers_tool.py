import unittest
from unittest.mock import patch
from handlers.tool_handlers import get_all_tools, get_tool_by_name

class TestToolHandlers(unittest.TestCase):
    @patch('handlers.tool_handlers.redis_cache')
    def test_get_all_tools(self, mock_redis):
        mock_redis.get_records.return_value = [{"name": "tool1"}]
        result = get_all_tools()
        self.assertEqual(result, [{"name": "tool1"}])
        mock_redis.get_records.assert_called_once_with("tools")

    @patch('handlers.tool_handlers.redis_cache')
    def test_get_tool_by_name(self, mock_redis):
        mock_redis.get_record.return_value = {"name": "tool1"}
        result = get_tool_by_name("tool1")
        self.assertEqual(result, {"name": "tool1"})
        mock_redis.get_record.assert_called_once_with("tools", "tool1")

if __name__ == '__main__':
    unittest.main()
