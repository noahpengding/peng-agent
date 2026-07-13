import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, mock_open, patch

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.graph import END

from services.peng_agent import PengAgent


def ai_message(block):
    return AIMessage(content_blocks=[block])


class TestPengAgent(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.writer_patch = patch(
            "services.peng_agent.get_stream_writer", return_value=MagicMock()
        )
        self.writer_patch.start()
        self.addCleanup(self.writer_patch.stop)
        with patch.object(PengAgent, "init_agent_graph", return_value=MagicMock()):
            self.agent = PengAgent("alice", "openai", "model-id", [])
        self.agent._tools_ready = True

    def test_init_agent_graph_builds_expected_workflow(self):
        graph = MagicMock()
        graph.compile.return_value = "compiled"
        with patch("services.peng_agent.StateGraph", return_value=graph):
            result = self.agent.init_agent_graph()

        self.assertEqual(result, "compiled")
        graph.add_node.assert_any_call("call_model", self.agent.call_model)
        graph.add_node.assert_any_call("call_tools", self.agent.call_tools)
        self.assertEqual(graph.add_conditional_edges.call_count, 2)
        graph.set_entry_point.assert_called_once_with("call_model")

    async def test_init_tools_handles_empty_and_configured_tools(self):
        self.assertEqual(await self.agent.init_tools([]), {})

        first = SimpleNamespace(name="first")
        second = SimpleNamespace(name="second")
        with patch(
            "services.tools.tools_routers.tools_routers",
            new=AsyncMock(return_value=[first, second]),
        ) as router:
            result = await self.agent.init_tools(["one", "two"])

        self.assertEqual(result, {"first": first, "second": second})
        router.assert_awaited_once_with(["one", "two"])

    async def test_init_tools_handles_router_returning_no_tools(self):
        with patch(
            "services.tools.tools_routers.tools_routers",
            new=AsyncMock(return_value=None),
        ):
            self.assertEqual(await self.agent.init_tools(["missing"]), {})

    async def test_ensure_tools_only_initializes_once(self):
        self.agent._tools_ready = False
        self.agent._tools_input = ["search"]
        self.agent.init_tools = AsyncMock(return_value={"search": "tool"})

        await self.agent._ensure_tools()
        await self.agent._ensure_tools()

        self.assertEqual(self.agent.tools, {"search": "tool"})
        self.agent.init_tools.assert_awaited_once_with(["search"])

    async def test_ainvoke_initializes_tools_and_sets_recursion_limit(self):
        self.agent._tools_ready = False
        self.agent.init_tools = AsyncMock(return_value={})
        self.agent.graph.ainvoke = AsyncMock(return_value={"messages": []})
        state = {"messages": []}

        result = await self.agent.ainvoke(state)

        self.assertEqual(result, {"messages": []})
        self.agent.graph.ainvoke.assert_awaited_once_with(
            state, {"recursion_limit": 22}
        )

    async def test_truncate_tool_message_returns_short_observation(self):
        observation = "small result"
        self.assertEqual(
            await self.agent.truncate_tool_message(observation), observation
        )

    async def test_truncate_tool_message_uses_summary_for_long_output(self):
        self.agent.total_tool_calls = 10
        observation = "x" * 14001
        response = SimpleNamespace(content=[{"text": " condensed "}])
        completion = AsyncMock(return_value=[response])
        template = "Summarize {observation} to {max_length} characters"

        with (
            patch("builtins.open", mock_open(read_data=template)),
            patch(
                "handlers.chat_handlers.chat_completions_handler", completion
            ),
        ):
            result = await self.agent.truncate_tool_message(observation)

        self.assertEqual(result, "condensed")
        completion.assert_awaited_once()

    async def test_truncate_tool_message_falls_back_when_summary_fails(self):
        self.agent.total_tool_calls = 10
        observation = "x" * 14001
        template = "Summarize {observation} to {max_length} characters"

        with (
            patch("builtins.open", mock_open(read_data=template)),
            patch(
                "handlers.chat_handlers.chat_completions_handler",
                new=AsyncMock(side_effect=RuntimeError("offline")),
            ),
        ):
            result = await self.agent.truncate_tool_message(observation)

        self.assertEqual(result, observation[:14000])

    async def test_truncate_tool_message_uses_large_context_provider_budget(self):
        self.agent.operator = "gemini"
        self.agent.total_tool_calls = 10
        observation = "x" * 20000

        self.assertEqual(
            await self.agent.truncate_tool_message(observation), observation
        )

    async def test_astream_yields_graph_chunks(self):
        async def graph_stream(*args, **kwargs):
            yield {"first": 1}
            yield {"second": 2}

        self.agent.graph.astream = graph_stream

        result = [chunk async for chunk in self.agent.astream({"messages": []})]

        self.assertEqual(result, [{"first": 1}, {"second": 2}])

    async def test_call_model_combines_text_reasoning_and_tool_call(self):
        chunks = [
            ai_message({"type": "text", "text": "Hello "}),
            ai_message({"type": "text", "text": "world"}),
            ai_message({"type": "reasoning", "reasoning": "because"}),
            ai_message(
                {
                    "type": "tool_call",
                    "name": "search",
                    "args": {"q": "peng"},
                    "id": "call-1",
                }
            ),
        ]

        class BoundModel:
            async def astream(self, messages):
                self.messages = messages
                for chunk in chunks:
                    yield chunk

        bound = BoundModel()
        model = MagicMock()
        model.bind_tools.return_value = bound
        writer = MagicMock()
        self.agent.tools = {"search": "tool"}

        with (
            patch(
                "handlers.model_utils.get_model_instance", return_value=model
            ) as get_model,
            patch("services.peng_agent.get_stream_writer", return_value=writer),
        ):
            result = await self.agent.call_model(
                {"messages": [HumanMessage(content="question")]}
            )

        get_model.assert_called_once_with("model-id")
        model.bind_tools.assert_called_once_with(["tool"])
        self.assertEqual(len(result["messages"]), 3)
        self.assertEqual(result["messages"][0].content_blocks[0]["type"], "reasoning")
        self.assertEqual(result["messages"][1].text, "Hello world")
        self.assertEqual(result["messages"][2].tool_calls[0]["name"], "search")
        self.assertEqual(writer.call_count, 4)

    async def test_call_model_reuses_cached_model(self):
        class EmptyBoundModel:
            async def astream(self, messages):
                if False:
                    yield messages

        model = MagicMock()
        model.bind_tools.return_value = EmptyBoundModel()
        self.agent._llm_instance = model

        with (
            patch("handlers.model_utils.get_model_instance") as get_model,
            patch("services.peng_agent.get_stream_writer", return_value=MagicMock()),
        ):
            result = await self.agent.call_model({"messages": []})

        get_model.assert_not_called()
        self.assertEqual(result, {"messages": []})

    async def test_call_model_rejects_unknown_model(self):
        with (
            patch("handlers.model_utils.get_model_instance", return_value=None),
            patch("services.peng_agent.get_stream_writer", return_value=MagicMock()),
        ):
            with self.assertRaisesRegex(ValueError, "Failed to create model"):
                await self.agent.call_model({"messages": []})

    async def test_call_tools_rejects_non_ai_message(self):
        result = await self.agent.call_tools(
            {"messages": [HumanMessage(content="hello")]}
        )
        self.assertIn("Not an AI message", result["messages"].text)

    async def test_call_tools_rejects_non_tool_ai_message(self):
        result = await self.agent.call_tools(
            {"messages": [ai_message({"type": "text", "text": "hello"})]}
        )
        self.assertIn("Invalid tool call", result["messages"].text)

    async def test_call_tools_stops_at_limit(self):
        self.agent.total_tool_calls = 1
        self.agent.tools = {"search": "tool"}
        message = ai_message(
            {
                "type": "tool_call",
                "name": "search",
                "args": {},
                "id": "limit-call",
            }
        )

        result = await self.agent.call_tools({"messages": [message]})

        self.assertIn("Tool call limit reached", result["messages"].text)
        self.assertEqual(self.agent.tools, {})

    async def test_call_tools_reports_unknown_tool(self):
        message = ai_message(
            {
                "type": "tool_call",
                "name": "missing",
                "args": {},
                "id": "missing-call",
            }
        )

        result = await self.agent.call_tools({"messages": [message]})

        self.assertIn("not found", result["messages"].text)

    async def test_call_tools_rejects_duplicate_call(self):
        self.agent.tools = {"search": MagicMock()}
        self.agent.tool_call_history = [
            {"name": "search", "args": {"q": "same"}, "id": "old"}
        ]
        message = ai_message(
            {
                "type": "tool_call",
                "name": "search",
                "args": {"q": "same"},
                "id": "new",
            }
        )

        result = await self.agent.call_tools({"messages": [message]})

        self.assertIn("already been executed", result["messages"].text)

    async def test_call_tools_invokes_tool_truncates_and_records_history(self):
        tool = SimpleNamespace(ainvoke=AsyncMock(return_value=["one", "two"]))
        self.agent.tools = {"search": tool}
        self.agent.truncate_tool_message = AsyncMock(return_value="shortened")
        writer = MagicMock()
        message = ai_message(
            {
                "type": "tool_call",
                "name": "search",
                "args": {"q": "new"},
                "id": "call-2",
            }
        )

        with patch("services.peng_agent.get_stream_writer", return_value=writer):
            result = await self.agent.call_tools({"messages": [message]})

        tool.ainvoke.assert_awaited_once_with({"q": "new"})
        self.agent.truncate_tool_message.assert_awaited_once_with("one\ntwo")
        self.assertEqual(result["messages"].text, "shortened")
        self.assertEqual(self.agent.tool_call_history[0]["name"], "search")
        writer.assert_called_once()

    async def test_call_tools_converts_provider_error_to_observation(self):
        tool = SimpleNamespace(
            ainvoke=AsyncMock(side_effect=RuntimeError("provider failed"))
        )
        self.agent.tools = {"search": tool}
        self.agent.truncate_tool_message = AsyncMock(
            side_effect=lambda observation: observation
        )
        message = ai_message(
            {
                "type": "tool_call",
                "name": "search",
                "args": {},
                "id": "call-3",
            }
        )

        with patch("services.peng_agent.get_stream_writer", return_value=MagicMock()):
            result = await self.agent.call_tools({"messages": [message]})

        self.assertIn("provider failed", result["messages"].text)

    async def test_call_tools_marks_direct_return_and_skips_image_history(self):
        tool = SimpleNamespace(ainvoke=AsyncMock(return_value="image-bytes"))
        self.agent.tools = {"image_generation_tool": tool}
        self.agent.truncate_tool_message = AsyncMock()
        message = ai_message(
            {
                "type": "tool_call",
                "name": "image_generation_tool",
                "args": {"prompt": "penguin"},
                "id": "image-call",
            }
        )

        with patch("services.peng_agent.get_stream_writer", return_value=MagicMock()):
            result = await self.agent.call_tools({"messages": [message]})

        self.assertTrue(self.agent._tool_return_direct)
        self.assertEqual(result["messages"].text, "image-bytes")
        self.agent.truncate_tool_message.assert_not_awaited()
        self.assertEqual(self.agent.tool_call_history, [])

    def test_should_continue_routes_by_last_message(self):
        tool_call = ai_message(
            {
                "type": "tool_call",
                "name": "search",
                "args": {},
                "id": "call",
            }
        )
        text = ai_message({"type": "text", "text": "done"})

        self.assertEqual(
            self.agent.should_continue({"messages": [tool_call]}), "call_tools"
        )
        self.assertEqual(
            self.agent.should_continue(
                {"messages": [ToolMessage(content="result", tool_call_id="call")]}
            ),
            "call_model",
        )
        self.assertEqual(self.agent.should_continue({"messages": [text]}), END)

    def test_tool_return_direct_routes_by_flag(self):
        self.assertEqual(self.agent.tool_return_direct({"messages": []}), "call_model")
        self.agent._tool_return_direct = True
        self.assertEqual(self.agent.tool_return_direct({"messages": []}), END)


if __name__ == "__main__":
    unittest.main()
