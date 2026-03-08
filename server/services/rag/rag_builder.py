from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from services.rag.qdrant_api import Qdrant
from handlers.model_utils import get_embedding_instance
from config.config import config
from utils.minio_connection import MinioStorage
from services.redis_service import get_table_record, create_table_record, update_table_record
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
        self.minio = MinioStorage(user_name=self.user_name)

    def _add_to_db(
        self, local_path, type_of_file, file_path, create_by="Python RAG Builder"
    ):
        title = local_path.split("/")[-1]
        existing = get_table_record("knowledge_base", record_id=file_path)
        if existing:
            update_table_record(
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
                {"path": file_path},
                redis_id="path",
            )
        else:
            create_table_record(
                "knowledge_base",
                {
                    "user_name": self.user_name,
                    "knowledge_base": self.collection_name,
                    "title": title,
                    "type": type_of_file,
                    "path": file_path,
                    "source": local_path,
                    "created_by": create_by,
                    "created_at": datetime.now().isoformat(),
                },
                redis_id="path",
            )

    async def file_process(self, file_path, type_of_file) -> None:
        m = self.minio
        local_path = os.path.join(self.temp_dir, os.path.basename(file_path))
        m.file_download(file_path, local_path)
        if type_of_file == "standard":
            chucks = self._pure_text_pdf_process(local_path)
            self.qdrant.add_documents(local_path.split("/")[-1], chucks)
        elif type_of_file == "handwriting":
            chucks = await self._handwriting_pdf_process(local_path)
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
        from handlers.file_handlers import file_upload_frontend
        pdf_document = fitz.open(pdf_path)
        page = pdf_document.load_page(page_number - 1)
        pix = page.get_pixmap()
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        content = f"data:image/jpeg;base64,{base64.b64encode(buffer.getvalue()).decode('utf-8')}"
        uploaded_path, success = file_upload_frontend(content, "image/jpeg", user_name=self.user_name)
        if success:
            return uploaded_path
        output_log(f"Failed to upload image for page {page_number} of PDF {pdf_path}", "error")
        return ""

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
            chunk_size=600, chunk_overlap=120, length_function=len
        )
        chunks = text_splitter.split_documents(documents)
        return chunks

    def _pure_text_text_process(self, text):
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=600, chunk_overlap=120, length_function=len
        )
        chunks = text_splitter.split_text(text)
        return chunks

    async def _process_single_image(self, base64_image):
        from handlers.chat_handlers import chat_completions_handler
        from models.chat_config import ChatConfig

        prompt = """
            The image attached is a handwriting note. Read and extract any information you can find. 
            Rules:
            1. Identify all noun phrases, named entities, numbers, dates, locations, and technical terms.
            2. Make sure the information is mathematically correct and make sense.
            3. All information should be directly coming from the image.
            4. All information should be in standard Markdown format with as simple format as possible.
            """
        chat_config = ChatConfig(
            operator=config.default_operator,
            base_model=config.default_base_model,
        )
        try:
            orc_result = await chat_completions_handler(
                user_name=self.user_name,
                message=prompt,
                knowledge_base=None,
                image=[base64_image],
                chat_config=chat_config,
            )
            print(f"OCR result: {orc_result}")
            orc_result = orc_result[-1].content[0]["text"].strip()
            return orc_result
        except Exception as e:
            output_log(f"Error processing handwriting image: {e}", "error")
            return ""

    async def _handwriting_pdf_process(self, file_path):
        base64_images = self._pdf_to_base64(file_path)
        results = []
        for image in base64_images:
            ocr_result = await self._process_single_image(image)
            results.append(ocr_result)
        output_log(f"Text chunks: {results}", "debug")
        combined_text = ""
        for result in results:
            if isinstance(result, list):
                result = result[0]
            combined_text += str(result) + "\n"
        return self._pure_text_text_process(combined_text)
