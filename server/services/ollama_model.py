from langchain_ollama import ChatOllama, OllamaEmbeddings
from ollama import Client
from config.config import config

class Ollama:
    def __init__(self, model=config.default_base_model, model_type="chat"):
        self.model = model
        self.type = model_type
        self.base_url = config.ollama_url
        self.client = Client(
            host = self.base_url,
        )

    def init(self):
        self.check_model_exists()
        if self.type == "embeddings":
            return OllamaEmbeddings(
                base_url=self.base_url,
                model=self.model
            )
        elif self.type == "chat":
            return ChatOllama(
                base_url=self.base_url,
                model=self.model
            )
        
    def check_model_exists(self):
        try:
            self.client.show(self.model)
        except Exception as e:
            self.model_pull()

    def model_pull(self):
        self.client.pull(self.model)
