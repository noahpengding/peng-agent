import unittest
from unittest.mock import patch, MagicMock
from services.prompt_generator import system_prompt, add_human_message_to_prompt, add_image_to_prompt
from langchain_core.messages import SystemMessage, HumanMessage

class TestPromptGenerator(unittest.TestCase):
    @patch('services.prompt_generator.datetime')
    def test_system_prompt_with_tools(self, mock_datetime):
        mock_datetime.now.return_value.strftime.return_value = "2026-07-12"
        mock_mysql = MagicMock()
        mock_mysql.read_records.return_value = [{
            "system_prompt": "You are a test bot.",
            "long_term_memory": '["likes python"]'
        }]
        test_ip_address = "129.153.54.150"
        
        result = system_prompt("test_user", mock_mysql, ["web_search"], test_ip_address)

        print(result[0].content)
        self.assertEqual(len(result), 2)
        self.assertIsInstance(result[0], SystemMessage)
        with open("services/prompts/markdown_format.md", "r") as f:
            markdown_format = f.read()
        self.assertEqual(
            result[0].content,
            "You are a test bot."
            "If you need to use any tools, you need to use it correctly. "
            "You need to call the exact tool name and provide the correct "
            "parameters with the correct parameter names. You need to check "
            "the tools' description and parameter (including parameter name, "
            "type, and description) before using the tools. "
            + markdown_format
            + f" Today is 2026-07-12. You get request from IP address {test_ip_address}. The location is Vaughan, Ontario, Canada.",
        )
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
