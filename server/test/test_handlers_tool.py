import unittest
from unittest.mock import patch, MagicMock
from handlers.tool_handlers import get_all_tools, get_tool_by_name

class TestToolHandlers(unittest.TestCase):
    @patch('handlers.tool_handlers.get_table_records')
    def test_get_all_tools(self, mock_get_records):
        mock_get_records.return_value = [{"name": "tool1"}]
        result = get_all_tools()
        self.assertEqual(result, [{"name": "tool1"}])

    @patch('handlers.tool_handlers.get_table_record')
    def test_get_tool_by_name(self, mock_get_record):
        mock_get_record.return_value = {"name": "tool1"}
        result = get_tool_by_name("tool1")
        self.assertEqual(result, {"name": "tool1"})

if __name__ == '__main__':
    unittest.main()
