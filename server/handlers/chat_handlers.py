from models.chat_config import ChatConfig
from models.agent_response import ChatResponse
from services.rag_usage import RagUsage
from config.config import config
from services.azure_document import AzureDocument
from utils.mysql_connect import MysqlConnect
from utils.log import output_log
from datetime import datetime, timedelta
from services.ollama_model import Ollama
from services.openai_langchain import CustomOpenAI


def chat_handler(
    user_name: str, message: str, image: str, config: ChatConfig
) -> ChatResponse:
    if image != "":
        az = AzureDocument()
        message += az.analyze_document(image)
    if config.operator == "openai":
        base_model_ins = CustomOpenAI(model=config.base_model)
    elif config.operator == "rag":
        base_model_ins = Ollama(model=config.base_model, model_type="chat").init()
    r = RagUsage(
        user_name=user_name,
        base_model=base_model_ins,
        collection_name=config.collection_name,
        embedding_model=config.embedding_model,
    )
    response = r.query(
        input=message,
        short_term_memory=config.short_term_memory,
    )
    response = response.replace("\n\n", "\n").replace("\n*", "\n")
    _save_chat(
        user_name,
        message,
        response,
        config.base_model,
        config.embedding_model,
        config.collection_name,
    )
    return ChatResponse(
        user_name=user_name,
        message=response,
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
