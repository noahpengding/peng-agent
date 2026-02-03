from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from services.rag.qdrant_api import Qdrant
from handlers.model_utils import get_embedding_instance
from config.config import config
from utils.minio_connection import MinioStorage
from utils.mysql_connect import MysqlConnect
from utils.log import output_log
from datetime import datetime
import os
import tempfile
import base64
import io
import fitz
from PIL import Image


class RagBuilder:
    def __init__(
        self,
        user_name,
        collection_name,
    ):
        self.user_name = user_name
        self.collection_name = collection_name
        self.temp_dir = tempfile.mkdtemp()
        self.embeddings = get_embedding_instance(
            model_name=config.embedding_model,
            operator_name=config.embedding_operator,
        )
        self.qdrant = Qdrant(
            host=config.qdrant_host,
            port=config.qdrant_port,
            collection_name=self.collection_name,
        )
        self.mysql = MysqlConnect()
        self.minio = MinioStorage()

    def _add_to_db(
        self, local_path, type_of_file, file_path, create_by="Python RAG Builder"
    ):
        title = local_path.split("/")[-1]
        mysql = self.mysql
        if (
            len(
                mysql.read_records(
                    "knowledge_base",
                    {
                        "title": title,
                        "knowledge_base": self.collection_name,
                    },
                )
            )
            != 0
        ):
            mysql.update_record(
                "knowledge_base",
                {"modified_at": datetime.now()},
                {"title": title},
            )
        else:
            mysql.create_record(
                "knowledge_base",
                {
                    "user_name": self.user_name,
                    "knowledge_base": self.collection_name,
                    "title": title,
                    "type": type_of_file,
                    "path": file_path,
                    "source": local_path,
                    "created_by": create_by,
                },
            )

    def file_process(self, file_path, type_of_file) -> None:
        m = self.minio
        local_path = os.path.join(self.temp_dir, os.path.basename(file_path))
        m.file_download(file_path, local_path)
        if type_of_file == "standard":
            chucks = self._pure_text_pdf_process(local_path)
            self.qdrant.add_documents(local_path.split("/")[-1], chucks)
        elif type_of_file == "handwriting":
            chucks = self._handwriting_pdf_process(local_path)
            self.qdrant.add_texts(local_path.split("/")[-1], chucks)
        output_log(f"Text chunks: {chucks}", "debug")
        self._add_to_db(local_path, type_of_file, file_path)
        os.remove(local_path)

    def text_process(self, local_path, text, file_path, create_by="Text") -> None:
        chunks = self._pure_text_text_process(text)
        output_log(f"Text chunks: {chunks}", "debug")
        self.qdrant.add_texts(local_path.split("/")[-1], chunks)
        self._add_to_db(local_path, "standard", file_path, create_by)

    def _pdf_page_to_base64(self, pdf_path: str, page_number: int):
        pdf_document = fitz.open(pdf_path)
        page = pdf_document.load_page(page_number - 1)
        pix = page.get_pixmap()
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return f"data:image/jpeg;base64,{base64.b64encode(buffer.getvalue()).decode('utf-8')}"

    def _pdf_to_base64(self, pdf_path: str):
        pdf_document = fitz.open(pdf_path)
        base64_images = []
        for page_number in range(len(pdf_document)):
            base64_images.append(self._pdf_page_to_base64(pdf_path, page_number + 1))
        return base64_images

    def _pure_text_pdf_process(self, file_path):
        loader = PyPDFLoader(file_path)
        documents = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=300, chunk_overlap=20, length_function=len
        )
        chunks = text_splitter.split_documents(documents)
        return chunks

    def _pure_text_text_process(self, text):
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=300, chunk_overlap=20, length_function=len
        )
        chunks = text_splitter.split_text(text)
        return chunks

    def _process_single_image(self, base64_image):
        from handlers.model_utils import get_model_instance

        prompt = [
            (
                "system",
                """
            The image attached is a handwriting note. Read and describe any information you can find. 
            Rules:
            1. Identify all noun phrases, named entities, numbers, dates, locations, and technical terms.
            2. Make sure the information is mathematically correct and make sense.
            3. All information should be directly coming from the image.
            4. All information should be in standard Markdown format with as simple format as possible.
            """,
            ),
            ("human", base64_image),
        ]
        base_model_ins = get_model_instance(
            model_name=config.default_base_model,
            operator_name=config.default_operator,
        )
        return base_model_ins.invoke(prompt).content

    def _handwriting_pdf_process(self, file_path):
        base64_images = self._pdf_to_base64(file_path)
        results = []
        for image in base64_images:
            results.append(self._process_single_image(image))
        output_log(f"Text chunks: {results}", "debug")
        combined_text = "\n\n".join(results)
        return self._pure_text_text_process(combined_text)
