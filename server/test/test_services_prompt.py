import unittest
from unittest.mock import patch, MagicMock
from services.prompt_generator import system_prompt, add_human_message_to_prompt, add_image_to_prompt
from langchain_core.messages import SystemMessage, HumanMessage

class TestPromptGenerator(unittest.TestCase):
    def test_system_prompt(self):
        mock_mysql = MagicMock()
        mock_mysql.read_records.return_value = [{
            "system_prompt": "You are a test bot.",
            "long_term_memory": '["likes python"]'
        }]
        
        result = system_prompt("test_user", mock_mysql)
        
        self.assertEqual(len(result), 2)
        self.assertIsInstance(result[0], SystemMessage)
        self.assertEqual(result[0].content, "You are a test bot.")
        self.assertIn("likes python", result[1].content)

    def test_add_human_message_to_prompt(self):
        result = add_human_message_to_prompt("hello")
        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], HumanMessage)
        self.assertEqual(result[0].content, "hello")

    @patch('services.prompt_generator.check_multimodal')
    def test_add_image_to_prompt_data_url(self, mock_multimodal):
        mock_multimodal.return_value = True
        images = ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="]
        
        result = add_image_to_prompt("gpt-4o", images, "user")
        
        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], HumanMessage)
        self.assertEqual(result[0].content_blocks[0]["type"], "image")

    @patch('services.prompt_generator.check_multimodal')
    def test_add_image_to_prompt_no_multimodal(self, mock_multimodal):
        mock_multimodal.return_value = False
        images = ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="]
        
        result = add_image_to_prompt("gpt-3.5", images, "user")
        self.assertEqual(result, [])

if __name__ == '__main__':
    unittest.main()
