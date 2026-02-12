import unittest
from unittest.mock import MagicMock, patch
from utils.mysql_connect import MysqlConnect

class TestMysqlConnectInClause(unittest.TestCase):
    @patch('utils.mysql_connect.get_session_maker')
    def test_in_clause(self, mock_get_session_maker):
        # Setup mocks
        mock_session = MagicMock()
        mock_get_session_maker.return_value = MagicMock(return_value=mock_session)

        db = MysqlConnect()

        # Mock the model and column
        mock_model_class = MagicMock()
        mock_column = MagicMock()
        setattr(mock_model_class, "some_field", mock_column)

        # Test case 1: List with default key
        conditions = {"some_field": [1, 2, 3]}
        db._build_filter_conditions(mock_model_class, conditions)
        mock_column.in_.assert_called_with([1, 2, 3])

        # Test case 2: List with '=' suffix (e.g. 'some_field=')
        # This currently fails without the fix.
        conditions_equal = {"some_field=": [4, 5, 6]}
        db._build_filter_conditions(mock_model_class, conditions_equal)
        mock_column.in_.assert_called_with([4, 5, 6])

        # Test case 3: List with tuple
        conditions_tuple = {"some_field": (7, 8)}
        db._build_filter_conditions(mock_model_class, conditions_tuple)
        mock_column.in_.assert_called_with((7, 8))

if __name__ == '__main__':
    unittest.main()
