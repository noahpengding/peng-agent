import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.api import app

client = TestClient(app)

class TestApiRouters(unittest.TestCase):
    @patch('handlers.auth_handlers.authenticate_user')
    @patch('handlers.auth_handlers.create_access_token')
    def test_login_success(self, mock_create_token, mock_authenticate):
        mock_authenticate.return_value = {"user_name": "test_user"}
        mock_create_token.return_value = "fake_token"
        
        response = client.post(
            "/api/login",
            json={"username": "test_user", "password": "password"}
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"access_token": "fake_token", "token_type": "bearer"})

    @patch('handlers.auth_handlers.authenticate_user')
    def test_login_fail(self, mock_authenticate):
        mock_authenticate.return_value = None
        
        response = client.post(
            "/api/login",
            json={"username": "test_user", "password": "wrong_password"}
        )
        
        self.assertEqual(response.status_code, 401)

    @patch('handlers.auth_handlers.create_user')
    def test_signup_success(self, mock_create_user):
        from config.config import config
        mock_create_user.return_value = {"user_name": "new_user"}
        
        response = client.post(
            "/api/signup",
            json={
                "username": "new_user",
                "password": "password",
                "admin_password": config.admin_password
            }
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user_name"], "new_user")

if __name__ == '__main__':
    unittest.main()
