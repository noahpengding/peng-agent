from services.qdrant_api import Qdrant
import services.prompt_generator as prompt_generator
from config.config import config
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain


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

    def query(self, **kwargs):
        params = {}
        print(kwargs)
        if "input" in kwargs and kwargs["input"] != "":
            params["input"] = kwargs["input"]
        if "short-term-memory" in kwargs and kwargs["short-term-memory"] != []:
            params["short-term-memory"] = [
                ("system", i) for i in kwargs["short-term-memory"]
            ]
        if "long-term-memory" in kwargs and kwargs["long-term-memory"] != []:
            params["long-term-memory"] = [
                ("system", i) for i in kwargs["long-term-memory"]
            ]
        if (
            self.collection_name != "default"
            and self.collection_name != ""
            and self.collection_name is not None
        ):
            params["document"] = [
                ("system", "Answer any use questions based on the context below:")
            ]
        response = self.chain.invoke(params)
        answer = (
            response["answer"].split("</think>")[1]
            if "</think>" in response["answer"]
            else response["answer"]
        )
        return answer
