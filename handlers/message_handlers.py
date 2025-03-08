import json
from .file_handlers import file_downloader, file_operator, file_operator_image, file_extention
from utils.minio_connection import MinioStorage
from services.openai_api import OpenAIHandler
from services.qdrant_api import Qdrant
from services.rag_usage import RagUsage
from datetime import datetime
from handlers.rag_handler import index_all, index_file, rag_extractor
from utils.log import output_log

def CreateMessage(user_name, type, operator, file_path, message) -> str:
    message_file = []
    if file_path != "":
        local_file_path, eil = file_downloader(file_path)
        if not eil:
            return f"Error downloading file {file_path}"
        if file_extention(local_file_path):
            message += file_operator(local_file_path)
        else:
            message_file = file_operator_image(local_file_path)
    if operator == "openai":
        o = OpenAIHandler(user_name)
        if type == "chat":
            return o.chat_completion(message, message_file)
        if type == "list_models":
            return o.list_models()
        if type == "list_parameters":
            return o.list_parameters()
        if type == "set_parameters":
            name, value = message.split("=")
            return o.set_parameters(name, value)
        if type == "get_conversations":
            return o.get_conversations()
        if type == "list_conversations":
            m = MinioStorage()
            return '\n'.join(m.file_list_name(prefix=f"peng-bot/chat/"))
        if type == "end":
            m = MinioStorage()
            file_name = f"{datetime.now().strftime('%Y_%m_%d_%H_%M')}.json"
            with open(f"tmp/{file_name}", "w") as file:
                file.write(json.dumps(o.get_conversations()))
            m.file_upload(f"tmp/{file_name}", f"peng-bot/chat/{file_name}", "application/json")
            o.end_conversation()
            return f"Conversation ended and saved as {file_name}"
    elif operator == "rag":
        if type == "index_all":
            folder_path, collection_name = message.split(" ")
            return index_all(user_name, folder_path, collection_name)
        if type == "index_file":
            file_path, collection_name = message.split(" ")
            return index_file(user_name, file_path, collection_name)
        if type == "set_alias":
            collection_name, alias_name = message.split(" ")
            return Qdrant().add_alias(collection_name, alias_name)
        if type == "chat":
            collection_name, model_name, embedding_model = rag_extractor(message)
            return RagUsage(
                user_name = user_name,
                collection_name=collection_name, 
                base_model=model_name, 
                embedding_model=embedding_model
            ).query(message)
    return "Error: Invalid operator or type"
