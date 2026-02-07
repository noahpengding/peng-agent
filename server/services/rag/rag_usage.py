from services.rag.qdrant_api import Qdrant
import services.prompt_generator as prompt_generator
from handlers.model_utils import get_model_instance
from config.config import config
from langchain_core.messages import AIMessage
from typing import AsyncIterator
from utils.log import output_log

def get_all_collections():
    qdrant = Qdrant(
        host=config.qdrant_host,
        port=config.qdrant_port,
        collection_name="default",
    )
    return qdrant.get_all_collections()

class RagUsage:
    def __init__(
        self,
        collection_name="default",
    ):
        self.collection_name = collection_name
        self.qdrant = Qdrant(
            host=config.qdrant_host,
            port=config.qdrant_port,
            collection_name=self.collection_name,
        )

    def similarity_search(self, query, k=10, score_threshold=0.65):
        return self.qdrant.similarity_search(
            query=query, k=k, score_threshold=score_threshold
        )