from qdrant_client import QdrantClient, models
from qdrant_client.models import VectorParams, Distance
from langchain_qdrant import QdrantVectorStore
from services.ollama_model import Ollama
from utils.log import output_log
from config.config import config

class Qdrant:
    def __init__(self, host=config.qdrant_host, port=config.qdrant_port, collection_name = "default", embedding="nomic-embed-text"):
        self.client = QdrantClient(host=host, port=port)
        self.collection_name = collection_name
        self.embedding = Ollama(model=embedding, model_type="embeddings").init()
        if not self.client.collection_exists(collection_name):
            output_log(f"Collection {collection_name} does not exist. Creating collection...", "info")
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=768, distance=Distance.COSINE)
            )
        self.qdrant_vector = QdrantVectorStore(
            client=self.client,
            embedding=self.embedding,
            collection_name=self.collection_name
        )
    
    def add_alias(self, collection_name, alias_name):
        self.client.update_collection_aliases(change_aliases_operations=[
            models.CreateAliasOperation(
                create_alias=models.CreateAlias(
                    collection_name=collection_name, alias_name=alias_name
                )
            )
        ])
        return f"Alias {alias_name} added to collection {collection_name}"

    def add_documents(self, local_path, chunks):
        self._remove_document(local_path)
        self.qdrant_vector.add_documents(chunks)

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
        self.client.delete(collection_name=self.collection_name, points_selector=point_filter)

    def as_retriever(self, search_kwargs):
        return self.qdrant_vector.as_retriever(search_kwargs=search_kwargs)