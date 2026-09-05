import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch, sentinel

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from services.chat_models.openai_completion import CustomOpenAICompletion


def namespace(**kwargs):
    return SimpleNamespace(**kwargs)


class TestCustomOpenAICompletion(unittest.TestCase):
    def setUp(self):
        openai_patcher = patch("services.chat_models.openai_completion.OpenAI")
        log_patcher = patch("services.chat_models.openai_completion.output_log")
        self.addCleanup(openai_patcher.stop)
        self.addCleanup(log_patcher.stop)
        self.openai_class = openai_patcher.start()
        self.output_log = log_patcher.start()
        self.client = MagicMock()
        self.openai_class.return_value = self.client
        self.model = CustomOpenAICompletion(
            model="test-model",
            reasoning_effect="high",
            temperature=0.25,
            max_tokens=512,
            base_url="https://provider.example/v1",
            api_key="secret",
            organization_id="org-1",
            project_id="project-1",
        )

    def test_initializes_provider_client(self):
        self.openai_class.assert_called_once_with(
            api_key="secret",
            organization="org-1",
            project="project-1",
            base_url="https://provider.example/v1",
        )
        self.assertIs(self.model.client, self.client)
        self.assertEqual(self.model.model_name, "test-model")

    def test_openai_prepare_translates_tools_and_reasoning(self):
        parameters = {
            "type": "object",
            "properties": {"city": {"type": "string"}},
        }
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "weather",
                    "description": "Get weather",
                    "parameters": parameters,
                },
            }
        ]

        result = self.model._openai_prepare(
            [SystemMessage(content="system"), HumanMessage(content="hello")],
            streaming=True,
            tools=tools,
            tool_choice="required",
        )

        self.assertEqual(result["model"], "test-model")
        self.assertTrue(result["stream"])
        self.assertEqual(
            result["messages"],
            [
                {"role": "system", "content": "system"},
                {"role": "user", "content": "hello"},
            ],
        )
        self.assertEqual(result["reasoning_effort"], "high")
        self.assertEqual(result["tool_choice"], "required")
        self.assertEqual(
            result["extra_headers"],
            {
                "HTTP-Referer": "https://agent.tenawalcott.com",
                "X-Title": "Peng Agent",
            },
        )
        self.assertEqual(
            result["tools"],
            [
                {
                    "type": "function",
                    "function": {
                        "name": "weather",
                        "description": "Get weather",
                        "parameters": {
                            "type": "object",
                            "properties": {"city": {"type": "string"}},
                            "additionalProperties": False,
                        },
                    },
                    "strict": False,
                }
            ],
        )
        self.output_log.assert_called_once()

    def test_openai_prepare_omits_optional_reasoning_and_tools(self):
        self.model.reasoning_effect = "not a reasoning model"

        result = self.model._openai_prepare([], streaming=False)

        self.assertFalse(result["stream"])
        self.assertNotIn("reasoning_effort", result)
        self.assertNotIn("tools", result)
        self.assertNotIn("tool_choice", result)

    def test_generate_stop_response(self):
        self.client.chat.completions.create.return_value = namespace(
            choices=[
                namespace(
                    finish_reason="stop",
                    message=namespace(content="completed answer"),
                )
            ]
        )

        result = self.model._generate([HumanMessage(content="question")])

        self.assertEqual(
            result.generations[0].message.content_blocks,
            [{"type": "text", "text": "completed answer"}],
        )
        request = self.client.chat.completions.create.call_args.kwargs
        self.assertFalse(request["stream"])

    def test_generate_tool_call_response(self):
        tool_call = namespace(
            id="call-1",
            name="weather",
            function=namespace(arguments='{"city": "Toronto"}'),
        )
        self.client.chat.completions.create.return_value = namespace(
            choices=[
                namespace(
                    finish_reason="tool_calls",
                    message=namespace(tool_calls=[tool_call]),
                )
            ]
        )

        result = self.model._generate([HumanMessage(content="weather?")])

        self.assertEqual(
            result.generations[0].message.content_blocks,
            [
                {
                    "type": "tool_call",
                    "name": "weather",
                    "args": {"city": "Toronto"},
                    "id": "call-1",
                }
            ],
        )

    def test_generate_legacy_function_call_and_parse_error(self):
        valid_call = namespace(
            id="call-valid",
            function=namespace(name="lookup", arguments="{'query': 'peng'}"),
        )
        invalid_call = namespace(
            id="call-invalid",
            function=namespace(name="lookup", arguments="{invalid"),
        )

        for function_call, expected_type in (
            (valid_call, "tool_call"),
            (invalid_call, "tool_call"),
        ):
            with self.subTest(function_call_id=function_call.id):
                self.client.chat.completions.create.return_value = namespace(
                    choices=[
                        namespace(
                            finish_reason="function_call",
                            message=namespace(function_call=[function_call]),
                        )
                    ]
                )

                result = self.model._generate([HumanMessage(content="question")])
                block = result.generations[0].message.content_blocks[0]

                self.assertEqual(block["type"], expected_type)
                if function_call.id == "call-valid":
                    self.assertEqual(block["args"], {"query": "peng"})
                else:
                    self.assertEqual(block["args"], {})

    def test_stream_accumulates_tool_call_and_yields_content_types(self):
        first_tool_part = namespace(
            id="call-2",
            function=namespace(name="weather", arguments="{'city': "),
        )
        second_tool_part = namespace(
            id=None,
            function=namespace(name=None, arguments="'Toronto'}"),
        )
        self.client.chat.completions.create.return_value = [
            namespace(
                choices=[
                    namespace(
                        finish_reason=None,
                        delta=namespace(tool_calls=[first_tool_part]),
                    )
                ]
            ),
            namespace(
                choices=[
                    namespace(
                        finish_reason=None,
                        delta=namespace(tool_calls=[second_tool_part]),
                    )
                ]
            ),
            namespace(
                choices=[namespace(finish_reason="tool_calls", delta=namespace())]
            ),
            namespace(
                choices=[
                    namespace(
                        finish_reason=None,
                        delta=namespace(reasoning_content="first reason"),
                    )
                ]
            ),
            namespace(
                choices=[
                    namespace(
                        finish_reason=None,
                        delta=namespace(reasoning="second reason"),
                    )
                ]
            ),
            namespace(
                choices=[
                    namespace(
                        finish_reason=None,
                        delta=namespace(content="answer token"),
                    )
                ]
            ),
            namespace(
                choices=[namespace(finish_reason="stop", delta=namespace())]
            ),
        ]

        chunks = list(self.model._stream([HumanMessage(content="question")]))

        self.assertEqual(len(chunks), 4)
        self.assertEqual(
            chunks[0].message.content_blocks[0],
            {
                "type": "tool_call",
                "name": "weather",
                "args": {"city": "Toronto"},
                "id": "call-2",
            },
        )
        self.assertEqual(
            [chunk.message.content_blocks[0]["type"] for chunk in chunks[1:]],
            ["reasoning", "reasoning", "text"],
        )
        self.assertEqual(
            chunks[1].message.content_blocks[0]["reasoning"], "first reason"
        )
        self.assertEqual(
            chunks[2].message.content_blocks[0]["reasoning"], "second reason"
        )
        self.assertEqual(chunks[3].message.content_blocks[0]["text"], "answer token")
        request = self.client.chat.completions.create.call_args.kwargs
        self.assertTrue(request["stream"])

    def test_stream_invalid_tool_arguments_yields_error_text(self):
        tool_part = namespace(
            id="call-bad",
            function=namespace(name="broken", arguments="{invalid"),
        )
        self.client.chat.completions.create.return_value = [
            namespace(
                choices=[
                    namespace(
                        finish_reason=None,
                        delta=namespace(tool_calls=[tool_part]),
                    )
                ]
            ),
            namespace(
                choices=[namespace(finish_reason="tool_calls", delta=namespace())]
            ),
        ]

        chunks = list(self.model._stream([]))

        block = chunks[0].message.content_blocks[0]
        self.assertEqual(block["type"], "tool_call")

    def test_bind_tools_formats_and_binds_options(self):
        raw_tools = [
            {"kind": "function"},
            {"kind": "legacy"},
            {"kind": "unknown"},
        ]
        formatted_tools = [
            {"type": "function", "function": {"name": "weather"}},
            {"name": "legacy-tool"},
            {"type": "custom"},
        ]

        with (
            patch(
                "services.chat_models.openai_completion.convert_to_openai_tool",
                side_effect=formatted_tools,
            ) as convert_tool,
            patch.object(
                BaseChatModel, "bind", autospec=True, return_value=sentinel.bound
            ) as bind,
        ):
            result = self.model.bind_tools(
                raw_tools,
                tool_choice="auto",
                strict=True,
                parallel_tool_calls=False,
                custom_option="value",
            )

        self.assertIs(result, sentinel.bound)
        self.assertEqual(
            convert_tool.call_args_list,
            [call(tool, strict=True) for tool in raw_tools],
        )
        bind.assert_called_once_with(
            self.model,
            custom_option="value",
            parallel_tool_calls=False,
            tools=formatted_tools,
        )

    def test_model_and_parameter_helpers(self):
        self.client.models.list.return_value = namespace(
            data=[namespace(id="model-a"), namespace(id="model-b")]
        )

        self.assertEqual(self.model.list_models(), "model-a\nmodel-b")
        parameters = self.model.list_parameters()
        self.assertIn("model_id: test-model", parameters)
        self.assertIn("temperature: 0.25", parameters)
        self.assertIn("max_tokens: 512", parameters)
        self.assertEqual(
            self.model.set_parameters("temperature", "0.75"),
            "Temperature set to 0.75",
        )
        self.assertEqual(self.model.temperature, 0.75)
        self.assertEqual(
            self.model.set_parameters("unknown", "value"),
            "Invalid parameter: unknown, value",
        )
        self.output_log.assert_called_with("Invalid parameter: unknown", "error")

    def test_model_and_max_token_parameter_branches_surface_missing_aliases(self):
        with self.assertRaises(AttributeError):
            self.model.set_parameters("model", "model-b")
        self.assertEqual(self.model.model_name, "model-b")

        with self.assertRaises(AttributeError):
            self.model.set_parameters("max_completion_tokens", "1024")
        self.assertEqual(self.model.max_tokens, 1024)

    def test_prompt_translate_all_message_types(self):
        messages = [
            SystemMessage(content="system prompt"),
            AIMessage(
                content_blocks=[
                    {"type": "text", "text": "answer"},
                    {"type": "reasoning", "reasoning": "because"},
                    {
                        "type": "tool_call",
                        "name": "weather",
                        "args": {"city": "Toronto"},
                        "id": "call-3",
                    },
                ]
            ),
            HumanMessage(content="next question"),
            ToolMessage(content="sunny", tool_call_id="call-3"),
        ]

        result = self.model._prompt_translate(messages)

        self.assertEqual(result[0], {"role": "system", "content": "system prompt"})
        self.assertEqual(result[1], {"role": "assistant", "content": "answer"})
        self.assertEqual(
            result[2],
            {
                "role": "assistant",
                "content": "answer",
                "reasoning_content": "because",
            },
        )
        self.assertEqual(result[3]["tool_calls"][0]["id"], "call-3")
        self.assertEqual(
            result[3]["tool_calls"][0]["function"],
            {"name": "weather", "arguments": '{"city": "Toronto"}'},
        )
        self.assertEqual(result[4], {"role": "user", "content": "next question"})
        self.assertEqual(
            result[5],
            {"role": "tool", "content": "sunny", "tool_call_id": "call-3"},
        )

    def test_prompt_translate_image_and_empty_ai_history(self):
        image = HumanMessage(
            content=[
                {
                    "type": "image",
                    "mime_type": "image/png",
                    "base64": b"YWJj",
                }
            ]
        )
        tool_first = AIMessage(
            content_blocks=[
                {
                    "type": "tool_call",
                    "name": "lookup",
                    "args": {"query": "peng"},
                    "id": "call-4",
                }
            ]
        )
        reasoning_first = AIMessage(
            content_blocks=[{"type": "reasoning", "reasoning": "thinking"}]
        )

        image_result = self.model._prompt_translate([image])
        tool_result = self.model._prompt_translate([tool_first])
        reasoning_result = self.model._prompt_translate([reasoning_first])

        self.assertEqual(
            image_result,
            [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": "data:image/png;base64,YWJj",
                                "detail": "auto",
                            },
                        }
                    ],
                }
            ],
        )
        self.assertEqual(tool_result[0]["content"], "")
        self.assertEqual(tool_result[0]["reasoning_content"], "")
        self.assertEqual(reasoning_result[0]["content"], "")

    def test_langchain_metadata(self):
        self.assertEqual(self.model._llm_type, "OpenAI Completion")
        self.assertEqual(
            self.model._identifying_params,
            {
                "model_name": "test-model",
                "temperature": 0.25,
                "max_tokens": 512,
            },
        )


if __name__ == "__main__":
    unittest.main()
