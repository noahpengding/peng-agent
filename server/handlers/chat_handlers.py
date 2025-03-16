from models.chat_config import ChatConfig
from models.agent_response import ChatResponse
from services.openai_api import OpenAIHandler
from services.rag_usage import RagUsage


def chat_handler(user_name: str, message: str, config: ChatConfig) -> ChatResponse:
    return ChatResponse(
        user_name=user_name,
        message=_create_message(
            user_name,
            message,
            config.operator,
            config.base_model,
            config.embedding_model,
            config.collection_name,
            config.web_search,
            config.short_term_memory,
            config.long_term_memory
        )
    )

def _create_message(user_name, message, operator, base_model, embedding_model, collection_name, web_search, short_term_memory, long_term_memory):
    if operator == "openai":
        o = OpenAIHandler(user_name)
        o.set_parameters("model_id", base_model)
        return o.chat_completion(message)
    elif operator == "rag":
        r = RagUsage(
            user_name=user_name,
            base_model=base_model,
            collection_name=collection_name,
            embedding_model=embedding_model
        )
        response = r.query(message)
        return response.replace("\n\n", "\n")

