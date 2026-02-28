from handlers.model_handlers import check_multimodal
from langchain_core.messages import (
    SystemMessage,
    HumanMessage,
    AIMessage,
)
from utils.minio_connection import MinioStorage
from utils.log import output_log
import base64
import json


def system_prompt(user_name, mysql_conn):
    user_profile = mysql_conn.read_records("user", conditions={"user_name": user_name})
    system_prompt = str(user_profile[0]["system_prompt"]) if user_profile and "system_prompt" in user_profile[0] else "You are a helpful assistant."
    lt_mem = json.loads(user_profile[0]["long_term_memory"]) if user_profile and "long_term_memory" in user_profile[0] and user_profile[0]["long_term_memory"] else []
    return [
        SystemMessage(system_prompt),
        SystemMessage(f"Here are the background information of the user {";".join(lt_mem)}") if lt_mem != [] else SystemMessage("No background information about the user.")
    ]


def add_short_term_memory_to_prompt(short_term_memory, mysql_conn, model_name) -> list:
    result = []
    if isinstance(short_term_memory, list) and short_term_memory:
        reasonings_list = mysql_conn.read_records("ai_reasoning", conditions={"chat_id": short_term_memory})
        responses_list = mysql_conn.read_records("ai_response", conditions={"chat_id": short_term_memory})
        user_input_list = mysql_conn.read_records("user_input", conditions={"chat_id": short_term_memory})

        # Sort by id to ensure deterministic order (assuming id is auto-incrementing)
        reasonings_list.sort(key=lambda x: x["id"])
        responses_list.sort(key=lambda x: x["id"])
        user_input_list.sort(key=lambda x: x["id"])

        reasonings_map = {}
        for r in reasonings_list:
            reasonings_map.setdefault(r["chat_id"], []).append(r)

        responses_map = {}
        for r in responses_list:
            responses_map.setdefault(r["chat_id"], []).append(r)

        user_input_map = {}
        for r in user_input_list:
            user_input_map.setdefault(r["chat_id"], []).append(r)

        for msg_id in short_term_memory:
            reasonings = reasonings_map.get(msg_id, [])
            responses = responses_map.get(msg_id, [])
            user_inputs = user_input_map.get(msg_id, [])

            if user_inputs:
                user_input = user_inputs[0]
                result += add_human_message_to_prompt(user_input["input_content"]) if user_input["input_content"] else []
                result += add_image_to_prompt(model_name, user_input["input_location"]) if user_input["input_location"] else []

            if reasonings:
                result.append(AIMessage(content_blocks=[
                    {
                        "type": "reasoning",
                        "reasoning": reasoning["reasoning_process"],

                    }
                    for reasoning in reasonings
                ]))
            for response in responses:
                result.append(AIMessage(response["ai_response"]))

    output_log(f"Short-term memory added to prompt: {result}", "debug")
    return result


def add_human_message_to_prompt(message) -> list[HumanMessage]:
    return [HumanMessage(message)]


def add_knowledge_base_to_prompt(knowledge_base, message) -> list[SystemMessage]:
    from services.rag.rag_usage import get_all_collections
    if knowledge_base == "default":
        return []

    if knowledge_base in get_all_collections():
        from services.rag.rag_usage import RagUsage

        rag = RagUsage(collection_name=knowledge_base)
        result = rag.similarity_search(message, k=5, score_threshold=0.3)
        context = "\n\n".join([doc.page_content for doc in result])
        return [SystemMessage(f"Knowledge Base Context:\n{context}")]
    return []


def add_image_to_prompt(model_name, images, mime_type="image/png") -> list:
    if images is None or images == "":
        return []

    if not isinstance(images, list):
        images = [images]
    
    output_log(f"Adding images to prompt for model {model_name}: {images}", "debug")
    messages = []
    m = MinioStorage()
    for image in images:
        img_data = m.file_download_to_memory(file_name=image)
        if img_data:
            # Compute per-image mime_type from file extension
            file_name = image.split("/")[-1]
            file_ext = file_name.split('.')[-1]
            img_mime_type = f"image/{file_ext}" if file_ext else mime_type
            messages.append({
                "data": img_data,
                "mime_type": img_mime_type
            })
    if check_multimodal(model_name) and messages:
        return [HumanMessage(
            content_blocks=[
                {
                    "type": "image",
                    "base64": base64.b64encode(msg["data"]),
                    "mime_type": msg["mime_type"],
                }
                for msg in messages
            ]
        )]
    return []
