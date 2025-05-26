from langchain_ollama import ChatOllama, OllamaEmbeddings
from ollama import Client
from config.config import config
from utils.log import output_log


class Ollama:
    def __init__(self, model=config.default_base_model, model_type="chat"):
        self.model = model
        self.type = model_type
        self.base_url = config.ollama_url
        self.client = Client(
            host=self.base_url,
        )

    def init(self):
        self.check_model_exists()
        if self.type == "embeddings":
            return OllamaEmbeddings(base_url=self.base_url, model=self.model)
        elif self.type == "chat":
            return ChatOllama(base_url=self.base_url, model=self.model)

    def check_model_exists(self):
        try:
            self.client.show(self.model)
        except Exception:
            output_log(f"Model {self.model} not found, pulling model", "INFO")
            self.model_pull()

    def model_pull(self):
        self.client.pull(self.model)


def _parse_ollama_models(soup: BeautifulSoup) -> list:
    results = []
    model_index = 1
    while True:
        model_name_selector = f"#searchresults > ul > li:nth-child({model_index}) > a > div.flex.flex-col.mb-1 > h2 > span"
        model_name_element = soup.select(model_name_selector)
        if not model_name_element:
            break
        model_type = "chat"
        param_index = 1
        while True:
            param_selector = f"#searchresults > ul > li:nth-child({model_index}) > a > div:nth-child(2) > div > span:nth-child({param_index})"
            param_element = soup.select(param_selector)
            if not param_element:
                break
            param_text = param_element[0].text
            model_type = (
                param_text if param_text in ("embedding", "tools", "vision") else "chat"
            )
            param_text = (
                param_text
                if param_text not in ("embedding", "tools", "vision")
                else "latest"
            )
            results.append(
                ModelConfig(
                    operator="rag",
                    type=model_type,
                    model_name=f"{model_name_element[0].text}:{param_text}",
                    isAvailable=False,
                )
            )
            param_index += 1
        model_index += 1
    return results


def _get_ollama_model() -> list[ModelConfig]:
    OLLAMA_SEARCH_URL = "https://ollama.com/search"
    try:
        response = requests.get(OLLAMA_SEARCH_URL, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        model_configs = _parse_ollama_models(soup)
        if model_configs:
            mysql = MysqlConnect()
            try:
                mysql.delete_record("model", {"operator": "rag"})
                for model_config in model_configs:
                    mysql.create_record("model", model_config.to_dict())
                print(model_configs)
                return model_configs
            finally:
                mysql.close()
    except requests.RequestException as e:
        output_log(f"Error processing Ollama models: {e}", "ERROR")
    except Exception as e:
        output_log(f"Error processing Ollama models: {e}", "ERROR")
