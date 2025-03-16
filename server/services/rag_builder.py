from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from services.ollama_model import Ollama
from services.qdrant_api import Qdrant
from config.config import config
from utils.minio_connection import MinioStorage
from utils.mysql_connect import MysqlConnect
from datetime import datetime


class RagBuilder:
    def __init__(self, user_name, file_path, collection_name, file_type="pdf", embedding_model=config.default_embedding_model):
        self.user_name = user_name
        self.file_path = file_path
        self.file_type = file_type
        self.collection_name = collection_name
        self.local_path = f"/tmp/{file_path.split('/')[-1]}"
        self.embeddings = Ollama(model = embedding_model, model_type = "embeddings").init()
        self.qdrant = Qdrant(host=config.qdrant_host, port=config.qdrant_port, collection_name=self.collection_name, embedding=embedding_model)

    def file_process(self):
        m = MinioStorage()
        m.file_download(self.file_path, self.local_path)
        chucks = None
        if self.file_type == "pdf":
            chucks = self._process_pdf(self.local_path)
        self.qdrant.add_documents(self.local_path, chucks)
        mysql = MysqlConnect()
        if len(mysql.read_records("knowledge_base", {"title": self.local_path.split("/")[-1], "knowledge_base": self.collection_name})) != 0:
            mysql.update_record(
                "knowledge_base",
                {"modified_at": datetime.now()},
                {"title": self.local_path.split("/")[-1]}
            )
        else:
            mysql.create_record(
                "knowledge_base",
                {
                    "user_name": self.user_name,
                    "knowledge_base": self.collection_name,
                    "title": self.local_path.split("/")[-1],
                    "type": self.file_type,
                    "path": self.file_path,
                    "source": self.local_path,
                    "created_by": "python RAG builder"
                }
            )
        mysql.close()

    def _process_pdf(self, file_path):
        loader = PyPDFLoader(file_path)
        documents = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        chunks = text_splitter.split_documents(documents)
        return chunks
