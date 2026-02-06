from models.chat_config import ChatConfig
from services.peng_agent import PengAgent, AgentState
from utils.log import output_log
from utils.mysql_connect import MysqlConnect
from services.response_formatter import response_formatter_main
import services.prompt_generator as prompt_generator
from handlers.model_utils import get_model_instance
from fastapi.responses import StreamingResponse, JSONResponse
from langchain_core.messages import (
    HumanMessage,
    AIMessage,
)
from typing import List
import json
from typing import AsyncIterator


def _generate_prompt_params(
    user_name: str, message: str, image: str, chat_config: ChatConfig, mysql_conn: MysqlConnect = None
):
    chat = mysql_conn.create_record(
        table="chat",
        data={
            "user_name": user_name,
            "type": "chat",
            "base_model": chat_config.base_model,
            "human_input": message,
        }
    )

    prompt = []
    prompt += prompt_generator.system_prompt(user_name)
    prompt += prompt_generator.add_long_term_memory_to_prompt(chat_config.long_term_memory)
    prompt += prompt_generator.add_short_term_memory_to_prompt(chat_config.short_term_memory, mysql_conn, chat_config.base_model)
    prompt += prompt_generator.add_image_to_prompt(chat_config.base_model, image)
    prompt += prompt_generator.add_human_message_to_prompt(message)
    output_log(f"Generated Prompt: {prompt}", "DEBUG")

    chat_id = chat["id"]
    mysql_conn.create_record(
        table="user_input",
        data={
            "chat_id": chat_id,
            "input_content": message,
            "input_type": "chat",
            "input_location": "|".join(image) if image else "",
        }
    )
    return prompt, chat_id


async def chat_handler(
    user_name: str, message: str, image: List[str], chat_config: ChatConfig
) -> AsyncIterator[str]:
    output_log(
        f"Streaming chat for User: {user_name}, Message: {message}, Image: {image}, Config: {chat_config}",
        "debug",
    )

    mysql = MysqlConnect()
    prompt, chat_id = _generate_prompt_params(user_name, message, image, chat_config, mysql)

    agent = PengAgent(
        user_name,
        chat_config.operator,
        chat_config.base_model,
        chat_config.tools_name,
    )
    yield (
        json.dumps({"chunk": "Agent Created\n", "type": "output_text", "done": False})
        + "\n"
    )

    full_response = ""
    pre_chunk_type = ""
    try:
        async for chunk in agent.astream(AgentState(messages=prompt)):
            output_log(f"Received chunk: {chunk}", "DEBUG")
            if chunk:
                if "call_model" in chunk and "messages" in chunk["call_model"]:
                    message = chunk["call_model"]["messages"]
                    if message["type"] == "text":
                        chunk_content = message["text"]
                        chunk_type = "output_text"
                    elif message["type"] == "reasoning":
                        chunk_content = message["reasoning"]
                        chunk_type = "reasoning_summary"
                    # Tool call from chat model
                    elif message["type"] == "tool_call":
                        chunk_content = (
                            f"Tool Call: {message['name']} with args {message['args']}"
                        )
                        chunk_type = "tool_calls"
                        _save_chat_response(
                            chat_id,
                            chunk_type,
                            chunk_content,
                            mysql_conn=mysql,
                            call_id=message["id"],
                            tool_name=message["name"],
                            tool_args=str(message["args"]),
                        )
                # Tool message after execution the tool
                elif "call_tools" in chunk and "messages" in chunk["call_tools"]:
                    chunk_content = chunk["call_tools"]["messages"]
                    if isinstance(chunk_content, list):
                        tool_call_id = chunk_content[0].tool_call_id
                        chunk_content = chunk_content[0].content
                    else:
                        tool_call_id = chunk_content.tool_call_id
                        chunk_content = chunk_content.content
                    if isinstance(chunk_content, list):
                        chunk_content = "".join(
                            [part for part in chunk_content if isinstance(part, str)]
                        )
                    chunk_type = "tool_output"
                    _save_chat_response(
                        chat_id,
                        chunk_type,
                        chunk_content,
                        mysql_conn=mysql,
                        call_id=tool_call_id,
                    )
                else:
                    chunk_content = ""
                    chunk_type = ""
                if pre_chunk_type == "" or pre_chunk_type != chunk_type:
                    if pre_chunk_type in ["output_text", "reasoning_summary"] and full_response != "":
                        _save_chat_response(
                            chat_id,
                            pre_chunk_type,
                            full_response,
                            mysql_conn=mysql,
                        )
                    pre_chunk_type = chunk_type
                    full_response = ""
                if isinstance(chunk_content, str):
                    yield (
                        json.dumps(
                            {"chunk": chunk_content, "type": chunk_type, "done": False}
                        )
                        + "\n"
                    )
                    full_response += chunk_content
    except Exception as e:
        output_log(f"Error during streaming: {e}", "error")
        yield (
            json.dumps(
                {"chunk": f"Error: {str(e)}", "type": "output_text", "done": False}
            )
            + "\n"
        )
    finally:
        if pre_chunk_type in ["output_text", "reasoning_summary"] and full_response != "":
            _save_chat_response(
                chat_id,
                pre_chunk_type,
                full_response,
                mysql_conn=mysql,
            )
        mysql.close()
        yield json.dumps({"chunk": f"{chat_id}", "done": True}) + "\n"

def _save_chat_response(chat_id: int, message_type: str, content: str, mysql_conn: MysqlConnect = None, **kwargs):
    mysql = mysql_conn
    if message_type == "output_text":
        mysql.create_record(
            table="ai_response",
            data={
                "chat_id": chat_id,
                "ai_response": content[:10240],
            }
        )
    elif message_type == "reasoning_summary":
        mysql.create_record(
            table="ai_reasoning",
            data={
                "chat_id": chat_id,
                "reasoning_process": content[:10240],
            }
        )
    elif message_type == "tool_calls":
        mysql.create_record(
            table="tool_call",
            data={
                "chat_id": chat_id,
                "call_id": kwargs.get("call_id", ""),
                "tools_name": kwargs.get("tool_name", ""),
                "tools_argument": kwargs.get("tool_args", ""),
                "problem": content,
            }
        )
    elif message_type == "tool_output":
        mysql.create_record(
            table="tool_output",
            data={
                "chat_id": chat_id,
                "call_id": kwargs.get("call_id", ""),
                "output_content": content[:10240],
            }
        )

def create_streaming_response(
    user_name: str, message: str, image: str, chat_config: ChatConfig
) -> StreamingResponse:
    return StreamingResponse(
        chat_handler(user_name, message, image, chat_config),
        media_type="text/event-stream",
    )


async def chat_completions_handler(
    user_name: str, message: str, image: List[str], chat_config: ChatConfig
) -> str:
    output_log(
        f"Chat Completion for User: {user_name}, Message: {message}, Image: {image}, Config: {chat_config}",
        "debug",
    )

    mysql = MysqlConnect()
    prompt, chat_id = _generate_prompt_params(user_name, message, image, chat_config, mysql)

    agent = PengAgent(
        operater=chat_config.operator,
        model=chat_config.base_model,
        tools=chat_config.tools_name,
        user_name=user_name,
    )
    responses = await agent.ainvoke(AgentState(messages=prompt))
    for response in responses["messages"]:
        if not isinstance(response, AIMessage):
            continue
        if hasattr(response, "content_blocks") and response.content_blocks:
            for content_blocks in response.content_blocks:
                if content_blocks["type"] == "text":
                    _save_chat_response(
                        chat_id,
                        "output_text",
                        content_blocks["text"],
                        mysql_conn=mysql,
                    )
                elif content_blocks["type"] == "reasoning":
                    _save_chat_response(
                        chat_id,
                        "reasoning_summary",
                        content_blocks["reasoning"],
                        mysql_conn=mysql,
                    )
                elif content_blocks["type"] == "tool_call":
                    _save_chat_response(
                        chat_id,
                        "tool_calls",
                        f"Tool Call: {content_blocks['name']} with args {content_blocks['args']}",
                        mysql_conn=mysql,
                        call_id=content_blocks.get("id", ""),
                        tool_name=content_blocks.get("name", ""),
                        tool_args=str(content_blocks.get("args", "")),
                    )
                elif content_blocks["type"] == "tool_output":
                    _save_chat_response(
                        chat_id,
                        "tool_output",
                        content_blocks.get("content", ""),
                        mysql_conn=mysql,
                        call_id=content_blocks.get("call_id", ""),
                    )
        else:
            continue
    return responses["messages"]


async def create_completion_response(
    user_name: str, message: str, image: List[str], chat_config: ChatConfig
) -> JSONResponse:
    result = await chat_completions_handler(user_name, message, image, chat_config)
    return JSONResponse(
        content=result,
        media_type="application/json",
    )


def create_batch_response(
    user_name: str, messages: list[str], image: List[str], chat_config: ChatConfig
) -> JSONResponse:
    if not isinstance(messages, list) or not messages:
        return JSONResponse(
            content={"error": "Invalid messages format."},
            status_code=400,
        )
    base_model_ins = get_model_instance(
        chat_config.base_model,
    )
    if base_model_ins is None:
        return JSONResponse(
            content={"error": "Model instance not found."},
            status_code=500,
        )
    prompts = []
    for message in messages:
        prompt = _generate_prompt_params(user_name, message, image, chat_config)
        prompts.append(AgentState(messages=prompt))
    full_response = base_model_ins.batch(prompts)
    reponses = [
        response_formatter_main(chat_config.operator, response.content)
        for response in full_response
    ]
    return JSONResponse(
        content=reponses,
        media_type="application/json",
    )
