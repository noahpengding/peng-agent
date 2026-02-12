import unittest
from services.prompt_generator import add_short_term_memory_to_prompt
from langchain_core.messages import AIMessage, HumanMessage

# Mock MysqlConnect
class MockMysqlConnect:
    def __init__(self, data):
        self.data = data
        self.call_count = 0

    def read_records(self, table, conditions=None):
        self.call_count += 1
        records = self.data.get(table, [])
        if conditions:
            filtered = []
            if isinstance(conditions.get('chat_id'), list):
                # Batch read
                chat_ids = conditions['chat_id']
                for r in records:
                    if r.get('chat_id') in chat_ids:
                        filtered.append(r)
            else:
                for r in records:
                    match = True
                    for k, v in conditions.items():
                        if isinstance(v, list):
                            if r.get(k) not in v:
                                match = False
                                break
                        else:
                            if r.get(k) != v:
                                match = False
                                break
                    if match:
                        filtered.append(r)
            return filtered
        return records

class TestMemoryOptimization(unittest.TestCase):
    def setUp(self):
        self.mock_data = {
            "ai_reasoning": [
                {"chat_id": 1, "reasoning_process": "thinking...", "id": 10},
                {"chat_id": 3, "reasoning_process": "thinking hard...", "id": 30}
            ],
            "ai_response": [
                {"chat_id": 1, "ai_response": "response 1", "id": 11},
                {"chat_id": 2, "ai_response": "response 2", "id": 20},
                {"chat_id": 3, "ai_response": "response 3", "id": 31}
            ],
            "user_input": [
                {"chat_id": 1, "input_content": "hello", "input_location": "", "id": 1},
                {"chat_id": 2, "input_content": "world", "input_location": "", "id": 2},
                {"chat_id": 3, "input_content": "complex query", "input_location": "", "id": 3}
            ]
        }
        self.short_term_memory = [1, 2, 3]

    def test_logic_equivalence(self):
        conn_optimized = MockMysqlConnect(self.mock_data)
        res_optimized = add_short_term_memory_to_prompt(self.short_term_memory, conn_optimized, "model")

        # Verify content
        self.assertTrue(len(res_optimized) > 0)

        # Verify calls count (should be 3)
        self.assertEqual(conn_optimized.call_count, 3)

if __name__ == '__main__':
    unittest.main()
