from services.openai_api import OpenAIHandler
from utils.mysql_connect import MysqlConnect
from models.model_config import ModelConfig
from utils.log import output_log
import requests
from bs4 import BeautifulSoup
import re


def _get_opeai_model():
    responses = []
    o = OpenAIHandler()
    models = o.list_models()
    for model in models.split("\n"):
        if re.search(r"^davinci", model) or re.search(r"^dall", model):
            responses.append(
                ModelConfig(
                    operator="openai", type="image", model_name=model, available=False
                )
            )
        elif re.search(r"^text-embedding", model):
            responses.append(
                ModelConfig(
                    operator="openai",
                    type="embedding",
                    model_name=model,
                    available=False,
                )
            )
        elif re.search(r"^gpt", model) or re.search(r"^o", model):
            responses.append(
                ModelConfig(
                    operator="openai", type="chat", model_name=model, available=False
                )
            )
    mysql = MysqlConnect()
    mysql.delete_record("model", {"operator": "openai"})
    try:
        for response in responses:
            mysql.create_record("model", response.to_dict())
    finally:
        mysql.close()


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
                    available=False,
                )
            )
            param_index += 1
        model_index += 1
    return results


def _get_ollama_model():
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
            finally:
                mysql.close()
    except requests.RequestException as e:
        output_log(f"Error processing Ollama models: {e}", "ERROR")
    except Exception as e:
        output_log(f"Error processing Ollama models: {e}", "ERROR")


def get_model():
    mysql = MysqlConnect()
    return mysql.read_records("model")


def refresh_models():
    _get_opeai_model()
    _get_ollama_model()
    return get_model()


def flip_avaliable(model_name: int):
    mysql = MysqlConnect()
    model = mysql.read_records("model", {"model_name": model_name})
    if model:
        pre_available = model[0]["isAvailable"]
        mysql.update_record(
            "model", {"isAvailable": not pre_available}, {"model_name": model_name}
        )
        return f"Model {model_name} is now {'isAvailable' if not pre_available else 'unavailable'}"
    mysql.close()
    return f"Model {model_name} not found"


def avaliable_models(type: str):
    mysql = MysqlConnect()
    if type == "embedding":
        return mysql.read_record_v2("model", {"type=": "embedding", "isAvailable=": 1})
    return mysql.read_record_v2("model", {"type<>": "embedding", "isAvailable=": 1})
