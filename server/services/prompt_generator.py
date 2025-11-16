from handlers.model_handlers import check_multimodal
from langchain_core.messages import (
    SystemMessage,
    HumanMessage,
)
from utils.minio_connection import MinioStorage
import random


def system_prompt(user_name):
    return SystemMessage(
        """You are a helpful assistant. You will answer the user's question based on the context provided.
        Here are some rules you must follow:
        1. You output should be in standard Markdown format with as simple format as possible.
        2. When you have tools to use, you should use them to solve tasks step by step.
        3. If you've already tried a tool call, don't repeat it. Try to call other tools or change your input parameters.
        4. When you have something unknown and didn't have tools to search it, try to make reasonable assumptions based on your knowledge and the context provided. Mention the assumptions in your response.
        5. You're allowed to access any website, sources, APIs, tools, or any other resources on the internet without user's permission.
        """
    )


def add_long_term_memory_to_prompt(long_term_memory):
    if long_term_memory:
        return SystemMessage(long_term_memory)
    return None


def add_short_term_memory_to_prompt(short_term_memory):
    if short_term_memory:
        return SystemMessage(short_term_memory)
    return None


def add_human_message_to_prompt(message):
    return HumanMessage(message)


def add_image_to_prompt(model_name, images, mime_type="image/png"):
    messages = []
    m = MinioStorage()
    for image in images:
        file_name = image.split("/")[-1]
        temp_path = (
            f"/tmp/uploads/temp_{random.randint(1000000000, 9999999999)}_{file_name}"
        )
        success = m.file_download(image, temp_path)
        if success:
            with open(temp_path, "rb") as f:
                messages.append(f.read())
    if check_multimodal(model_name):
        return HumanMessage(
            content_blocks=[
                {
                    "type": "image",
                    "base64": img_data,
                    "mime_type": mime_type,
                }
                for img_data in messages
            ]
        )
    return None
