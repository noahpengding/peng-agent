import unittest
from unittest.mock import patch, MagicMock
from handlers.model_handlers import (
    get_model, check_multimodal, get_reasoning_effect, 
    flip_avaliable, flip_multimodal, update_reasoning_effect,
    get_all_available_models, refresh_models
)

class TestModelHandlers(unittest.TestCase):
    @patch('handlers.model_handlers.get_table_records')
    def test_get_model(self, mock_get_records):
        mock_get_records.side_effect = [
            [{"operator": "op1"}, {"operator": "op2"}], # operators
            [{"model_name": "m1", "operator": "op1"}, {"model_name": "m2", "operator": "op2"}] # models
        ]
        
        result = get_model()
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["model_name"], "m1")

    @patch('handlers.model_handlers.get_table_record')
    def test_check_multimodal(self, mock_get_record):
        mock_get_record.return_value = {"input_image": True, "input_audio": False, "input_video": False}
        self.assertTrue(check_multimodal("model1"))
        
        mock_get_record.return_value = {"input_image": False, "input_audio": False, "input_video": False}
        self.assertFalse(check_multimodal("model2"))

    @patch('handlers.model_handlers.get_table_record')
    def test_get_reasoning_effect(self, mock_get_record):
        mock_get_record.return_value = {"reasoning_effect": "high"}
        self.assertEqual(get_reasoning_effect("m1"), "high")
        
        mock_get_record.return_value = None
        self.assertEqual(get_reasoning_effect("m2"), "not a reasoning model")

    @patch('handlers.model_handlers.get_table_record')
    @patch('handlers.model_handlers.update_table_record')
    def test_flip_avaliable(self, mock_update, mock_get):
        mock_get.return_value = {"isAvailable": True}
        result = flip_avaliable("m1")
        self.assertIn("status changed to False", result)
        mock_update.assert_called_once()

    @patch('handlers.model_handlers.get_table_record')
    @patch('handlers.model_handlers.update_table_record')
    def test_flip_multimodal(self, mock_update, mock_get):
        mock_get.return_value = {"input_image": True}
        result = flip_multimodal("m1", "input_image")
        self.assertIn("status changed to False", result)
        
        result_invalid = flip_multimodal("m1", "invalid_col")
        self.assertEqual(result_invalid, "Invalid column name: invalid_col")

    @patch('handlers.model_handlers.get_table_record')
    @patch('handlers.model_handlers.update_table_record')
    def test_update_reasoning_effect(self, mock_update, mock_get):
        mock_get.return_value = {"model_name": "m1"}
        result = update_reasoning_effect("m1", "new_effect")
        mock_update.assert_called_once()

    @patch('handlers.model_handlers.get_table_records')
    def test_get_all_available_models(self, mock_get_records):
        mock_get_records.return_value = [
            {"model_name": "m1", "isAvailable": True},
            {"model_name": "m2", "isAvailable": False}
        ]
        result = get_all_available_models()
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["model_name"], "m1")

    @patch('handlers.model_handlers.update_operator')
    @patch('handlers.model_handlers.get_model')
    @patch('handlers.model_handlers._get_local_models')
    @patch('handlers.model_handlers.get_all_operators')
    @patch('handlers.model_handlers._save_local_models')
    @patch('handlers.model_handlers.get_table_record')
    @patch('handlers.model_handlers.update_table_record')
    @patch('handlers.model_handlers.create_table_record')
    def test_refresh_models(self, mock_create, mock_update_record, mock_get_record, mock_save_local, mock_get_ops, mock_get_local, mock_get_model, mock_update_op):
        mock_get_model.return_value = []
        mock_get_local.return_value = []
        
        op = MagicMock()
        op.operator = "op1"
        mock_get_ops.return_value = [op]
        
        with patch('handlers.model_utils.get_model_instance') as mock_get_ins:
            mock_ins = mock_get_ins.return_value
            mock_ins.list_models.return_value = "gpt-4\ngpt-3.5"
            
            refresh_models()
            
            self.assertTrue(mock_create.called or mock_update_record.called)
            mock_save_local.assert_called_once()

if __name__ == '__main__':
    unittest.main()
