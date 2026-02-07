from qdrant_client import QdrantClient, models
from qdrant_client.models import VectorParams, Distance
from langchain_qdrant import QdrantVectorStore, RetrievalMode
from handlers.model_utils import get_embedding_instance
from utils.log import output_log
from config.config import config


class Qdrant:
    def __init__(
        self,
        host=config.qdrant_host,
        port=config.qdrant_port,
        collection_name="default",
    ):
        self.client = QdrantClient(host=host, port=port)
        self.collection_name = collection_name

    def setup(self):
        self.embedding = get_embedding_instance(
            model_name=config.embedding_model,
            operator_name=config.embedding_operator,
        )
        if not self.client.collection_exists(self.collection_name):
            output_log(
                f"Collection {self.collection_name} does not exist. Creating collection...",
                "info",
            )
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=config.embedding_size, distance=Distance.COSINE
                ),
            )
        self.qdrant_vector = QdrantVectorStore(
            client=self.client,
            embedding=self.embedding,
            collection_name=self.collection_name,
            retrieval_mode=RetrievalMode.DENSE,
        )

    def add_alias(self, collection_name, alias_name):
        self.client.update_collection_aliases(
            change_aliases_operations=[
                models.CreateAliasOperation(
                    create_alias=models.CreateAlias(
                        collection_name=collection_name, alias_name=alias_name
                    )
                )
            ]
        )
        return f"Alias {alias_name} added to collection {collection_name}"

    def add_documents(self, local_path, chunks):
        self.setup()
        self._remove_document(local_path)
        self.qdrant_vector.add_documents(chunks)

    def add_texts(self, local_path, texts):
        self.setup()
        self._remove_document(local_path)
        self.qdrant_vector.add_texts(texts)

    def get_all_collections(self):
        collections = self.client.get_collections()
        collection_names = [collection.name for collection in collections.collections]
        return collection_names

    def _remove_document(self, source):
        output_log(f"Removing document with source {source}...", "info")
        point_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="metadata.source",
                    match=models.MatchValue(value=source),
                ),
            ],
        )
        self.client.delete(
            collection_name=self.collection_name, points_selector=point_filter
        )

    def similarity_search(self, query, k=5, score_threshold=0.65):
        self.setup()
        results = self.qdrant_vector.similarity_search(
            query=query,
            k=k,
            score_threshold=score_threshold,
        )
        return results
