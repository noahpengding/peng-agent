import unittest
from unittest.mock import patch, MagicMock
from handlers.memory_handlers import get_memory

class TestMemoryHandlers(unittest.TestCase):
    @patch('handlers.memory_handlers.MysqlConnect')
    def test_get_memory_success(self, mock_mysql_class):
        mock_mysql = mock_mysql_class.return_value
        mock_session = mock_mysql.get_session.return_value.__enter__.return_value
        
        # Mocking row objects returned by session.execute
        mock_row = MagicMock()
        mock_row.id = 1
        mock_row.user_name = "test_user"
        mock_row.type = "chat"
        mock_row.base_model = "gpt-4"
        mock_row.human_input = "hi"
        mock_row.other_input = ""
        mock_row.ai_response = "hello"
        mock_row.created_at = "2023-01-01"
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 1
        mock_session.execute.side_effect = [mock_count_result, [mock_row]]
        
        result = get_memory("test_user")
        self.assertEqual(result["page"], 1)
        self.assertEqual(result["page_size"], 20)
        self.assertEqual(result["total_count"], 1)
        self.assertEqual(len(result["memories"]), 1)
        self.assertEqual(result["memories"][0]["ai_response"], "hello")

    def test_get_memory_empty_user(self):
        result = get_memory("")
        self.assertEqual(result["memories"], [])
        self.assertEqual(result["total_count"], 0)

    @patch('handlers.memory_handlers.MysqlConnect')
    def test_get_memory_clamps_page_to_available_results(self, mock_mysql_class):
        mock_mysql = mock_mysql_class.return_value
        mock_session = mock_mysql.get_session.return_value.__enter__.return_value
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 21
        mock_session.execute.side_effect = [mock_count_result, []]

        result = get_memory("test_user", page=99)

        self.assertEqual(result["page"], 2)
        self.assertEqual(result["total_pages"], 2)
        records_params = mock_session.execute.call_args_list[1].args[1]
        self.assertEqual(records_params["limit"], 20)
        self.assertEqual(records_params["offset"], 20)

if __name__ == '__main__':
    unittest.main()
