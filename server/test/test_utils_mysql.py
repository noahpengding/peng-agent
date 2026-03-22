import unittest
from unittest.mock import patch, MagicMock
from utils.mysql_connect import MysqlConnect
from sqlalchemy.exc import SQLAlchemyError

class TestMysqlConnect(unittest.TestCase):
    @patch('utils.mysql_connect.get_session_maker')
    def setUp(self, mock_get_session_maker):
        self.mock_session_maker = mock_get_session_maker.return_value
        self.mock_session = MagicMock()
        self.mock_session_maker.return_value = self.mock_session
        self.mysql = MysqlConnect()

    def test_create_record(self):
        mock_data = {"id": 1, "name": "test"}
        mock_record = MagicMock()
        mock_record.to_dict.return_value = mock_data
        
        with patch('utils.mysql_connect.TABLE_MODEL_MAP') as mock_map:
            mock_model = MagicMock()
            mock_model.return_value = mock_record
            mock_map.get.return_value = mock_model
            
            result = self.mysql.create_record("user", {"name": "test"})
            
            self.mock_session.add.assert_called_once()
            self.mock_session.commit.assert_called_once()
            self.assertEqual(result, mock_data)

    def test_read_records(self):
        mock_record = MagicMock()
        mock_record.to_dict.return_value = {"id": 1, "name": "test"}
        
        mock_query = MagicMock()
        self.mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [mock_record]
        
        with patch('utils.mysql_connect.TABLE_MODEL_MAP') as mock_map:
            mock_model = MagicMock()
            mock_map.get.return_value = mock_model
            result = self.mysql.read_records("user", {"name": "test"})
            
            self.mock_session.query.assert_called_once()
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]["name"], "test")

    def test_update_record(self):
        mock_query = MagicMock()
        self.mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.update.return_value = 1
        
        with patch('utils.mysql_connect.TABLE_MODEL_MAP') as mock_map:
            mock_map.get.return_value = MagicMock()
            result = self.mysql.update_record("user", {"name": "new"}, {"id": 1})
            
            self.mock_session.query.assert_called_once()
            self.mock_session.commit.assert_called_once()
            self.assertEqual(result, 1)

    def test_delete_record(self):
        mock_query = MagicMock()
        self.mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.delete.return_value = 1
        
        with patch('utils.mysql_connect.TABLE_MODEL_MAP') as mock_map:
            mock_map.get.return_value = MagicMock()
            self.mysql.delete_record("user", {"id": 1})
            
            self.mock_session.query.assert_called_once()
            self.mock_session.commit.assert_called_once()

    def test_session_rollback_on_error(self):
        self.mock_session.commit.side_effect = SQLAlchemyError("DB Error")
        
        with patch('utils.mysql_connect.TABLE_MODEL_MAP') as mock_map:
            mock_map.get.return_value = MagicMock()
            with self.assertRaises(SQLAlchemyError):
                self.mysql.create_record("user", {"name": "test"})
            
            self.mock_session.rollback.assert_called_once()

if __name__ == '__main__':
    unittest.main()
