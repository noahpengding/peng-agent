import unittest
from unittest.mock import patch, MagicMock
from utils.minio_connection import MinioStorage, _clients

class TestMinioStorage(unittest.TestCase):
    def setUp(self):
        # Clear the global cache to ensure boto3.client is called
        _clients.clear()
        self.patcher = patch('boto3.client')
        self.mock_boto3_client = self.patcher.start()
        self.mock_client = self.mock_boto3_client.return_value
        self.storage = MinioStorage()

    def tearDown(self):
        self.patcher.stop()
        _clients.clear()

    def test_file_upload(self):
        with patch('os.remove') as mock_remove:
            result = self.storage.file_upload("local_path", "remote_name", "application/json")
            self.mock_client.upload_file.assert_called_once()
            mock_remove.assert_called_once_with("local_path")
            self.assertTrue(result)

    def test_file_upload_from_string(self):
        result = self.storage.file_upload_from_string("content", "remote_name", "text/plain")
        self.mock_client.put_object.assert_called_once()
        self.assertTrue(result)

    def test_file_download(self):
        result = self.storage.file_download("remote_name", "local_path")
        self.mock_client.download_file.assert_called_once()
        self.assertTrue(result)

    def test_file_download_to_memory(self):
        mock_body = MagicMock()
        mock_body.read.return_value = b"content"
        self.mock_client.get_object.return_value = {"Body": mock_body}
        
        result = self.storage.file_download_to_memory("remote_name")
        self.assertEqual(result, b"content")

    def test_file_exists(self):
        self.storage.file_exists("remote_name")
        self.mock_client.head_object.assert_called_once()

    def test_remove_file(self):
        result = self.storage.remove_file("remote_name")
        self.mock_client.delete_object.assert_called_once()
        self.assertTrue(result)

if __name__ == '__main__':
    unittest.main()
