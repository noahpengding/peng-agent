import unittest
from unittest.mock import patch, MagicMock
from handlers.model_utils import get_model_instance, get_embedding_instance

class TestModelUtils(unittest.TestCase):
    @patch('handlers.model_utils.get_operator')
    @patch('handlers.model_utils.get_reasoning_effect')
    def test_get_model_instance_openai(self, mock_reasoning, mock_get_operator):
        mock_operator = MagicMock()
        mock_operator.runtime = "openai_response"
        mock_operator.endpoint = "http://test"
        mock_operator.api_key = "test_key"
        mock_operator.org_id = "test_org"
        mock_operator.project_id = "test_proj"
        mock_get_operator.return_value = mock_operator
        mock_reasoning.return_value = None

        with patch('services.chat_models.openai_response.CustomOpenAIResponse') as mock_openai:
            get_model_instance("gpt-4o", "openai")
            mock_openai.assert_called_once()

    @patch('handlers.model_utils.get_operator')
    @patch('handlers.model_utils.get_reasoning_effect')
    def test_get_model_instance_openai_completion(self, mock_reasoning, mock_get_operator):
        mock_operator = MagicMock()
        mock_operator.runtime = "openai_completion"
        mock_operator.endpoint = "http://test"
        mock_operator.api_key = "test_key"
        mock_operator.org_id = "test_org"
        mock_operator.project_id = "test_proj"
        mock_get_operator.return_value = mock_operator
        mock_reasoning.return_value = None

        with patch('services.chat_models.openai_completion.CustomOpenAICompletion') as mock_openai:
            get_model_instance("gpt-3.5-turbo-instruct", "openai")
            mock_openai.assert_called_once()

    @patch('handlers.model_utils.get_operator')
    @patch('handlers.model_utils.get_reasoning_effect')
    def test_get_model_instance_gemini(self, mock_reasoning, mock_get_operator):
        mock_operator = MagicMock()
        mock_operator.runtime = "gemini"
        mock_operator.api_key = "test_key"
        mock_get_operator.return_value = mock_operator
        mock_reasoning.return_value = None

        with patch('services.chat_models.gemini_langchain.CustomGemini') as mock_gemini:
            get_model_instance("gemini-1.5-pro", "google")
            mock_gemini.assert_called_once()

    @patch('handlers.model_utils.get_operator')
    @patch('handlers.model_utils.get_reasoning_effect')
    def test_get_model_instance_claude(self, mock_reasoning, mock_get_operator):
        mock_operator = MagicMock()
        mock_operator.runtime = "claude"
        mock_operator.api_key = "test_key"
        mock_get_operator.return_value = mock_operator
        mock_reasoning.return_value = None

        with patch('services.chat_models.claude_langchain.CustomClaude') as mock_claude:
            get_model_instance("claude-3-opus", "anthropic")
            mock_claude.assert_called_once()

    @patch('handlers.model_utils.get_operator')
    @patch('handlers.model_utils.get_reasoning_effect')
    def test_get_model_instance_xai(self, mock_reasoning, mock_get_operator):
        mock_operator = MagicMock()
        mock_operator.runtime = "xai"
        mock_operator.endpoint = "http://test"
        mock_operator.api_key = "test_key"
        mock_get_operator.return_value = mock_operator
        mock_reasoning.return_value = None

        with patch('services.chat_models.xai_langchain.CustomXAIResponse') as mock_xai:
            get_model_instance("grok-beta", "xai")
            mock_xai.assert_called_once()

    @patch('handlers.model_utils.get_operator')
    @patch('handlers.model_utils.get_reasoning_effect')
    def test_get_model_instance_openrouter(self, mock_reasoning, mock_get_operator):
        mock_operator = MagicMock()
        mock_operator.runtime = "openrouter"
        mock_operator.endpoint = "http://test"
        mock_operator.api_key = "test_key"
        mock_get_operator.return_value = mock_operator
        mock_reasoning.return_value = None

        with patch('services.chat_models.openrouter_langchain.CustomOpenRouterCompletion') as mock_or:
            get_model_instance("meta-llama/llama-3-70b-instruct", "openrouter")
            mock_or.assert_called_once()

    @patch('handlers.model_utils.get_operator')
    def test_get_model_instance_not_found(self, mock_get_operator):
        mock_get_operator.return_value = None
        with self.assertRaises(ValueError):
            get_model_instance("model", "unknown")

    def test_get_model_instance_no_operator(self):
        result = get_model_instance("only_model_name")
        self.assertIsNone(result)

    @patch('handlers.model_utils.get_operator')
    def test_get_embedding_instance(self, mock_get_operator):
        mock_operator = MagicMock()
        mock_operator.runtime = "openai_response"
        mock_operator.endpoint = "http://test"
        mock_operator.api_key = "test_key"
        mock_get_operator.return_value = mock_operator
        
        with patch('langchain_openai.OpenAIEmbeddings') as mock_emb:
            get_embedding_instance("text-embedding-3-small", "openai")
            mock_emb.assert_called_once()

if __name__ == '__main__':
    unittest.main()
