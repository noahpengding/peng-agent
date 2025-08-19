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
from config.config import config
from utils.log import output_log
from utils.mysql_connect import MysqlConnect
from datetime import datetime, timedelta


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]


class ToolCall(TypedDict):
    name: str
    args: dict
    id: str

def save_chat(
    user_name,
    chat_type,
    base_model,
    human_input,
    ai_response,
):
    if ai_response is None or ai_response.strip() == "":
        return
    mysql = MysqlConnect()
    try:
        mysql.create_record(
            "chat",
            {
                "user_name": user_name,
                "type": chat_type,
                "base_model": base_model,
                "human_input": human_input[: config.input_max_length]
                if len(human_input) > config.input_max_length
                else human_input,
                "ai_response": ai_response[: config.output_max_length]
                if len(ai_response) > config.output_max_length
                else ai_response,
                "created_at": datetime.now(),
                "expire_at": datetime.now() + timedelta(days=7),
            },
        )
    except Exception as e:
        output_log(f"Error saving chat: {e}", "error")
    finally:
        mysql.close()

def save_tool_call(
    call_id: str,
    tools_name: str,
    tools_argument: dict,
    problem: str,
):
    mysql = MysqlConnect()
    try:
        mysql.create_record(
            "tool_call",
            {
                "call_id": str(call_id),
                "tools_name": str(tools_name),
                "tools_argument": str(tools_argument),
                "problem": str(problem),
                "created_at": datetime.now(),
            },
        )
    except Exception as e:
        output_log(f"Error saving tool call: {e}", "error")
    finally:
        mysql.close()

class PengAgent:
    def __init__(self, user_name: str, operater: str, model: str, tools: list[str]):
        self.operator = operater
        self.user_name = user_name
        self.model = model
        self.tools = self.init_tools(tools)
        self.graph = self.init_agent_graph()
        self.tool_call_history: list[ToolCall] = []
        self.total_tool_calls = 10

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

    def init_tools(self, tools):
        if tools == []:
            return {}
        from services.tools.tools_routers import tools_routers

        tool_instances = tools_routers(tools)
        return {t.name: t for t in tool_instances} if tool_instances else {}

    def invoke(self, state: AgentState) -> Any:
        return self.graph.invoke(state)

    def ainvoke(self, state: AgentState) -> Any:
        return self.graph.ainvoke(state)

    def stream(self, state: AgentState) -> Any:
        return self.graph.stream(state, stream_mode="custom")

    def astream(self, state: AgentState) -> Any:
        return self.graph.astream(state, stream_mode="custom")

    def call_model(self, state: AgentState):
        from handlers.model_utils import get_model_instance_by_operator

        writer = get_stream_writer()
        llm = get_model_instance_by_operator(self.operator, self.model)
        llm = llm.bind_tools(list(self.tools.values()))
        full_response = ""  # for using reasoning result for next round input
        for chunk in llm.stream(state["messages"]):
            if isinstance(chunk, AIMessage):
                response = chunk
                full_response += str(chunk.content)
            else:
                response = AIMessage(
                    content=str(chunk), additional_kwargs={"type": "output_text"}
                )
                full_response += str(chunk)
            writer({"call_model": {"messages": response}})
        full_response = AIMessage(
            content=full_response, additional_kwargs={"type": "reasoning_final"}
        )
        save_chat(
            self.user_name,
            "assistant",
            self.model,
            "|\n".join(
                [str(msg.content) for msg in list(state["messages"])[1:-1]]
            ),
            full_response.content,
        )
        return {"messages": [full_response, response]}

    def call_tools(self, state: AgentState):
        writer = get_stream_writer()
        self.total_tool_calls -= 1
        if self.total_tool_calls == 0:
            message = "Tool call limit reached. No more tool calls can be made. Try to generate the final response based on the history."
            return {
                "messages": ToolMessage(
                    content=message, name="tool_call_error_detector", tool_call_id=""
                )
            }

        last_message = list(state["messages"])[-1]
        if not isinstance(last_message, AIMessage):
            message = "Not an AI message to call tools."
            return {
                "messages": ToolMessage(
                    content=message, name="tool_call_error_detector", tool_call_id=""
                )
            }
        tool_calls = getattr(last_message, "tool_calls", None) or []
        if not tool_calls:
            message = "No tool calls found in the last message."
            return {
                "messages": ToolMessage(
                    content=message, name="tool_call_error_detector", tool_call_id=""
                )
            }

        newmessages = []
        for tc in tool_calls:
            name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
            args = (
                tc.get("args", {}) if isinstance(tc, dict) else getattr(tc, "args", {})
            )
            if name not in self.tools:
                return {"messages": f"Tool '{name}' not found."}
            if any(
                (name == history["name"] and args == history["args"])
                for history in self.tool_call_history
            ):
                message = f"The tool call '{name}' with args {args} has already been executed. Try to find it in the history. If you need further information, try to call it with different args."
                newmessages.append(
                    ToolMessage(
                        content=message,
                        name="tool_call_error_detector",
                        tool_call_id="",
                    )
                )
            else:
                tool = self.tools[name]
                observation = tool.invoke(args)
                newmessages.append(
                    ToolMessage(
                        content=str(observation),
                        name=name,
                        tool_call_id=tc.get("id")
                        if isinstance(tc, dict)
                        else getattr(tc, "id", ""),
                    )
                )
                self.tool_call_history.append(
                    ToolCall(
                        name=name,
                        args=args,
                        id=tc.get("id")
                        if isinstance(tc, dict)
                        else getattr(tc, "id", ""),
                    )
                )
            writer(
                {
                    "call_tools": {
                        "messages": newmessages[-1],
                    }
                }
            )
        return {"messages": newmessages}

    def should_continue(self, state: AgentState) -> str:
        last_message = list(state["messages"])[-1]
        input_message = list(state["messages"])[1:-1]
        if isinstance(last_message, AIMessage) and getattr(
            last_message, "tool_calls", None
        ):
            save_tool_call(
                call_id=last_message.tool_calls[0].get("id", ""),
                tools_name=last_message.tool_calls[0].get("name", ""),
                tools_argument=last_message.tool_calls[0].get("args", {}),
                problem="|\n".join(
                    [str(msg.content) for msg in input_message]
                )
            )
            return "call_tools"
        if (
            isinstance(last_message, AIMessage)
            and last_message.additional_kwargs.get("type") == "reasoning_summary"
        ):
            self.tools = {}
            return "call_model"
        return END
