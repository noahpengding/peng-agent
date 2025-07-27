from services.rag.qdrant_api import Qdrant
import services.prompt_generator as prompt_generator
from handlers.model_utils import get_model_instance_by_operator
from config.config import config
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain
from langchain_core.messages import AIMessage
from typing import AsyncIterator
from utils.log import output_log


class RagUsage:
    def __init__(
        self,
        user_name="default",
        collection_name="default",
    ):
        self.user_name = user_name
        self.collection_name = collection_name
        self.llm = get_model_instance_by_operator(
            config.default_operator,
            config.default_base_model,
        )

    def setup(self, prompt):
        qdrant = Qdrant(
            host=config.qdrant_host,
            port=config.qdrant_port,
            collection_name=self.collection_name,
        )
        retriever = qdrant.as_retriever(
            search_type="similarity_score_threshold",
            search_kwargs={"score_threshold": 0.3},
        )
        self.prompt = prompt_generator.prompt_template(
            config.default_base_model,
            has_document=self.collection_name != "default",
            has_websearch=False,
        )
        combine_docs_chain = create_stuff_documents_chain(self.llm, prompt)
        self.chain = create_retrieval_chain(retriever, combine_docs_chain)
        output_log(
            f"RAG Usage setup complete for user: {self.user_name}, collection: {self.collection_name}",
            "debug",
        )

    async def astream(self, prompt, param) -> AsyncIterator[AIMessage]:
        self.setup(prompt)
        async for chunk in self.chain.astream(param):
            if "answer" in chunk:
                yield AIMessage(content=chunk["answer"])

    async def ainvoke(self, prompt, param) -> AIMessage:
        self.setup(prompt)
        result = await self.chain.ainvoke(param)
        return AIMessage(content=result["answer"])

    def invoke(self, prompt, param) -> AIMessage:
        self.setup(prompt)
        result = self.chain.invoke(param)
        return AIMessage(content=result["answer"])
