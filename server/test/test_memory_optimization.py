import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime
import sys
import os

# Add server directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# We need to mock utils.log before importing handlers.memory_handlers
sys.modules['utils.log'] = MagicMock()
sys.modules['utils.mysql_connect'] = MagicMock()

try:
    from handlers.memory_handlers import get_memory
except ImportError:
    pass

class TestMemoryOptimization(unittest.TestCase):
    @patch('handlers.memory_handlers.MysqlConnect')
    def test_get_memory_optimized(self, MockMysqlConnect):
        # Setup mock
        mock_mysql = MockMysqlConnect.return_value
        mock_session = MagicMock()
        mock_mysql.get_session.return_value.__enter__.return_value = mock_session

        # Mock data - Row 1: Normal chat with image
        created_at1 = datetime.now()
        row1 = MagicMock()
        row1.id = 1
        row1.user_name = "test_user"
        row1.type = "chat"
        row1.base_model = "gpt-4"
        row1.human_input = "Hello"
        row1.other_input = "image.png"
        row1.ai_response = "Hi there"
        row1.created_at = created_at1

        # Mock data - Row 2: Text-only chat (other_input is empty string due to COALESCE in SQL)
        created_at2 = datetime.now()
        row2 = MagicMock()
        row2.id = 2
        row2.user_name = "test_user"
        row2.type = "chat"
        row2.base_model = "gpt-3.5"
        row2.human_input = "Just text"
        row2.other_input = ""
        row2.ai_response = "Text response"
        row2.created_at = created_at2

        # Mock data - Row 3: Missing AI response (should be skipped)
        created_at3 = datetime.now()
        row3 = MagicMock()
        row3.id = 3
        row3.user_name = "test_user"
        row3.type = "chat"
        row3.base_model = "gpt-4"
        row3.human_input = "Incomplete"
        row3.other_input = ""
        row3.ai_response = None
        row3.created_at = created_at3

        mock_session.execute.return_value = [row1, row2, row3]

        # Call function
        from handlers.memory_handlers import get_memory
        result = get_memory("test_user")

        # Verify query execution
        mock_session.execute.assert_called_once()
        args, _ = mock_session.execute.call_args
        query_text = str(args[0])
        self.assertIn("SELECT", query_text)
        self.assertIn("FROM chat c", query_text)
        self.assertIn("COALESCE", query_text)

        # Verify result structure
        self.assertEqual(len(result), 2) # Should contain row1 and row2, skip row3

        item1 = result[0]
        self.assertEqual(item1["id"], 1)
        self.assertEqual(item1["username"], "test_user")
        self.assertEqual(item1["human_input"], "Hello")
        self.assertEqual(item1["other_input"], "image.png")
        self.assertEqual(item1["ai_response"], "Hi there")

        item2 = result[1]
        self.assertEqual(item2["id"], 2)
        self.assertEqual(item2["human_input"], "Just text")
        self.assertEqual(item2["other_input"], "")
        self.assertEqual(item2["ai_response"], "Text response")

if __name__ == '__main__':
    unittest.main()
