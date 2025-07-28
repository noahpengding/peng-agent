from models.chat_config import ChatConfig
from config.config import config
from utils.mysql_connect import MysqlConnect
from utils.log import output_log
from services.response_formatter import response_formatter_main
import services.prompt_generator as prompt_generator
from handlers.model_utils import get_model_instance_by_operator
from fastapi.responses import StreamingResponse, JSONResponse
from datetime import datetime, timedelta
import json
from typing import AsyncIterator


def _generate_prompt_params(message: str, image: str, chat_config: ChatConfig):
    prompt = prompt_generator.prompt_template(
        model_name=chat_config.base_model,
    )
    params = prompt_generator.base_prompt_generate(
        message=message,
        short_term_memory=chat_config.short_term_memory,
        long_term_memory=chat_config.long_term_memory,
    )
    params = prompt_generator.add_image_to_prompt(
        model_name=chat_config.base_model,
        params=params,
        image=image,
    )
    return prompt, params


async def chat_handler(
    user_name: str, message: str, image: str, chat_config: ChatConfig
) -> AsyncIterator[str]:
    output_log(
        f"Streaming chat for User: {user_name}, Message: {message}, Image: {image}, Config: {chat_config}",
        "debug",
    )

    prompt, params = _generate_prompt_params(message, image, chat_config)

    base_model_ins = get_model_instance_by_operator(
        chat_config.operator,
        chat_config.base_model,
    )
    if base_model_ins is None:
        yield (
            json.dumps({"chunk": "Error: Model instance not found.", "done": True})
            + "\n"
        )
        return
    
    if chat_config.tools_name != []:
        from services.tools.tools_routers import tools_routers
        from langgraph.prebuilt import create_react_agent
        tools = tools_routers(chat_config.tools_name)
        llm_with_tools = base_model_ins.bind_tools(tools)
        agent = create_react_agent(
            model=llm_with_tools,
            tools=tools,
        )
        full_response = ""
        async for chunk in agent.astream(prompt.invoke(params), stream_mode="updates"):
            if chunk:
                chunk_type = "unknown"
                if "agent" in chunk and "messages" in chunk["agent"]:
                    chunk_content = chunk["agent"]["messages"][0].content
                    chunk_type = "agent"
                elif "tools" in chunk and "messages" in chunk["tools"]:
                    chunk_content = chunk["tools"]["messages"][0].content
                    chunk_type = "tools"
                else:
                    chunk_content = ""
                    continue
                chunk_content = response_formatter_main(chat_config.operator, chunk_content)
                yield json.dumps({"chunk": chunk_content, "type": chunk_type, "done": False}) + "\n"
                full_response += chunk_content
                _save_chat(
                    user_name,
                    chunk_type,
                    chat_config.base_model,
                    message,
                    chunk_content,
                )
    else:
        full_response = ""
        async for chunk in base_model_ins.astream(prompt.invoke(params)):
            if chunk:
                chunk = response_formatter_main(chat_config.operator, chunk.content)
                full_response += chunk
                yield json.dumps({"chunk": chunk, "type": "assisstent", "done": False}) + "\n"
        _save_chat(
            user_name,
            "assistant",
            chat_config.base_model,
            message,
            full_response,
        )

    
    yield json.dumps({"chunk": "", "done": True}) + "\n"


def create_streaming_response(
    user_name: str, message: str, image: str, chat_config: ChatConfig
) -> StreamingResponse:
    return StreamingResponse(
        chat_handler(user_name, message, image, chat_config),
        media_type="text/event-stream",
    )


async def chat_completions_handler(
    user_name: str, message: str, image: str, chat_config: ChatConfig
) -> str:
    output_log(
        f"Chat Completion for User: {user_name}, Message: {message}, Image: {image}, Config: {chat_config}",
        "debug",
    )

    prompt, params = _generate_prompt_params(message, image, chat_config)

    base_model_ins = get_model_instance_by_operator(
        chat_config.operator,
        chat_config.base_model,
    )
    if base_model_ins is None:
        return "Error: Model instance not found."
    
    if chat_config.tools_name != []:
        from services.tools_routers import tools_routers
        from langgraph.prebuilt import create_react_agent
        tools = tools_routers(chat_config.tools_name)
        llm_with_tools = base_model_ins.bind_tools(tools)
        agent = create_react_agent(
            model=llm_with_tools,
            tools=tools,
        )
        response = await agent.ainvoke(prompt.invoke(params))
        full_response = []
        for response_message in response["messages"]:
            if response_message.content:
                formatted_response = response_formatter_main(chat_config.operator, response_message.content)
                full_response.append(f"{response_message.type}: {formatted_response}")
                _save_chat(
                    user_name,
                    response_message.type,
                    chat_config.base_model,
                    message,
                    formatted_response,
                )
        full_response = "||\n".join(full_response)
    else:
        full_response = await base_model_ins.ainvoke(prompt.invoke(params))
        full_response = response_formatter_main(chat_config.operator, full_response.content)
        _save_chat(
            user_name,
            "assistant",
            chat_config.base_model,
            message,
            response,
        )
    return full_response


async def create_completion_response(
    user_name: str, message: str, image: str, chat_config: ChatConfig
) -> JSONResponse:
    result = await chat_completions_handler(user_name, message, image, chat_config)
    return JSONResponse(
        content=result,
        media_type="application/json",
    )


def create_batch_response(
    user_name: str, messages: list[str], image: str, chat_config: ChatConfig
) -> JSONResponse:
    if not isinstance(messages, list) or not messages:
        return JSONResponse(
            content={"error": "Invalid messages format."},
            status_code=400,
        )
    base_model_ins = get_model_instance_by_operator(
        chat_config.operator,
        chat_config.base_model,
    )
    if base_model_ins is None:
        return JSONResponse(
            content={"error": "Model instance not found."},
            status_code=500,
        )
    prompts = []
    for message in messages:
        prompt, params = _generate_prompt_params(message, image, chat_config)
        prompts.append(prompt.invoke(params))
    full_response = base_model_ins.batch(prompts)
    reponses = [
        response_formatter_main(chat_config.operator, response.content)
        for response in full_response
    ]
    for message, response in zip(messages, reponses):
        _save_chat(
            user_name,
            "assistant",
            chat_config.base_model,
            message,
            response,
        )
    return JSONResponse(
        content=reponses,
        media_type="application/json",
    )


def _save_chat(
    user_name, chat_type, base_model, human_input, ai_response,
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
