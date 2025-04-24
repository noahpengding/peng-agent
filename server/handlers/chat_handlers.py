from fastapi.responses import StreamingResponse, JSONResponse
from models.chat_config import ChatConfig
from services.rag_usage import RagUsage
from config.config import config
from utils.mysql_connect import MysqlConnect
from utils.log import output_log
from datetime import datetime, timedelta
from services.ollama_model import Ollama
from services.openai_response import CustomOpenAIResponse
from services.openai_completion import CustomOpenAICompletion
from services.gemini_langchain import CustomGemini
from services.claude_langchain import CustomClaude
from services.response_formatter import response_formatter_main
from handlers.operator_handlers import get_operator
import json
from typing import AsyncIterator


def get_model_instance_by_operator(operator_name, model_name: str = ""):
    operator = get_operator(operator_name)
    if operator is None:
        output_log(
            f"Operator {operator_name} not found in the database.",
            "error",
        )
        return None
    if operator.runtime == "openai_response":
        base_model_ins = CustomOpenAIResponse(
            base_url=operator.endpoint,
            api_key=operator.api_key,
            organization_id=operator.org_id,
            project_id=operator.project_id,
            model=model_name, 
        )
    elif operator.runtime == "openai_completion":
        base_model_ins = CustomOpenAICompletion(
            base_url=operator.endpoint,
            api_key=operator.api_key,
            organization_id=operator.org_id,
            project_id=operator.project_id,
            model=model_name, 
        )
    elif operator.runtime == "gemini":
        base_model_ins = CustomGemini(
            api_key=operator.api_key,
            model=model_name, 
        )
    elif operator.runtime == "ollama":
        base_model_ins = Ollama(
            model=model_name, model_type="chat"
        ).init()
    elif operator.runtime == "claude":
        base_model_ins = CustomClaude(
            api_key=operator.api_key,
            model=model_name, 
        )
    return base_model_ins


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
        yield json.dumps({"chunk": "Error: Model instance not found.", "done": True}) + "\n"
        return
    rag = RagUsage(
        user_name=user_name,
        base_model=base_model_ins,
        collection_name=chat_config.collection_name,
        embedding_model=chat_config.embedding_model,
    )

    full_response = ""
    async for chunk in rag.aquery_stream(
        input=message,
        short_term_memory=chat_config.short_term_memory,
        image=image,
    ):
        if chunk:
            chunk = response_formatter_main(chat_config.operator, chunk)
            full_response += chunk
            yield json.dumps({"chunk": chunk, "done": False}) + "\n"

    _save_chat(
        user_name,
        message,
        full_response,
        chat_config.base_model,
        chat_config.embedding_model,
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
    rag = RagUsage(
        user_name=user_name,
        base_model=base_model_ins,
        collection_name=chat_config.collection_name,
        embedding_model=chat_config.embedding_model,
    )
    full_response = await rag.aquery(
        input=message,
        short_term_memory=chat_config.short_term_memory,
        image=image,
    )
    full_response = response_formatter_main(chat_config.operator, full_response["answer"])
    _save_chat(
        user_name,
        message,
        full_response,
        chat_config.base_model,
        chat_config.embedding_model,
        chat_config.collection_name,
    )

    return full_response

async def create_completion_response(user_name: str, message: str, image: str, chat_config: ChatConfig) -> JSONResponse:
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
