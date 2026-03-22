import unittest
from unittest.mock import patch
from handlers.file_handlers import file_uploader, file_upload_frontend_with_name, _safe_file_name, _extension_from_content_type
import base64

class TestFileHandlers(unittest.TestCase):
    @patch('handlers.file_handlers.MinioStorage')
    def test_file_uploader_success(self, mock_minio_class):
        mock_minio = mock_minio_class.return_value
        mock_minio.file_upload_from_string.return_value = True
        
        # If input is s3://bucket/path, bucket_name becomes s3, upload_file_path becomes bucket/path
        result = file_uploader("content", "text/plain", "s3://bucket/path", "user")
        self.assertEqual(result, ["s3://bucket/path", True])

    def test_safe_file_name(self):
        self.assertEqual(_safe_file_name("path/to/file.txt"), "file.txt")
        self.assertEqual(_safe_file_name("file\x00name.txt"), "filename.txt")

    def test_extension_from_content_type(self):
        self.assertEqual(_extension_from_content_type("application/pdf"), "pdf")
        # On this system mimetypes.guess_extension("image/jpeg") returns .jpg
        self.assertEqual(_extension_from_content_type("image/jpeg"), "jpg")

    @patch('handlers.file_handlers.file_uploader')
    def test_file_upload_frontend_with_name(self, mock_uploader):
        mock_uploader.return_value = ["path", True]
        content = base64.b64encode(b"hello").decode("utf-8")
        
        result = file_upload_frontend_with_name(content, "text/plain", "test.txt", "user")
        self.assertTrue(result[1])
        mock_uploader.assert_called_once()

if __name__ == '__main__':
    unittest.main()
