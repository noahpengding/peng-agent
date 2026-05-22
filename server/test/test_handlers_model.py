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
        _ = update_reasoning_effect("m1", "new_effect")
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
    @patch('handlers.model_handlers.get_all_operators')
    @patch('handlers.model_handlers.get_table_record')
    @patch('handlers.model_handlers.create_table_record')
    def test_refresh_models(self, mock_create, mock_get_record, mock_get_ops, mock_get_model, mock_update_op):
        mock_get_model.return_value = []
        
        op = MagicMock()
        op.operator = "op1"
        mock_get_ops.return_value = [op]
        mock_get_record.return_value = None
        
        with patch('handlers.model_utils.get_model_instance') as mock_get_ins:
            mock_ins = mock_get_ins.return_value
            mock_ins.list_models.return_value = "gpt-4\ngpt-3.5"
            
            refresh_models()
            
            self.assertEqual(mock_create.call_count, 2)
            from models.model_config import ModelConfig
            expected_model = ModelConfig(
                operator="op1",
                model_name="op1/gpt-4",
                isAvailable=False,
                reasoning_effect="not a reasoning model",
            )
            mock_create.assert_any_call(
                "model",
                expected_model.to_dict(),
                redis_id="model_name",
                db_backed=False
            )


    @patch('handlers.model_handlers.get_table_records')
    @patch('handlers.model_handlers._save_local_models')
    def test_save_models_to_s3(self, mock_save_local, mock_get_records):
        mock_get_records.return_value = [
            {"operator": "op1", "model_name": "op1/m1", "isAvailable": True, "reasoning_effect": "not a reasoning model"}
        ]
        from handlers.model_handlers import save_models_to_s3
        save_models_to_s3()
        mock_save_local.assert_called_once()

    @patch('handlers.model_handlers._get_local_models')
    @patch('handlers.model_handlers.get_table_record')
    @patch('handlers.model_handlers.create_table_record')
    def test_load_models_from_s3(self, mock_create, mock_get_record, mock_get_local):
        from models.model_config import ModelConfig
        mock_get_local.return_value = [
            ModelConfig(operator="op1", model_name="op1/m1", isAvailable=True)
        ]
        mock_get_record.return_value = None
        from handlers.model_handlers import load_models_from_s3
        load_models_from_s3()
        mock_create.assert_called_once_with(
            "model",
            mock_get_local.return_value[0].to_dict(),
            redis_id="model_name",
            db_backed=False
        )

if __name__ == '__main__':
    unittest.main()

