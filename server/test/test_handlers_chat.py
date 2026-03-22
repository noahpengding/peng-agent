import unittest
from unittest.mock import patch, MagicMock
from handlers.chat_handlers import _generate_prompt_params, chat_handler
from models.chat_config import ChatConfig
import json

class TestChatHandlers(unittest.IsolatedAsyncioTestCase):
    @patch('handlers.chat_handlers.prompt_generator')
    def test_generate_prompt_params(self, mock_prompt_gen):
        mock_mysql = MagicMock()
        mock_mysql.create_record.return_value = {"id": 123}
        mock_prompt_gen.system_prompt.return_value = [{"role": "system", "content": "sys"}]
        mock_prompt_gen.add_short_term_memory_to_prompt.return_value = []
        mock_prompt_gen.add_image_to_prompt.return_value = []
        mock_prompt_gen.add_knowledge_base_to_prompt.return_value = []
        mock_prompt_gen.add_human_message_to_prompt.return_value = [{"role": "user", "content": "hi"}]

        chat_config = ChatConfig(operator="op", base_model="model", tools_name=[])
        
        prompt, chat_id = _generate_prompt_params(
            "user", "hi", "kb", [], chat_config, mock_mysql
        )
        
        self.assertEqual(chat_id, 123)
        self.assertGreater(len(prompt), 0)
        mock_mysql.create_record.assert_called()

    @patch('handlers.chat_handlers.MysqlConnect')
    @patch('handlers.chat_handlers.PengAgent')
    @patch('handlers.chat_handlers._generate_prompt_params')
    async def test_chat_handler(self, mock_gen_params, mock_agent_class, mock_mysql_class):
        _ = mock_mysql_class.return_value
        mock_gen_params.return_value = ([{"role": "user", "content": "hi"}], 123)
        
        mock_agent = mock_agent_class.return_value
        
        # Mocking async generator
        async def mock_astream(*args, **kwargs):
            yield {"call_model": {"messages": {"type": "text", "text": "hello"}}}
            
        mock_agent.astream.side_effect = mock_astream
        
        chat_config = ChatConfig(operator="op", base_model="model", tools_name=[])
        
        results = []
        async for chunk in chat_handler("user", "hi", "kb", [], chat_config):
            results.append(json.loads(chunk))
            
        self.assertTrue(any("Agent Created" in str(r.get("chunk")) for r in results))
        self.assertTrue(any("hello" in str(r.get("chunk")) for r in results))
        self.assertTrue(any(r.get("done") is True for r in results))

if __name__ == '__main__':
    unittest.main()
