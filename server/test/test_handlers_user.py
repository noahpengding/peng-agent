import unittest
from unittest.mock import patch, MagicMock
from handlers.user_handlers import get_user_profile, update_user_profile
from models.user_models import UserUpdate
from fastapi import HTTPException
import json

class TestUserHandlers(unittest.TestCase):
    @patch('handlers.user_handlers.get_table_record')
    def test_get_user_profile_success(self, mock_get_record):
        mock_user = {
            "user_name": "test_user",
            "email": "test@example.com",
            "api_token": "token123",
            "default_base_model": "gpt-4",
            "long_term_memory": json.dumps(["memory1"])
        }
        mock_get_record.return_value = mock_user
        
        profile = get_user_profile("test_user")
        self.assertEqual(profile.username, "test_user")
        self.assertEqual(profile.long_term_memory, ["memory1"])

    @patch('handlers.user_handlers.get_table_record')
    def test_get_user_profile_not_found(self, mock_get_record):
        mock_get_record.return_value = None
        with self.assertRaises(HTTPException) as cm:
            get_user_profile("nonexistent")
        self.assertEqual(cm.exception.status_code, 404)

    @patch('handlers.user_handlers.update_table_record')
    @patch('handlers.user_handlers.get_password_hash')
    def test_update_user_profile(self, mock_hash, mock_update):
        mock_hash.return_value = "hashed_pass"
        user_data = UserUpdate(password="new_pass", email="new@example.com")
        
        result = update_user_profile("test_user", user_data)
        self.assertEqual(result["message"], "User profile updated successfully")
        mock_update.assert_called_once()

if __name__ == '__main__':
    unittest.main()
