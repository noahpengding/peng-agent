from typing import (
    Annotated,
    Sequence,
    TypedDict,
    Any,
)
from langchain_core.messages import (
    BaseMessage,
    AIMessage,
    ToolMessage,
)
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.config import get_stream_writer


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]


class ToolCall(TypedDict):
    name: str
    args: dict
    id: str


class PengAgent:
    def __init__(self, user_name: str, operater: str, model: str, tools: list[Any]):
        self.operator = operater
        self.user_name = user_name
        self.model = model
        # Defer async tool initialization; store input and init later in async entrypoints
        self._tools_input = tools
        self.tools: dict[str, Any] = {}
        self._tools_ready = False
        self.graph = self.init_agent_graph()
        self.tool_call_history: list[ToolCall] = []
        self.total_tool_calls = 25 if operater == "anthropic" else 10

    def init_agent_graph(self) -> Any:
        graph = StateGraph(AgentState)
        graph.add_node("call_model", self.call_model)
        graph.add_node("call_tools", self.call_tools)
        graph.add_conditional_edges(
            "call_model",
            self.should_continue,
            {"call_tools": "call_tools", END: END, "call_model": "call_model"},
        )
        graph.add_edge("call_tools", "call_model")
        graph.set_entry_point("call_model")
        return graph.compile()

    async def init_tools(self, tools: list[Any]):
        if not tools:
            return {}
        from services.tools.tools_routers import tools_routers

        tool_instances = await tools_routers(tools)
        return {t.name: t for t in tool_instances} if tool_instances else {}

    async def _ensure_tools(self) -> None:
        if self._tools_ready:
            return
        self.tools = await self.init_tools(self._tools_input)
        self._tools_ready = True

    async def ainvoke(self, state: AgentState) -> Any:
        await self._ensure_tools()
        return await self.graph.ainvoke(
            state, {"recursion_limit": (self.total_tool_calls + 1) * 2}
        )


    async def astream(self, state: AgentState) -> Any:
        await self._ensure_tools()
        async for chunk in self.graph.astream(
            state,
            stream_mode="custom",
            config={"recursion_limit": (self.total_tool_calls + 1) * 2},
        ):
            yield chunk

    async def call_model(self, state: AgentState):
        from handlers.model_utils import get_model_instance

        writer = get_stream_writer()
        await self._ensure_tools()
        if not hasattr(self, "_llm_instance") or self._llm_instance is None:
            self._llm_instance = get_model_instance(self.model)
        llm = self._llm_instance
        llm = llm.bind_tools(list(self.tools.values()))
        final_response = ""
        final_reasoning = ""
        tool_calls = ""
        async for chunk in llm.astream(state["messages"]):
            if isinstance(chunk, AIMessage) and chunk.content_blocks:
                writer({"call_model": {"messages": chunk.content_blocks[0]}})
                if chunk.content_blocks[0]["type"] == "text":
                    final_response += chunk.content_blocks[0]["text"]
                elif chunk.content_blocks[0]["type"] == "reasoning":
                    final_reasoning += chunk.content_blocks[0]["reasoning"]
                elif chunk.content_blocks[0]["type"] == "tool_call":
                    tool_calls = chunk
        if final_response != "":
            final_response = AIMessage(
                content_blocks=[
                    {
                        "type": "text",
                        "text": final_response,
                    }
                ]
            )
        if final_reasoning != "":
            final_reasoning = AIMessage(
                content_blocks=[
                    {
                        "type": "reasoning",
                        "reasoning": final_reasoning,
                    }
                ]
            )
        return {"messages": [response for response in [final_reasoning, final_response, tool_calls] if response != ""]}

    async def call_tools(self, state: AgentState):
        writer = get_stream_writer()
        self.total_tool_calls -= 1
        last_message = list(state["messages"])[-1]
        # Not an AI message
        if not isinstance(last_message, AIMessage):
            message = "Not an AI message to call tools."
            return {"messages": ToolMessage(content=message, tool_call_id="")}
        tool_calls = last_message.content_blocks[0]
        # Not a tool call
        if tool_calls["type"] != "tool_call":
            message = "Invalid tool call format."
            return {
                "messages": ToolMessage(
                    content=message,
                    tool_call_id="",
                )
            }
        # Exceeded tool call limit
        if self.total_tool_calls == 0:
            message = "Tool call limit reached. No more tool calls can be made. Try to generate the final response based on the history."
            self.tools = {}
            return {
                "messages": ToolMessage(
                    content=message,
                    tool_call_id=tool_calls["id"]
                    if isinstance(tool_calls, dict)
                    else "",
                )
            }
        name = tool_calls["name"]
        args = tool_calls["args"]
        # Tool not found
        if name not in self.tools:
            return {
                "messages": ToolMessage(
                    content=f"Tool '{name}' not found.",
                    tool_call_id=tool_calls["id"]
                    if isinstance(tool_calls, dict)
                    else "",
                )
            }
        # Duplicate tool call
        if any(
            (name == history["name"] and args == history["args"])
            for history in self.tool_call_history
        ):
            message = f"The tool call '{name}' with args {args} has already been executed. Try to find it in the history. If you need further information, try to call it with different args."
            return {
                "messages": ToolMessage(
                    content=message,
                    tool_call_id=tool_calls["id"]
                    if isinstance(tool_calls, dict)
                    else "",
                )
            }
        tool = self.tools[name]
        try:
            observation = await tool.ainvoke(args)
        except Exception as e:
            observation = f"Error calling tool '{name}': {e}"
        message = ToolMessage(
            content=observation,
            name=name,
            tool_call_id=tool_calls["id"] if isinstance(tool_calls, dict) else "",
        )
        self.tool_call_history.append(
            ToolCall(
                name=name,
                args=args,
                id=tool_calls["id"] if isinstance(tool_calls, dict) else "",
            )
        )
        writer({"call_tools": {"messages": message}})
        return {"messages": message}

    def should_continue(self, state: AgentState) -> str:
        last_message = list(state["messages"])[-1]
        if (
            isinstance(last_message, AIMessage)
            and last_message.content_blocks[0]["type"] == "tool_call"
        ):
            return "call_tools"
        if not isinstance(last_message, AIMessage):
            return "call_model"
        return END
