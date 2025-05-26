from utils.mysql_connect import MysqlConnect
from services.rag_builder import RagBuilder
from utils.log import output_log
from utils.minio_connection import MinioStorage


def get_rag():
    mysql = MysqlConnect()
    return mysql.read_records("knowledge_base")


def index_file(user_name, file_path, type_of_file, collection_name):
    rag_builder = RagBuilder(user_name, collection_name)
    rag_builder.file_process(file_path, type_of_file)
    output_log(f"File {file_path} is put into the collection {collection_name}", "info")
    return f"File {file_path} is put into the collection {collection_name}"


def index_all(user_name, folder_path, type_of_file, collection_name):
    m = MinioStorage()
    output_log(
        f"Indexing all files in {folder_path} into the collection {collection_name}",
        "debug",
    )
    for file in m.file_list_name(prefix=folder_path):
        if not file.endswith(".pdf"):
            output_log(
                f"File {file} does not match the type pdf, skipping.",
                "info",
            )
            continue
        index_file(user_name, file, type_of_file, collection_name)
    output_log(
        f"All files in {folder_path} are put into the collection {collection_name}",
        "info",
    )
    return f"All files in {folder_path} are put into the collection {collection_name}"
