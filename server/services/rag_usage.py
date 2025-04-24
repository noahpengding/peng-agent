from services.qdrant_api import Qdrant
import services.prompt_generator as prompt_generator
from config.config import config
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain
from typing import AsyncIterator
from utils.log import output_log
from services.azure_document import AzureDocument


class RagUsage:
    def __init__(
        self,
        base_model,
        user_name="default",
        collection_name="default",
        embedding_model=config.default_embedding_model,
    ):
        self.user_name = user_name
        self.collection_name = collection_name
        self.embedding_model = embedding_model
        self.qdrant = Qdrant(
            host=config.qdrant_host,
            port=config.qdrant_port,
            collection_name=collection_name,
            embedding=embedding_model,
        )
        self.llm = base_model
        self.setup()

    def setup(self):
        retriever = self.qdrant.as_retriever(search_kwargs={"k": 5})
        prompt = prompt_generator.prompt_template()
        combine_docs_chain = create_stuff_documents_chain(self.llm, prompt)
        self.chain = create_retrieval_chain(retriever, combine_docs_chain)

    def _prompt_prepare(self, **kwargs):
        params = {}
        if "input" in kwargs and kwargs["input"] != "":
            params["input"] = kwargs["input"]
        if "image" in kwargs and kwargs["image"] != "":
            az = AzureDocument()
            params["input"] += az.analyze_document(kwargs["image"])
        if "short_term_memory" in kwargs and kwargs["short_term_memory"] != []:
            params["short_term_memory"] = [
                ("system", i) for i in kwargs["short_term_memory"]
            ]
        if "long_term_memory" in kwargs and kwargs["long_term_memory"] != []:
            params["long_term_memory"] = [
                ("system", i) for i in kwargs["long_term_memory"]
            ]
        if (
            self.collection_name != "default"
            and self.collection_name != ""
            and self.collection_name is not None
        ):
            params["document"] = [
                ("system", "Answer any use questions based on the context below:")
            ]
        return params

    async def aquery_stream(self, **kwargs) -> AsyncIterator[str]:
        params = self._prompt_prepare(**kwargs)
        output_log(f"Streaming query params: {params}", "debug")

        async for chunk in self.chain.astream(params):
            if "answer" in chunk:
                chunk_text = chunk["answer"]
                yield chunk_text

    async def aquery(self, **kwargs) -> str:
        params = self._prompt_prepare(**kwargs)
        output_log(f"Query params: {params}", "debug")
        result = await self.chain.ainvoke(params)
        return result
