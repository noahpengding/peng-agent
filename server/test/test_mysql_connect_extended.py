import unittest
from unittest.mock import MagicMock, patch
from utils.mysql_connect import MysqlConnect
from models.db_models import User
from sqlalchemy import Column, String, Integer

class TestMysqlConnectOperators(unittest.TestCase):
    @patch('utils.mysql_connect.get_session_maker')
    def setUp(self, mock_get_session_maker):
        self.mock_session = MagicMock()
        mock_get_session_maker.return_value = MagicMock(return_value=self.mock_session)
        self.db = MysqlConnect()

    def test_build_filter_conditions_operators(self):
        # Mock model class with columns that support comparison operators
        mock_id = MagicMock()
        mock_name = MagicMock()
        mock_age = MagicMock()
        
        # Configure comparisons to return a mock filter object
        mock_id.__ne__.return_value = "id_ne_filter"
        mock_age.__ge__.return_value = "age_ge_filter"
        mock_age.__le__.return_value = "age_le_filter"
        mock_age.__gt__.return_value = "age_gt_filter"
        mock_age.__lt__.return_value = "age_lt_filter"
        mock_name.__eq__.return_value = "name_eq_filter"

        class MockModel:
            id = mock_id
            name = mock_name
            age = mock_age

        # Test <>
        conditions = {"id<>": 1}
        filters = self.db._build_filter_conditions(MockModel, conditions)
        mock_id.__ne__.assert_called_with(1)
        self.assertIn("id_ne_filter", filters)

        # Test >=
        conditions = {"age>=": 18}
        filters = self.db._build_filter_conditions(MockModel, conditions)
        mock_age.__ge__.assert_called_with(18)
        self.assertIn("age_ge_filter", filters)

        # Test <=
        conditions = {"age<=": 65}
        filters = self.db._build_filter_conditions(MockModel, conditions)
        mock_age.__le__.assert_called_with(65)
        self.assertIn("age_le_filter", filters)

        # Test >
        conditions = {"age>": 21}
        filters = self.db._build_filter_conditions(MockModel, conditions)
        mock_age.__gt__.assert_called_with(21)
        self.assertIn("age_gt_filter", filters)

        # Test <
        conditions = {"age<": 30}
        filters = self.db._build_filter_conditions(MockModel, conditions)
        mock_age.__lt__.assert_called_with(30)
        self.assertIn("age_lt_filter", filters)

        # Test = (explicit)
        conditions = {"name=": "test"}
        filters = self.db._build_filter_conditions(MockModel, conditions)
        mock_name.__eq__.assert_called_with("test")
        self.assertIn("name_eq_filter", filters)

    def test_get_model_error(self):
        with patch('utils.mysql_connect.TABLE_MODEL_MAP', {}):
            with self.assertRaises(ValueError) as cm:
                self.db._get_model("nonexistent_table")
            self.assertEqual(str(cm.exception), "Unknown table: nonexistent_table")

    def test_read_records_no_conditions(self):
        # Testing the branch where conditions is None
        mock_query = MagicMock()
        self.mock_session.query.return_value = mock_query
        mock_query.all.return_value = []
        
        with patch('utils.mysql_connect.TABLE_MODEL_MAP', {"user": MagicMock()}):
            self.db.read_records("user")
            mock_query.filter.assert_not_called()

if __name__ == '__main__':
    unittest.main()
