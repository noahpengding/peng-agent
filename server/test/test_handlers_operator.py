import unittest
from unittest.mock import patch
from handlers.operator_handlers import get_operator, get_all_operators

class TestOperatorHandlers(unittest.TestCase):
    @patch('handlers.operator_handlers.get_table_record')
    def test_get_operator_success(self, mock_get_record):
        mock_get_record.return_value = {
            "operator": "op1",
            "runtime": "openai_response",
            "endpoint": "http://test",
            "api_key": "test_key"
        }
        op = get_operator("op1")
        self.assertEqual(op.operator, "op1")
        self.assertEqual(op.runtime, "openai_response")

    @patch('handlers.operator_handlers.get_table_record')
    def test_get_operator_not_found(self, mock_get_record):
        mock_get_record.return_value = None
        self.assertIsNone(get_operator("unknown"))

    @patch('handlers.operator_handlers.get_table_records')
    def test_get_all_operators(self, mock_get_records):
        mock_get_records.return_value = [
            {"operator": "op1", "runtime": "r1", "endpoint": "e1", "api_key": "k1"},
            {"operator": "op2", "runtime": "r2", "endpoint": "e2", "api_key": "k2"}
        ]
        ops = get_all_operators()
        self.assertEqual(len(ops), 2)
        self.assertEqual(ops[0].operator, "op1")

if __name__ == '__main__':
    unittest.main()
