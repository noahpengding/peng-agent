import base64
import unittest
from types import SimpleNamespace
from unittest.mock import call, patch, sentinel

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

from services.chat_models.openai_response import CustomOpenAIResponse


class TestCustomOpenAIResponse(unittest.TestCase):
    def setUp(self):
        self.openai_patcher = patch(
            "services.chat_models.openai_response.OpenAI"
        )
        self.mock_openai = self.openai_patcher.start()
        self.addCleanup(self.openai_patcher.stop)

        self.client = self.mock_openai.return_value
        self.model = CustomOpenAIResponse(
            model="gpt-4o",
            reasoning_effect="not a reasoning model",
            temperature=0.25,
            max_tokens=512,
            base_url="https://openai.example.test",
            api_key="secret",
            organization_id="org-1",
            project_id="project-1",
        )

    def test_init_builds_provider_client(self):
        self.mock_openai.assert_called_once_with(
            api_key="secret",
            organization="org-1",
            project="project-1",
            base_url="https://openai.example.test",
        )
        self.assertIs(self.model.client, self.client)

    @patch("services.chat_models.openai_response.output_log")
    def test_openai_prepare_basic_request(self, mock_output_log):
        prompt = [SystemMessage(content="Be concise")]

        result = self.model._openai_prepare(prompt)

        self.assertEqual(
            result,
            {
                "model": "gpt-4o",
                "input": [{"role": "system", "content": "Be concise"}],
                "stream": False,
            },
        )
        mock_output_log.assert_called_once_with(
            "Translated prompt: "
            "[{'role': 'system', 'content': 'Be concise'}]",
            "debug",
        )

    def test_openai_prepare_adds_reasoning_tools_and_tool_choice(self):
        self.model.model_name = "o3-deep-research"
        self.model.reasoning_effect = "high"
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get the weather",
                    "parameters": {
                        "type": "object",
                        "properties": {"city": {"type": "string"}},
                    },
                },
            }
        ]

        result = self.model._openai_prepare(
            [HumanMessage(content="Weather?")],
            streaming=True,
            tools=tools,
            tool_choice="required",
        )

        self.assertEqual(
            result["reasoning"], {"effort": "high", "summary": "auto"}
        )
        self.assertTrue(result["stream"])
        self.assertEqual(result["tool_choice"], "required")
        self.assertEqual(
            result["tools"],
            [
                {
                    "type": "function",
                    "name": "get_weather",
                    "description": "Get the weather",
                    "parameters": {
                        "type": "object",
                        "properties": {"city": {"type": "string"}},
                        "additionalProperties": False,
                    },
                    "strict": False,
                },
                {"type": "web_search_preview"},
                {
                    "type": "code_interpreter",
                    "container": {"type": "auto"},
                },
            ],
        )
        self.assertFalse(
            tools[0]["function"]["parameters"]["additionalProperties"]
        )

    def test_openai_prepare_creates_tool_list_for_deep_research(self):
        self.model.model_name = "deep-research-preview"

        result = self.model._openai_prepare([])

        self.assertEqual(
            result["tools"],
            [
                {"type": "web_search_preview"},
                {
                    "type": "code_interpreter",
                    "container": {"type": "auto"},
                },
            ],
        )

    def test_generate_translates_message_response(self):
        self.client.responses.create.return_value = SimpleNamespace(
            output=[
                SimpleNamespace(
                    type="message",
                    content=[SimpleNamespace(text="Final answer")],
                )
            ]
        )

        result = self.model._generate([HumanMessage(content="Question")])

        self.client.responses.create.assert_called_once_with(
            model="gpt-4o",
            input=[{"role": "user", "content": "Question"}],
            stream=False,
        )
        message = result.generations[0].message
        self.assertEqual(
            message.content_blocks,
            [{"type": "text", "text": "Final answer"}],
        )

    def test_generate_translates_function_call_response(self):
        self.client.responses.create.return_value = SimpleNamespace(
            output=[
                SimpleNamespace(
                    type="function_call",
                    name="get_weather",
                    arguments="{'city': 'Toronto'}",
                    call_id="call-1",
                )
            ]
        )

        result = self.model._generate([HumanMessage(content="Question")])

        self.assertEqual(
            result.generations[0].message.content_blocks,
            [
                {
                    "type": "tool_call",
                    "name": "get_weather",
                    "args": {"city": "Toronto"},
                    "id": "call-1",
                }
            ],
        )

    def test_generate_image_decodes_first_image(self):
        expected = b"fake png bytes"
        self.client.images.generate.return_value = SimpleNamespace(
            data=[
                SimpleNamespace(
                    b64_json=base64.b64encode(expected).decode("ascii")
                )
            ]
        )

        result = self.model.generate_image("A penguin")

        self.client.images.generate.assert_called_once_with(
            model="gpt-4o", prompt="A penguin"
        )
        self.assertEqual(result, expected)

    def test_generate_image_returns_none_without_data(self):
        for data in (None, []):
            with self.subTest(data=data):
                self.client.images.generate.return_value = SimpleNamespace(
                    data=data
                )
                self.assertIsNone(self.model.generate_image("A penguin"))

    def test_stream_translates_supported_events_and_skips_empty_events(self):
        self.client.responses.create.return_value = iter(
            [
                SimpleNamespace(
                    type="response.output_text.delta", delta="Hello"
                ),
                SimpleNamespace(type="response.output_text.delta", delta=""),
                SimpleNamespace(
                    type="response.reasoning_summary_text.delta",
                    delta="Because",
                ),
                SimpleNamespace(
                    type="response.reasoning_summary_text.delta", delta=None
                ),
                SimpleNamespace(
                    type="response.output_item.done",
                    item=SimpleNamespace(
                        type="function_call",
                        name="lookup",
                        arguments="{'query': 'penguin'}",
                        call_id="call-2",
                    ),
                ),
                SimpleNamespace(type="response.output_item.done", item=None),
                SimpleNamespace(
                    type="response.output_item.done",
                    item=SimpleNamespace(type="message"),
                ),
                SimpleNamespace(type="response.created"),
            ]
        )

        chunks = list(self.model._stream([HumanMessage(content="Hello")]))

        self.client.responses.create.assert_called_once_with(
            model="gpt-4o",
            input=[{"role": "user", "content": "Hello"}],
            stream=True,
        )
        self.assertEqual(len(chunks), 3)
        self.assertEqual(
            chunks[0].message.content_blocks,
            [
                {
                    "type": "text",
                    "text": "Hello",
                    "annotations": [],
                }
            ],
        )
        self.assertEqual(
            chunks[1].message.content_blocks,
            [{"type": "reasoning", "reasoning": "Because", "extras": {}}],
        )
        self.assertEqual(
            chunks[2].message.content_blocks,
            [
                {
                    "type": "tool_call",
                    "name": "lookup",
                    "args": {"query": "penguin"},
                    "id": "call-2",
                }
            ],
        )

    @patch("services.chat_models.openai_response.convert_to_openai_tool")
    def test_bind_tools_formats_schemas_and_passes_parallel_setting(
        self, mock_convert
    ):
        function_tool = {
            "type": "function",
            "function": {
                "name": "lookup",
                "parameters": {"type": "object"},
            },
        }
        named_tool = {
            "type": "web_search_preview",
            "name": "web_search",
            "properties": {},
        }
        mock_convert.side_effect = [function_tool, named_tool]

        with patch.object(
            BaseChatModel, "bind", autospec=True, return_value=sentinel.binding
        ) as mock_bind:
            result = self.model.bind_tools(
                [sentinel.function_tool, sentinel.named_tool],
                strict=True,
                parallel_tool_calls=False,
            )

        self.assertIs(result, sentinel.binding)
        self.assertEqual(
            mock_convert.call_args_list,
            [
                call(sentinel.function_tool, strict=True),
                call(sentinel.named_tool, strict=True),
            ],
        )
        self.assertEqual(
            function_tool,
            {
                "type": "function",
                "function": {
                    "name": "lookup",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": [],
                    },
                },
                "properties": {"additionalProperties": False},
                "required": [],
            },
        )
        mock_bind.assert_called_once_with(
            self.model,
            tools=[function_tool, named_tool],
            parallel_tool_calls=False,
        )

    def test_list_models_joins_model_ids(self):
        self.client.models.list.return_value = SimpleNamespace(
            data=[SimpleNamespace(id="gpt-4o"), SimpleNamespace(id="o3")]
        )

        self.assertEqual(self.model.list_models(), "gpt-4o\no3")

    def test_model_metadata_and_parameter_helpers(self):
        self.assertEqual(self.model._llm_type, "OpenAI Response")
        self.assertEqual(
            self.model._identifying_params,
            {
                "model_name": "gpt-4o",
                "temperature": 0.25,
                "max_tokens": 512,
            },
        )
        parameter_listing = self.model.list_parameters()
        self.assertIn("model_id: gpt-4o", parameter_listing)
        self.assertIn("temperature: 0.25", parameter_listing)
        self.assertIn("max_tokens: 512", parameter_listing)
        self.assertIn(
            "reasoning_effect: not a reasoning model", parameter_listing
        )

        self.assertEqual(
            self.model.set_parameters("temperature", "0.75"),
            "Temperature set to 0.75",
        )
        self.assertEqual(self.model.temperature, 0.75)

    @patch("services.chat_models.openai_response.output_log")
    def test_set_parameters_rejects_unknown_name(self, mock_output_log):
        result = self.model.set_parameters("unknown", "value")

        self.assertEqual(result, "Invalid parameter: unknown, value")
        mock_output_log.assert_called_once_with(
            "Invalid parameter: unknown", "error"
        )

    def test_prompt_translate_handles_all_supported_message_types(self):
        messages = [
            AIMessage(
                content_blocks=[
                    {
                        "type": "tool_call",
                        "name": "lookup",
                        "args": {"query": "penguin"},
                        "id": "call-3",
                    }
                ]
            ),
            AIMessage(
                content_blocks=[{"type": "text", "text": "A result"}]
            ),
            AIMessage(
                content_blocks=[
                    {"type": "reasoning", "reasoning": "A thought"}
                ]
            ),
            SystemMessage(content="System rules"),
            HumanMessage(content="A question"),
            HumanMessage(
                content_blocks=[
                    {
                        "type": "image",
                        "mime_type": "image/png",
                        "base64": b"aW1hZ2U=",
                    },
                    {
                        "type": "image",
                        "mime_type": "image/jpeg",
                        "base64": b"anBlZw==",
                    },
                ]
            ),
            ToolMessage(content="tool result", tool_call_id="call-3"),
        ]

        result = self.model._prompt_translate(messages)

        self.assertEqual(
            result,
            [
                {
                    "type": "function_call",
                    "name": "lookup",
                    "call_id": "call-3",
                    "arguments": "{'query': 'penguin'}",
                },
                {"role": "assistant", "content": "A result"},
                {"role": "assistant", "content": "A thought"},
                {"role": "system", "content": "System rules"},
                {"role": "user", "content": "A question"},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_image",
                            "image_url": "data:image/png;base64,aW1hZ2U=",
                        },
                        {
                            "type": "input_image",
                            "image_url": "data:image/jpeg;base64,anBlZw==",
                        },
                    ],
                },
                {
                    "type": "function_call_output",
                    "call_id": "call-3",
                    "output": "tool result",
                },
            ],
        )


if __name__ == "__main__":
    unittest.main()
