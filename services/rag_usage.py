from services.ollama_model import Ollama
from services.qdrant_api import Qdrant
import services.prompt_generator as prompt_generator
from config.config import config
from utils.mysql_connect import MysqlConnect
from datetime import datetime, timedelta
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain

class RagUsage:
    def __init__(self, user_name="default", base_model = config.default_base_model, collection_name = "default", embedding_model=config.default_embedding_model):
        self.user_name = user_name
        self.base_model = base_model
        self.collection_name = collection_name
        self.embedding_model = embedding_model
        self.qdrant = Qdrant(host=config.qdrant_host, port=config.qdrant_port, collection_name=collection_name, embedding=embedding_model)
        self.llm = Ollama(model = base_model, model_type = "chat").init()
        self.setup()

    def setup(self):
        retriever  = self.qdrant.as_retriever(
            search_kwargs={"k": 5}
        )
        prompt = prompt_generator.rag_prompt_template()
        combine_docs_chain = create_stuff_documents_chain(self.llm, prompt)
        self.chain = create_retrieval_chain(retriever, combine_docs_chain)

    def query(self, question):
        chat_history = []
        memories = self.get_memory(self.collection_name)
        for memory in memories:
            chat_history.extend(prompt_generator.memory_message_chain(memory["human_input"], memory["ai_response"]))
        response = self.chain.invoke({"input": question, "chat_history": chat_history})
        answer = response["answer"].split("</think>")[1] if "</think>" in response["answer"] else response["answer"]
        self.store_memory(question, answer)
        return answer
    
    def store_memory(self, question, answer):
        mysql = MysqlConnect()
        if len(answer) > 2048:
            answer = answer[:2048]
        if len(question) > 512:
            question = question[:512]
        mysql.create_record(
            "chat",
            {
                "user_name": self.user_name,
                "base_model": self.base_model,
                "embedding_model": self.embedding_model,
                "human_input": question,
                "ai_response": answer,
                "knowledge_base": self.collection_name,
                "created_at": datetime.now(),
                "expire_at": datetime.now() + timedelta(days=7)
            }
        )
        mysql.close()

    def get_memory(self, collection_name):
        dt = datetime.now()
        mysql = MysqlConnect()
        records = []
        records = mysql.read_records(
            "chat",
            {   
                "user_name": self.user_name,
                "knowledge_base": collection_name,
            }
        )
        mysql.close()
        records = filter(lambda x: x["expire_at"] > dt, records)
        records = sorted(records, key=lambda x: x["created_at"], reverse=True)
        records = records[:5]
        return records


