from services.rag_builder import RagBuilder
from utils.log import output_log
from utils.minio_connection import MinioStorage
from config.config import config
import re

def index_file(user_name, file_path, collection_name):
    rag_builder = RagBuilder(user_name, file_path, collection_name)
    rag_builder.file_process()
    output_log(f"File {file_path} is put into the collection {collection_name}", "info")
    return f"File {file_path} is put into the collection {collection_name}"

def index_all(user_name, folder_path, collection_name):
    m = MinioStorage()
    for file in m.file_list_name(prefix=folder_path):
        index_file(user_name, file, collection_name)
    output_log(f"All files in {folder_path} are put into the collection {collection_name}", "info")
    return f"All files in {folder_path} are put into the collection {collection_name}"

def rag_extractor(message):
    collection_name = re.search(r'collection=(\S+)', message).group(1) if re.search(r'collection=(\S+)', message) else "default"
    model_name = re.search(r'model=(\S+)', message).group(1) if re.search(r'model=(\S+)', message) else config.default_base_model
    embedding_model = re.search(r'embedding=(\S+)', message).group(1) if re.search(r'embedding=(\S+)', message) else config.default_embedding_model
    return collection_name, model_name, embedding_model