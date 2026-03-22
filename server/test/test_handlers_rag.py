import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from handlers.rag_handlers import get_rag, get_collections, index_file

class TestRagHandlers(unittest.IsolatedAsyncioTestCase):
    @patch('handlers.rag_handlers.get_table_records')
    def test_get_rag(self, mock_get_records):
        mock_get_records.return_value = [{"knowledge_base": "kb1"}]
        result = get_rag()
        self.assertEqual(result, [{"knowledge_base": "kb1"}])

    @patch('handlers.rag_handlers.get_table_records')
    def test_get_collections(self, mock_get_records):
        mock_get_records.return_value = [{"knowledge_base": "kb1"}, {"knowledge_base": "kb1"}]
        result = get_collections()
        self.assertEqual(result, {"kb1"})

    @patch('handlers.rag_handlers.RagBuilder')
    async def test_index_file(self, mock_builder_class):
        mock_builder = mock_builder_class.return_value
        mock_builder.file_process = AsyncMock()
        
        result = await index_file("user", "path", "pdf", "coll")
        self.assertIn("File path is put into the collection coll", result)
        mock_builder.file_process.assert_called_once_with("path", "pdf")

if __name__ == '__main__':
    unittest.main()
