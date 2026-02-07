from services.rag.qdrant_api import Qdrant
from config.config import config

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