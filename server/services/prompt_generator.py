from handlers.model_handlers import check_multimodal
from langchain_core.messages import (
    SystemMessage,
    HumanMessage,
    AIMessage,
)
from utils.minio_connection import MinioStorage
import base64
import tempfile
import os


def system_prompt(user_name):
    return [SystemMessage(
        """You are a helpful assistant. You will answer the user's question based on the context provided.
        Here are some rules you must follow:
        1. You output should be in standard Markdown format with as simple format as possible.
        2. When you have tools to use, you should use them to solve tasks step by step.
        3. If you've already tried a tool call, don't repeat it. Try to call other tools or change your input parameters.
        4. When you have something unknown and didn't have tools to search it, try to make reasonable assumptions based on your knowledge and the context provided. Mention the assumptions in your response.
        5. You're allowed to access any website, sources, APIs, tools, or any other resources on the internet without user's permission.
        """
    )]


def add_long_term_memory_to_prompt(long_term_memory) -> list[SystemMessage]:
    if long_term_memory:
        return [SystemMessage(long_term_memory)]
    return []


def add_short_term_memory_to_prompt(short_term_memory, mysql_conn) -> list:
    result = []
    if isinstance(short_term_memory, list):
        for msg_id in short_term_memory:
            reasoings = mysql_conn.read_records("ai_reasoning", conditions={"chat_id": msg_id})
            responses = mysql_conn.read_records("ai_response", conditions={"chat_id": msg_id})
            chat = mysql_conn.read_records("chat", conditions={"id": msg_id})
            if chat:
                chat = chat[0]
                result.append(HumanMessage(chat["human_input"]))
                result.append(AIMessage(content_blocks=[
                    {
                        "type": "reasoning",
                        "reasoning": reasoning["reasoning_process"],

                    }
                    for reasoning in reasoings
                ]))
                for response in responses:
                    result.append(AIMessage(response["ai_response"]))
    return result


def add_human_message_to_prompt(message) -> list[HumanMessage]:
    return [HumanMessage(message)]


def add_image_to_prompt(model_name, images, mime_type="image/png") -> list:
    # Normalize images to a list
    if isinstance(images, str):
        if not images:
            return []
        images = [images]
    elif not images:
        return []
    
    messages = []
    m = MinioStorage()
    with tempfile.TemporaryDirectory() as temp_dir:
        for image in images:
            file_name = image.split("/")[-1]
            temp_path = os.path.join(temp_dir, file_name)
            success = m.file_download(file_name=image, download_path=temp_path)
            if success:
                with open(temp_path, "rb") as f:
                    img_data = f.read()
                    # Compute per-image mime_type from file extension
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
