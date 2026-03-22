import unittest
from unittest.mock import patch, MagicMock
from handlers.auth_handlers import authenticate_user, create_access_token, authenticate_request
from fastapi import HTTPException
import jwt
from config.config import config

class TestAuthHandlers(unittest.IsolatedAsyncioTestCase):
    @patch('handlers.auth_handlers.get_table_record')
    @patch('handlers.auth_handlers.verify_password')
    def test_authenticate_user_success(self, mock_verify, mock_get_record):
        mock_user = {"user_name": "test", "password": "hashed_password"}
        mock_get_record.return_value = mock_user
        mock_verify.return_value = True
        
        result = authenticate_user("test", "plain_password")
        self.assertEqual(result, mock_user)

    @patch('handlers.auth_handlers.get_table_record')
    def test_authenticate_user_fail(self, mock_get_record):
        mock_get_record.return_value = None
        result = authenticate_user("nonexistent", "pass")
        self.assertIsNone(result)

    def test_create_access_token(self):
        token = create_access_token({"sub": "test"}, 1)
        payload = jwt.decode(token, config.jwt_secret_key, algorithms=["HS256"])
        self.assertEqual(payload["sub"], "test")

    async def test_authenticate_request_success(self):
        token = create_access_token({"sub": "test"}, 1)
        mock_request = MagicMock()
        mock_request.headers.get.return_value = f"Bearer {token}"
        
        result = await authenticate_request(mock_request)
        self.assertEqual(result["username"], "test")

    async def test_authenticate_request_no_token(self):
        mock_request = MagicMock()
        mock_request.headers.get.return_value = None
        with self.assertRaises(HTTPException) as cm:
            await authenticate_request(mock_request)
        self.assertEqual(cm.exception.status_code, 401)

if __name__ == '__main__':
    unittest.main()
