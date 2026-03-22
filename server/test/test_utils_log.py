import unittest
from unittest.mock import patch, MagicMock
from utils.log import output_log

class TestLog(unittest.TestCase):
    @patch('utils.log.logger')
    def test_output_log_info(self, mock_logger):
        output_log("test info", "info")
        mock_logger.info.assert_called_once_with("test info")

    @patch('utils.log.logger')
    def test_output_log_warning(self, mock_logger):
        output_log("test warning", "warning")
        mock_logger.warning.assert_called_once_with("test warning")

    @patch('utils.log.logger')
    def test_output_log_error(self, mock_logger):
        output_log("test error", "error")
        mock_logger.error.assert_called_once_with("test error")

    @patch('utils.log.logger')
    def test_output_log_debug(self, mock_logger):
        output_log("test debug", "debug")
        mock_logger.debug.assert_called_once_with("test debug")

    @patch('utils.log.logger')
    def test_output_log_default(self, mock_logger):
        output_log("test default", "unknown")
        mock_logger.info.assert_called_once_with("test default")

if __name__ == '__main__':
    unittest.main()
