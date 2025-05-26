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


async def chat_handler(
    user_name: str, message: str, image: str, chat_config: ChatConfig
) -> AsyncIterator[str]:
    output_log(
        f"Streaming chat for User: {user_name}, Message: {message}, Image: {image}, Config: {chat_config}",
        "debug",
    )

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
    prompt = prompt_generator.prompt_template(
        model_name=chat_config.base_model,
        has_document=chat_config.collection_name != "default",
        has_websearch=chat_config.web_search,
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
    if chat_config.web_search:
        params = prompt_generator.add_websearch_to_prompt(
            params=params,
            query=message,
        )
    if chat_config.collection_name != "default":
        params = prompt_generator.add_document_to_prompt(
            params=params,
            query=message,
            collection_name=chat_config.collection_name,
        )
    full_response = ""
    async for chunk in base_model_ins.astream(prompt.invoke(params)):
        if chunk:
            chunk = response_formatter_main(chat_config.operator, chunk.content)
            full_response += chunk
            yield json.dumps({"chunk": chunk, "done": False}) + "\n"

    _save_chat(
        user_name,
        message,
        full_response,
        chat_config.base_model,
        config.embedding_model,
        chat_config.collection_name,
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
    base_model_ins = get_model_instance_by_operator(
        chat_config.operator,
        chat_config.base_model,
    )
    if base_model_ins is None:
        return "Error: Model instance not found."
    prompt = prompt_generator.prompt_template(
        model_name=chat_config.base_model,
        has_document=chat_config.collection_name != "default",
        has_websearch=chat_config.web_search,
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
    if chat_config.web_search:
        params = prompt_generator.add_websearch_to_prompt(
            params=params,
            query=message,
        )
    if chat_config.collection_name != "default":
        params = prompt_generator.add_document_to_prompt(
            params=params,
            query=message,
            collection_name=chat_config.collection_name,
        )
    full_response = await base_model_ins.ainvoke(prompt.invoke(params))
    full_response = response_formatter_main(
        chat_config.operator, full_response.content
    )
    _save_chat(
        user_name,
        message,
        full_response,
        chat_config.base_model,
        config.embedding_model,
        chat_config.collection_name,
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


def _save_chat(
    user_name, message, reponse, base_model, embedding_model, collection_name
):
    mysql = MysqlConnect()
    try:
        mysql.create_record(
            "chat",
            {
                "user_name": user_name,
                "base_model": base_model,
                "embedding_model": embedding_model,
                "human_input": message[: config.input_max_length]
                if len(message) > config.input_max_length
                else message,
                "ai_response": reponse[: config.output_max_length]
                if len(reponse) > config.output_max_length
                else reponse,
                "knowledge_base": collection_name,
                "created_at": datetime.now(),
                "expire_at": datetime.now() + timedelta(days=7),
            },
        )
    except Exception as e:
        output_log(f"Error saving chat: {e}", "error")
    finally:
        mysql.close()
