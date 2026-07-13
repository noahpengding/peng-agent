import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from services.chat_models import (
    claude_langchain,
    gemini_langchain,
    openrouter_langchain,
    xai_langchain,
)


def namespace(**kwargs):
    return SimpleNamespace(**kwargs)


def ai_messages():
    return [
        AIMessage(content_blocks=[{"type": "text", "text": "answer"}]),
        AIMessage(
            content_blocks=[
                {
                    "type": "tool_call",
                    "name": "lookup",
                    "args": {"city": "Toronto"},
                    "id": "call-1",
                    "extras": {"thought_signature": b"tool-signature"},
                }
            ]
        ),
        AIMessage(
            content_blocks=[
                {
                    "type": "reasoning",
                    "reasoning": "because",
                    "extras": {"thought_signature": b"reason-signature"},
                }
            ]
        ),
    ]


def common_messages():
    return [
        SystemMessage(content="system rules"),
        *ai_messages(),
        HumanMessage(content="hello"),
        HumanMessage(
            content_blocks=[
                {
                    "type": "image",
                    "mime_type": "image/png",
                    "base64": b"YWJj",
                }
            ]
        ),
        ToolMessage(content="sunny", tool_call_id="call-1", name="lookup"),
    ]


def openai_tool():
    return {
        "type": "function",
        "function": {
            "name": "lookup",
            "description": "Look up a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
            },
        },
    }


class TestCustomClaude(unittest.TestCase):
    def make_model(self, **overrides):
        client = MagicMock()
        values = {"model": "claude-test", "api_key": "secret"}
        values.update(overrides)
        with patch.object(claude_langchain, "Anthropic", return_value=client) as ctor:
            model = claude_langchain.CustomClaude(**values)
        ctor.assert_called_once_with(api_key="secret")
        return model, client

    def test_constructor_properties_and_request_preparation(self):
        model, _ = self.make_model(reasoning_effect="high", max_tokens=321)
        tool_spec = openai_tool()

        params = model._claude_prepare(
            [HumanMessage(content="hi")],
            tools=[tool_spec],
            tool_choice={"type": "any"},
        )

        self.assertEqual(params["model"], "claude-test")
        self.assertEqual(params["max_tokens"], 321)
        self.assertEqual(
            params["thinking"],
            {
                "type": "enabled",
                "budget_tokens": claude_langchain.THINKING_BUDGET_TOKENS,
            },
        )
        self.assertEqual(params["tool_choice"], {"type": "any"})
        self.assertEqual(params["tools"][0]["name"], "lookup")
        self.assertFalse(params["tools"][0]["input_schema"]["additionalProperties"])
        self.assertEqual(model._llm_type, "Anthropic Claude")
        self.assertEqual(
            model._identifying_params,
            {"model_name": "claude-test", "temperature": 1.0, "max_tokens": 321},
        )

        plain_model, _ = self.make_model()
        plain = plain_model._claude_prepare([HumanMessage(content="hi")])
        self.assertNotIn("thinking", plain)
        self.assertNotIn("tools", plain)
        self.assertNotIn("tool_choice", plain)

    def test_prompt_translation_covers_all_supported_message_blocks(self):
        model, _ = self.make_model()

        translated = model._prompt_translate(common_messages())

        self.assertEqual(translated[0]["role"], "assistant")
        self.assertEqual(translated[1]["content"][0]["text"], "answer")
        self.assertEqual(translated[2]["content"][0]["type"], "tool_use")
        self.assertEqual(translated[2]["content"][0]["input"], {"city": "Toronto"})
        self.assertEqual(translated[3]["content"][0]["type"], "thinking")
        self.assertEqual(translated[4]["role"], "user")
        self.assertEqual(translated[5]["content"][0]["source"]["data"], "YWJj")
        self.assertEqual(translated[6]["content"][0]["type"], "tool_result")

    def test_generate_text_and_tool_call(self):
        model, client = self.make_model()
        client.messages.create.return_value = namespace(
            content=[namespace(type="text", text="completed")]
        )

        result = model._generate([HumanMessage(content="hello")])

        self.assertEqual(result.generations[0].message.content_blocks[0]["text"], "completed")
        client.messages.create.assert_called_once()

        client.messages.create.return_value = namespace(
            content=[
                namespace(type="text", text="ignored first"),
                namespace(
                    type="tool_use",
                    id="tool-1",
                    name="lookup",
                    input="{'city': 'Ottawa'}",
                ),
            ]
        )
        result = model._generate([HumanMessage(content="weather")])
        block = result.generations[0].message.content_blocks[0]
        self.assertEqual(block["type"], "non_standard")
        self.assertEqual(block["value"]["type"], "tool_use")
        self.assertEqual(block["value"]["args"], {"city": "Ottawa"})

    def test_generate_rejects_malformed_tool_arguments(self):
        model, client = self.make_model()
        client.messages.create.return_value = namespace(
            content=[
                namespace(
                    type="tool_use",
                    id="bad",
                    name="lookup",
                    input="not valid python",
                )
            ]
        )

        with self.assertRaises((SyntaxError, ValueError)):
            model._generate([HumanMessage(content="weather")])

    def test_stream_emits_reasoning_text_and_aggregated_tool_call(self):
        model, client = self.make_model()
        events = [
            namespace(
                type="content_block_delta",
                delta=namespace(type="thinking_delta", thinking="think"),
            ),
            namespace(
                type="content_block_delta",
                delta=namespace(type="text_delta", text="hello"),
            ),
            namespace(
                type="content_block_start",
                content_block=namespace(type="tool_use", id="call-7", name="lookup"),
            ),
            namespace(
                type="content_block_delta",
                delta=namespace(type="input_json_delta", partial_json='{"city":'),
            ),
            namespace(
                type="content_block_delta",
                delta=namespace(type="input_json_delta", partial_json='"Paris"}'),
            ),
            namespace(type="content_block_stop"),
            namespace(
                type="content_block_delta",
                delta=namespace(type="text_delta", text="not reached"),
            ),
        ]
        context = MagicMock()
        context.__enter__.return_value = iter(events)
        client.messages.stream.return_value = context

        chunks = list(model._stream([HumanMessage(content="weather")]))

        self.assertEqual([chunk.message.content_blocks[0]["type"] for chunk in chunks], [
            "reasoning",
            "text",
            "tool_call",
        ])
        self.assertEqual(chunks[-1].message.content_blocks[0]["args"], {"city": "Paris"})
        context.__exit__.assert_called_once()

    def test_stream_ignores_irrelevant_events_and_supports_server_tools(self):
        model, client = self.make_model()
        events = [
            namespace(type="ping"),
            namespace(
                type="content_block_start",
                content_block=namespace(
                    type="server_tool_use", id="server-1", name="search"
                ),
            ),
            namespace(
                type="content_block_delta",
                delta=namespace(type="input_json_delta", partial_json="{}"),
            ),
            namespace(type="content_block_stop"),
        ]
        context = MagicMock()
        context.__enter__.return_value = iter(events)
        client.messages.stream.return_value = context

        chunks = list(model._stream([]))

        self.assertEqual(chunks[0].message.content_blocks[0]["name"], "search")

    def test_bind_models_and_parameter_helpers(self):
        model, client = self.make_model()
        converted = [
            {"function": {"name": "first"}},
            {"name": "second"},
            {},
        ]
        with (
            patch(
                "langchain_core.utils.function_calling.convert_to_openai_tool",
                side_effect=converted,
            ) as convert,
            patch.object(BaseChatModel, "bind", return_value="bound") as bind,
        ):
            result = model.bind_tools(
                ["one", "two", "three"],
                strict=True,
                parallel_tool_calls=False,
                custom="value",
            )

        self.assertEqual(result, "bound")
        self.assertEqual(convert.call_count, 3)
        bind.assert_called_once_with(
            parallel_tool_calls=False,
            custom="value",
            tools=converted,
        )

        client.models.list.return_value.data = [namespace(id="a"), namespace(id="b")]
        self.assertEqual(model.list_models(), "a\nb")
        self.assertIn("model_id: claude-test", model.list_parameters())
        self.assertEqual(model.set_parameters("temperature", "0.25"), "Temperature set to 0.25")
        with self.assertRaises(AttributeError):
            model.set_parameters("model", "changed")
        self.assertEqual(model.model_name, "changed")
        with self.assertRaises(AttributeError):
            model.set_parameters("max_completion_tokens", "42")
        self.assertEqual(model.max_tokens, 42)
        with patch.object(claude_langchain, "output_log") as log:
            self.assertEqual(model.set_parameters("bad", "x"), "Invalid parameter: bad, x")
        log.assert_called_once_with("Invalid parameter: bad", "error")


class TestCustomGemini(unittest.TestCase):
    def make_model(self, **overrides):
        client = MagicMock()
        values = {"model": "gemini-test", "api_key": "secret"}
        values.update(overrides)
        with patch.object(gemini_langchain.genai, "Client", return_value=client) as ctor:
            model = gemini_langchain.CustomGemini(**values)
        ctor.assert_called_once()
        self.assertEqual(ctor.call_args.kwargs["api_key"], "secret")
        self.assertEqual(ctor.call_args.kwargs["http_options"].api_version, "v1alpha")
        return model, client

    def test_request_preparation_with_reasoning_and_tools(self):
        model, _ = self.make_model(
            reasoning_effect="HIGH", temperature=0.4, max_tokens=654
        )

        translated, params = model._gemini_prepare(
            [HumanMessage(content="hello")], tools=[openai_tool()]
        )

        self.assertEqual(translated[0].role, "user")
        self.assertEqual(params["max_output_tokens"], 654)
        self.assertEqual(params["temperature"], 0.4)
        self.assertEqual(params["config"].thinking_config.thinking_level, "HIGH")
        declaration = params["tools"][0].function_declarations[0]
        self.assertEqual(declaration.name, "lookup")
        self.assertEqual(model._llm_type, "Google Gemini")
        self.assertEqual(model._identifying_params["model_name"], "gemini-test")

        plain_model, _ = self.make_model()
        _, plain = plain_model._gemini_prepare([])
        self.assertNotIn("config", plain)
        self.assertNotIn("tools", plain)

    def test_prompt_translation_covers_all_supported_message_blocks(self):
        model, _ = self.make_model()
        messages = [
            message
            for message in common_messages()
            if not (
                isinstance(message, AIMessage)
                and message.content_blocks[0]["type"] == "reasoning"
            )
        ]

        translated = model._prompt_translate(messages)

        self.assertEqual([message.role for message in translated[:3]], [
            "model",
            "model",
            "model",
        ])
        self.assertEqual(translated[1].parts[0].text, "answer")
        self.assertEqual(translated[2].parts[0].function_call.name, "lookup")
        self.assertEqual(translated[3].role, "user")
        self.assertEqual(translated[4].parts[0].inline_data.mime_type, "image/png")
        self.assertEqual(translated[5].parts[0].function_response.name, "lookup")

        fake_part = object()
        fake_content = object()
        with (
            patch.object(gemini_langchain.types, "Part", return_value=fake_part) as part,
            patch.object(
                gemini_langchain.types, "Content", return_value=fake_content
            ) as content,
        ):
            reasoning = model._prompt_translate([ai_messages()[2]])
        self.assertEqual(reasoning, [fake_content])
        part.assert_called_once_with(
            thought="because", thought_signature=b"reason-signature"
        )
        content.assert_called_once_with(role="model", parts=[fake_part])

    def test_generate_text_and_function_call(self):
        model, client = self.make_model()
        text_part = namespace(function_call=None, text="gemini answer")
        client.models.generate_content.return_value = namespace(
            candidates=[namespace(content=namespace(parts=[text_part]))]
        )

        result = model._generate([HumanMessage(content="hello")])

        self.assertEqual(
            result.generations[0].message.content_blocks[0]["text"],
            "gemini answer",
        )

        function_call = namespace(name="lookup", args={"city": "Tokyo"}, id=None)
        function_part = namespace(function_call=function_call, text=None)
        client.models.generate_content.return_value = namespace(
            candidates=[namespace(content=namespace(parts=[function_part]))]
        )
        with patch.object(gemini_langchain.uuid, "uuid4", return_value="fixed"):
            result = model._generate([HumanMessage(content="weather")])
        block = result.generations[0].message.content_blocks[0]
        self.assertEqual(block["name"], "lookup")
        self.assertEqual(block["args"], {"city": "Tokyo"})
        self.assertEqual(block["id"], "function_call_fixed")

    def test_generate_image_returns_data_or_none(self):
        model, client = self.make_model()
        client.models.generate_content.return_value = namespace(
            parts=[namespace(inline_data=None), namespace(inline_data=namespace(data=b"png"))]
        )

        self.assertEqual(model.generate_image("draw"), b"png")
        args = client.models.generate_content.call_args.kwargs
        self.assertEqual(args["model"], "gemini-test")
        self.assertEqual(args["contents"][0].parts[0].text, "draw")

        client.models.generate_content.return_value = namespace(
            parts=[namespace(inline_data=None)]
        )
        self.assertIsNone(model.generate_image("nothing"))

    def test_stream_covers_function_reasoning_text_and_skip_paths(self):
        model, client = self.make_model()
        function_call = namespace(name="lookup", args={"city": "Rome"}, id=None)
        function_part = namespace(
            function_call=function_call,
            thought=None,
            text=None,
            thought_signature=b"function-signature",
        )
        reasoning_part = namespace(
            function_call=None,
            thought="analysis",
            text=None,
            thought_signature=b"reason-signature",
        )
        text_part = namespace(
            function_call=None,
            thought=None,
            text="answer",
            thought_signature=None,
        )
        client.models.generate_content_stream.return_value = [
            namespace(candidates=None),
            namespace(
                candidates=[
                    namespace(
                        finish_reason="MAX_TOKENS",
                        content=namespace(parts=[text_part]),
                    )
                ]
            ),
            namespace(
                candidates=[
                    namespace(finish_reason=None, content=namespace(parts=[function_part]))
                ]
            ),
            namespace(
                candidates=[
                    namespace(finish_reason="STOP", content=namespace(parts=[reasoning_part]))
                ]
            ),
            namespace(
                candidates=[
                    namespace(finish_reason=None, content=namespace(parts=[text_part]))
                ]
            ),
        ]

        with patch.object(gemini_langchain.uuid, "uuid4", return_value="stream"):
            chunks = list(model._stream([HumanMessage(content="hello")]))

        blocks = [chunk.message.content_blocks[0] for chunk in chunks]
        self.assertEqual([block["type"] for block in blocks], [
            "tool_call",
            "reasoning",
            "text",
        ])
        self.assertEqual(blocks[0]["id"], "function_call_stream")
        self.assertEqual(blocks[1]["reasoning"], "analysis")
        self.assertEqual(blocks[2]["text"], "answer")

    def test_stream_logs_and_skips_invalid_text_chunk(self):
        model, client = self.make_model()
        text_part = namespace(function_call=None, thought=None, text="answer")
        client.models.generate_content_stream.return_value = [
            namespace(
                candidates=[
                    namespace(finish_reason=None, content=namespace(parts=[text_part]))
                ]
            )
        ]
        with (
            patch.object(gemini_langchain, "AIMessageChunk", side_effect=ValueError("bad")),
            patch.object(gemini_langchain, "output_log") as log,
        ):
            self.assertEqual(list(model._stream([])), [])
        self.assertIn(call("Error processing token: bad", "debug"), log.call_args_list)

    def test_bind_models_and_parameter_helpers(self):
        model, client = self.make_model()
        converted = [
            {"function": {"name": "first"}},
            {"name": "second"},
            {},
        ]
        with (
            patch.object(
                gemini_langchain,
                "convert_to_openai_tool",
                side_effect=converted,
            ) as convert,
            patch.object(BaseChatModel, "bind", return_value="bound") as bind,
        ):
            result = model.bind_tools(
                ["one", "two", "three"],
                strict=True,
                parallel_tool_calls=True,
            )
        self.assertEqual(result, "bound")
        self.assertEqual(convert.call_count, 3)
        bind.assert_called_once_with(parallel_tool_calls=True, tools=converted)

        client.models.list.return_value = [
            namespace(name="models/alpha"),
            namespace(name="models/beta"),
        ]
        self.assertEqual(model.list_models(), "alpha\nbeta")
        self.assertIn("model_id: gemini-test", model.list_parameters())
        self.assertEqual(model.set_parameters("temperature", "0.5"), "Temperature set to 0.5")
        with self.assertRaises(AttributeError):
            model.set_parameters("model_id", "changed")
        with self.assertRaises(AttributeError):
            model.set_parameters("max_completion_tokens", "99")
        with patch.object(gemini_langchain, "output_log") as log:
            self.assertEqual(model.set_parameters("bad", 1), "Invalid parameter: bad, 1")
        log.assert_called_once_with("Invalid parameter: bad", "error")


class TestCustomOpenRouter(unittest.TestCase):
    def make_model(self, **overrides):
        client = MagicMock()
        values = {"model": "router/test", "api_key": "secret"}
        values.update(overrides)
        with patch.object(openrouter_langchain, "OpenRouter", return_value=client) as ctor:
            model = openrouter_langchain.CustomOpenRouterCompletion(**values)
        ctor.assert_called_once_with(api_key="secret")
        return model, client

    def test_request_preparation_and_properties(self):
        model, _ = self.make_model(reasoning_effect="high", temperature=0.2)
        tool_spec = openai_tool()

        params = model._openrouter_prepare(
            [HumanMessage(content="hi")], streaming=True, tools=[tool_spec]
        )

        self.assertTrue(params["stream"])
        self.assertEqual(params["reasoning"], {"effort": "high"})
        self.assertEqual(params["tools"][0]["function"]["name"], "lookup")
        self.assertFalse(
            params["tools"][0]["function"]["parameters"]["additionalProperties"]
        )
        self.assertEqual(model._llm_type, "router/test Powered by OpenRouter")
        self.assertEqual(model._identifying_params["temperature"], 0.2)

        plain_model, _ = self.make_model()
        plain = plain_model._openrouter_prepare([], streaming=False)
        self.assertFalse(plain["stream"])
        self.assertNotIn("reasoning", plain)
        self.assertNotIn("tools", plain)

    def test_prompt_translation_covers_all_supported_message_blocks(self):
        model, _ = self.make_model()

        translated = model._prompt_translate(common_messages())

        self.assertEqual(translated[0], {"role": "system", "content": "system rules"})
        self.assertEqual(translated[1], {"role": "assistant", "content": "answer"})
        self.assertEqual(translated[2]["tool_calls"][0]["id"], "call-1")
        self.assertEqual(translated[3], {"role": "assistant", "content": "because"})
        self.assertEqual(translated[4], {"role": "user", "content": "hello"})
        self.assertEqual(
            translated[5]["content"][0]["image_url"]["url"],
            "data:image/png;base64,YWJj",
        )
        self.assertEqual(translated[6]["tool_call_id"], "call-1")

    def test_generate_text_function_call_and_tool_calls(self):
        model, client = self.make_model()
        client.chat.send.return_value = namespace(
            choices=[
                namespace(
                    finish_reason="stop",
                    message=namespace(content="router answer"),
                )
            ]
        )
        result = model._generate([HumanMessage(content="hello")])
        self.assertEqual(result.generations[0].message.content_blocks[0]["text"], "router answer")

        function = namespace(name="lookup", arguments="{'city': 'Lima'}")
        client.chat.send.return_value = namespace(
            choices=[
                namespace(
                    finish_reason="function_call",
                    message=namespace(
                        function_call=[namespace(function=function, id="old-call")]
                    ),
                )
            ]
        )
        result = model._generate([])
        block = result.generations[0].message.content_blocks[0]
        self.assertEqual(block["id"], "old-call")
        self.assertEqual(block["args"], {"city": "Lima"})

        function = namespace(arguments="{'city': 'Oslo'}")
        client.chat.send.return_value = namespace(
            choices=[
                namespace(
                    finish_reason="tool_calls",
                    message=namespace(
                        tool_calls=[
                            namespace(name="lookup", function=function, id="new-call")
                        ]
                    ),
                )
            ]
        )
        result = model._generate([])
        block = result.generations[0].message.content_blocks[0]
        self.assertEqual(block["id"], "new-call")
        self.assertEqual(block["args"], {"city": "Oslo"})

    def test_generate_rejects_malformed_tool_arguments(self):
        model, client = self.make_model()
        function = namespace(arguments="not valid")
        client.chat.send.return_value = namespace(
            choices=[
                namespace(
                    finish_reason="tool_calls",
                    message=namespace(
                        tool_calls=[namespace(name="lookup", function=function, id="bad")]
                    ),
                )
            ]
        )
        with self.assertRaises((SyntaxError, ValueError)):
            model._generate([])

    def test_stream_covers_empty_reasoning_text_and_aggregated_tools(self):
        model, client = self.make_model()

        def event(delta, finish_reason=None):
            return namespace(
                choices=[namespace(delta=delta, finish_reason=finish_reason)]
            )

        client.chat.send.return_value = [
            namespace(choices=[]),
            event(namespace(tool_calls=None, reasoning_content="first", reasoning=None, content=None)),
            event(namespace(tool_calls=None, reasoning_content=None, reasoning="second", content=None)),
            event(namespace(tool_calls=None, reasoning_content=None, reasoning=None, content="text")),
            event(namespace(tool_calls=None, reasoning_content=None, reasoning=None, content=None)),
            event(
                namespace(
                    tool_calls=[
                        namespace(
                            id="tool-9",
                            function=namespace(name="lookup", arguments='{"city":'),
                        )
                    ],
                    reasoning_content=None,
                    reasoning=None,
                    content=None,
                )
            ),
            event(
                namespace(
                    tool_calls=[
                        namespace(
                            id="",
                            function=namespace(name="", arguments='"Berlin"}'),
                        )
                    ],
                    reasoning_content=None,
                    reasoning=None,
                    content=None,
                )
            ),
            event(
                namespace(
                    tool_calls=None,
                    reasoning_content=None,
                    reasoning=None,
                    content=None,
                ),
                finish_reason="tool_calls",
            ),
        ]

        chunks = list(model._stream([HumanMessage(content="weather")]))

        blocks = [chunk.message.content_blocks[0] for chunk in chunks]
        self.assertEqual([block["type"] for block in blocks], [
            "reasoning",
            "reasoning",
            "text",
            "tool_call",
        ])
        self.assertEqual(blocks[-1]["args"], {"city": "Berlin"})
        self.assertEqual(blocks[-1]["id"], "tool-9")

    def test_bind_models_and_parameter_helpers(self):
        model, client = self.make_model()
        with (
            patch.object(
                openrouter_langchain,
                "convert_to_openai_tool",
                return_value={"function": {"name": "lookup"}},
            ) as convert,
            patch.object(BaseChatModel, "bind", return_value="bound") as bind,
        ):
            result = model.bind_tools(
                [openai_tool()], strict=False, parallel_tool_calls=True, extra=1
            )
        self.assertEqual(result, "bound")
        convert.assert_called_once()
        bind.assert_called_once_with(
            parallel_tool_calls=True,
            extra=1,
            tools=[{"function": {"name": "lookup"}}],
        )

        client.models.list.return_value = namespace(
            data=[namespace(id="router/a"), namespace(id="router/b")]
        )
        self.assertEqual(model.list_models(), "router/a\nrouter/b")
        self.assertIn("max_tokens:", model.list_parameters())
        self.assertEqual(model.set_parameters("temperature", 0.7), "Temperature set to 0.7")
        with self.assertRaises(AttributeError):
            model.set_parameters("model", "changed")
        with self.assertRaises(AttributeError):
            model.set_parameters("max_completion_tokens", 77)
        with patch.object(openrouter_langchain, "output_log") as log:
            self.assertEqual(model.set_parameters("bad", "x"), "Invalid parameter: bad, x")
        log.assert_called_once_with("Invalid parameter: bad", "error")


class TestCustomXAI(unittest.TestCase):
    def make_model(self, **overrides):
        client = MagicMock()
        values = {"model": "grok-test", "api_key": "secret"}
        values.update(overrides)
        with patch.object(xai_langchain, "Client", return_value=client) as ctor:
            model = xai_langchain.CustomXAIResponse(**values)
        ctor.assert_called_once_with(api_key="secret")
        return model, client

    def test_request_preparation_with_reasoning_tools_and_defaults(self):
        model, _ = self.make_model(reasoning_effect="high")
        built_tool = object()
        with patch.object(xai_langchain, "tool", return_value=built_tool) as tool_builder:
            params = model._xai_prepare(
                [HumanMessage(content="hello")], tools=[openai_tool()]
            )

        self.assertEqual(params["reasoning_effort"], "high")
        self.assertEqual(params["tools"], [built_tool])
        tool_builder.assert_called_once_with(
            name="lookup",
            description="Look up a city",
            parameters=openai_tool()["function"]["parameters"],
        )
        self.assertEqual(model._llm_type, "xAI Response")
        self.assertEqual(model._identifying_params["model_name"], "grok-test")

        for effect in ("medium", "not a reasoning model"):
            plain_model, _ = self.make_model(reasoning_effect=effect)
            plain = plain_model._xai_prepare([])
            self.assertNotIn("reasoning_effort", plain)
            self.assertNotIn("tools", plain)

    def test_prompt_translation_covers_all_supported_message_blocks(self):
        model, _ = self.make_model()
        with (
            patch.object(xai_langchain, "assistant", side_effect=lambda text: ("a", text)) as assistant,
            patch.object(xai_langchain, "system", side_effect=lambda text: ("s", text)) as system,
            patch.object(xai_langchain, "user", side_effect=lambda *parts: ("u", *parts)) as user,
            patch.object(xai_langchain, "image", side_effect=lambda data: ("i", data)) as image,
            patch.object(xai_langchain, "tool_result", side_effect=lambda text: ("t", text)) as tool_result,
        ):
            translated = model._prompt_translate(common_messages())

        self.assertEqual(translated[0], ("s", "system rules"))
        self.assertEqual(translated[1], ("a", "answer"))
        self.assertIn("lookup", translated[2][1])
        self.assertEqual(translated[3], ("a", "because"))
        self.assertEqual(translated[4], ("u", "hello"))
        self.assertEqual(translated[5][0], "u")
        self.assertEqual(translated[6], ("t", "sunny"))
        self.assertEqual(assistant.call_count, 3)
        system.assert_called_once_with("system rules")
        user.assert_any_call("hello")
        image.assert_called_once_with("data:image/png;base64,YWJj")
        tool_result.assert_called_once_with("sunny")

    def test_generate_text_and_client_tool_call(self):
        model, client = self.make_model()
        chat = client.chat.create.return_value
        chat.sample.return_value = namespace(content="grok answer")
        with patch.object(xai_langchain, "get_tool_call_type", return_value="other"):
            result = model._generate([HumanMessage(content="hello")])
        self.assertEqual(result.generations[0].message.content_blocks[0]["text"], "grok answer")

        response = namespace(
            id="tool-1",
            function=namespace(name="lookup", arguments="{'city': 'Seoul'}"),
        )
        chat.sample.return_value = response
        with patch.object(
            xai_langchain, "get_tool_call_type", return_value="client_side_tool"
        ):
            result = model._generate([])
        block = result.generations[0].message.content_blocks[0]
        self.assertEqual(block["name"], "lookup")
        self.assertEqual(block["args"], {"city": "Seoul"})

    def test_generate_rejects_malformed_tool_arguments(self):
        model, client = self.make_model()
        client.chat.create.return_value.sample.return_value = namespace(
            id="bad",
            function=namespace(name="lookup", arguments="not valid"),
        )
        with (
            patch.object(
                xai_langchain, "get_tool_call_type", return_value="client_side_tool"
            ),
            self.assertRaises((SyntaxError, ValueError)),
        ):
            model._generate([])

    def test_stream_emits_client_tools_and_text(self):
        model, client = self.make_model()
        client_tool = namespace(
            id="tool-4",
            function=namespace(name="lookup", arguments="{'city': 'Cairo'}"),
        )
        server_tool = namespace(
            id="server-4",
            function=namespace(name="search", arguments="{}"),
        )
        client.chat.create.return_value.stream.return_value = [
            (None, namespace(tool_calls=[server_tool], content="")),
            (None, namespace(tool_calls=[client_tool], content="chunk")),
            (None, namespace(tool_calls=[], content="")),
        ]

        def tool_type(value):
            return "client_side_tool" if value is client_tool else "server_side_tool"

        with patch.object(xai_langchain, "get_tool_call_type", side_effect=tool_type):
            chunks = list(model._stream([HumanMessage(content="hello")]))

        blocks = [chunk.message.content_blocks[0] for chunk in chunks]
        self.assertEqual([block["type"] for block in blocks], ["tool_call", "text"])
        self.assertEqual(blocks[0]["args"], {"city": "Cairo"})
        self.assertEqual(blocks[1]["text"], "chunk")

    def test_bind_models_and_parameter_helpers(self):
        model, client = self.make_model()
        with (
            patch.object(
                xai_langchain,
                "convert_to_openai_tool",
                return_value={"function": {"name": "lookup"}},
            ) as convert,
            patch.object(BaseChatModel, "bind", return_value="bound") as bind,
        ):
            result = model.bind_tools(
                [openai_tool()], strict=True, parallel_tool_calls=False, extra=2
            )
        self.assertEqual(result, "bound")
        convert.assert_called_once()
        bind.assert_called_once_with(
            parallel_tool_calls=False,
            extra=2,
            tools=[{"function": {"name": "lookup"}}],
        )

        client.models.list_language_models.return_value = [
            namespace(name="grok-a"),
            namespace(name="grok-b"),
        ]
        self.assertEqual(model.list_models(), "grok-a\ngrok-b")
        parameters = model.list_parameters()
        self.assertIn("reasoning_effect:", parameters)
        self.assertEqual(model.set_parameters("temperature", "0.6"), "Temperature set to 0.6")
        with self.assertRaises(AttributeError):
            model.set_parameters("model_id", "changed")
        with self.assertRaises(AttributeError):
            model.set_parameters("max_completion_tokens", "12")
        with patch.object(xai_langchain, "output_log") as log:
            self.assertEqual(model.set_parameters("unknown", 5), "Invalid parameter: unknown, 5")
        log.assert_called_once_with("Invalid parameter: unknown", "error")


if __name__ == "__main__":
    unittest.main()
