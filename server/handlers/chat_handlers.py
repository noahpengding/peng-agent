from models.chat_config import ChatConfig
from services.peng_agent import save_chat, PengAgent, AgentState
from utils.log import output_log
from services.response_formatter import response_formatter_main
import services.prompt_generator as prompt_generator
from handlers.model_utils import get_model_instance_by_operator
from fastapi.responses import StreamingResponse, JSONResponse
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

    agent = PengAgent(
        user_name,
        chat_config.operator,
        chat_config.base_model,
        chat_config.tools_name,
    )
    yield (json.dumps({"chunk": "Agent Created\n", "type": "output_text", "done": False}) + "\n")

    full_response = ""
    try:
        async for chunk in agent.astream(AgentState(prompt.invoke(params))):
            output_log(f"Received chunk: {chunk}", "DEBUG")
            if chunk:
                if "call_model" in chunk and "messages" in chunk["call_model"]:
                    chunk_content = str(chunk["call_model"]["messages"].content)
                    chunk_type = chunk["call_model"]["messages"].additional_kwargs.get(
                        "type", "output_text"
                    )
                elif "call_tools" in chunk and "messages" in chunk["call_tools"]:
                    chunk_content = chunk["call_tools"]["messages"]
                    if isinstance(chunk_content, list):
                        chunk_content = chunk_content[0].content
                    else:
                        chunk_content = chunk_content.content
                    chunk_type = "tool_calls"
                else:
                    chunk_content = ""
                    continue
                chunk_content = response_formatter_main(chat_config.operator, chunk_content)
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
        yield (json.dumps({"chunk": f"Error: {str(e)}", "type": "output_text", "done": False}) + "\n")
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

    agent = PengAgent(
        operater=chat_config.operator,
        model=chat_config.base_model,
        tools=chat_config.tools_name,
        user_name=user_name,
    )
    response = await agent.ainvoke(prompt.invoke(params))
    full_response = response_formatter_main(
        chat_config.operator,
        response["messages"][-1].content if "messages" in response else str(response),
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
        save_chat(
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
