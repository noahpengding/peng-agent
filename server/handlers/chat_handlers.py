from fastapi.responses import StreamingResponse
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
from langchain_azure_ai.chat_models import AzureAIChatCompletionsModel
import json
from typing import AsyncIterator


async def chat_handler(
    user_name: str, message: str, image: str, chat_config: ChatConfig
) -> AsyncIterator[str]:
    output_log(
        f"Streaming chat for User: {user_name}, Message: {message}, Image: {image}, Config: {chat_config}",
        "debug",
    )

    if chat_config.operator == "openai":
        base_model_ins = CustomOpenAIResponse(
            model=chat_config.base_model, streaming=True
        )
    elif chat_config.operator == "rag":
        base_model_ins = Ollama(model=chat_config.base_model, model_type="chat").init()
    elif chat_config.operator == "gemini":
        base_model_ins = CustomGemini(model=chat_config.base_model)
    elif chat_config.operator == "azure":
        base_model_ins = AzureAIChatCompletionsModel(
            endpoint=config.azure_endpoint,
            credential=config.azure_key,
            model_name=chat_config.base_model,
        )
    elif chat_config.operator == "deepseek":
        base_model_ins = CustomOpenAICompletion(
            model=chat_config.base_model,
            base_url="https://api.deepseek.com",
            api_key=config.deepseek_api_key,
        )
    rag = RagUsage(
        user_name=user_name,
        base_model=base_model_ins,
        collection_name=chat_config.collection_name,
        embedding_model=chat_config.embedding_model,
    )

    full_response = ""
    async for chunk in rag.aquery(
        input=message,
        short_term_memory=chat_config.short_term_memory,
        image=image,
    ):
        if chunk:
            chunk = chunk.replace("\n\n", "\n").replace("\n*", "\n")
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
