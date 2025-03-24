from models.chat_config import ChatConfig
from models.agent_response import ChatResponse
from services.openai_api import OpenAIHandler
from services.rag_usage import RagUsage
from config.config import config
from services.azure_document import AzureDocument


def chat_handler(user_name: str, message: str, image: str, config: ChatConfig) -> ChatResponse:
    return ChatResponse(
        user_name=user_name,
        message=_create_message(
            user_name,
            message,
            image,
            config.operator,
            config.base_model,
            config.embedding_model,
            config.collection_name,
            config.web_search,
            config.short_term_memory,
            config.long_term_memory
        )
    )

def _create_message(user_name, message, image, operator, base_model, embedding_model, collection_name, web_search, short_term_memory, long_term_memory):
    prompt = []
    prompt.append({
        "role": "system",
        "content": [{
            "type": "text",
            "text": config.start_prompt
        }]
    })
    if short_term_memory:
        for memory in short_term_memory:
            prompt.append({
                "role": "assistant",
                "content": [{
                    "type": "text",
                    "text": memory
                }]
            })
    if image != "":
        az = AzureDocument()
        message += az.analyze_document(image)
    prompt.append(
        {
            "role": "user",
            "content": [{
                "type": "text",
                "text": message
            }]
        }
    )
    if operator == "openai":
        o = OpenAIHandler(user_name)
        o.set_parameters("model_id", base_model)
        return o.chat_completion(prompt, message).replace("\n\n", "\n")
    elif operator == "rag":
        r = RagUsage(
            user_name=user_name,
            base_model=base_model,
            collection_name=collection_name,
            embedding_model=embedding_model
        )
        response = r.query(message, short_term_memory)
        return response.replace("\n\n", "\n")

