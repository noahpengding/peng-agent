from utils.mysql_connect import MysqlConnect
from models.model_config import ModelConfig
from utils.log import output_log
from bs4 import BeautifulSoup
from utils.minio_connection import MinioStorage
from handlers.chat_handlers import get_model_instance_by_operator
from handlers.operator_handlers import get_all_operators, update_operator
import re
import requests
import pandas as pd


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


def _get_local_models() -> list[ModelConfig]:
    m = MinioStorage()
    m.file_download("peng-bot/peng-agent/models.xlsx", "models.xlsx")
    models = pd.read_excel("models.xlsx")
    result = []
    for index, row in models.iterrows():
        result.append(ModelConfig(
            operator=row["operator"],
            type=row["type"],
            model_name=row["model_name"],
            isAvailable=row["isAvailable"],
        ))
    return result


def _save_local_models(models: list[ModelConfig]):
    df = pd.DataFrame([model.to_dict() for model in models])
    df.to_excel("models.xlsx", index=False)
    m = MinioStorage()
    m.file_upload("models.xlsx", "peng-bot/peng-agent/models.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


def get_model():
    mysql = MysqlConnect()
    return mysql.read_records("model")


def _check_new_model(operator: str, model_name: str, patterns, model_type: str) -> ModelConfig:
    if not patterns:
        return None
    if any(re.search(str(pattern), model_name) for pattern in patterns.split(";")):
        return ModelConfig(
            operator=operator,
            type=model_type,
            model_name=model_name,
            isAvailable=False,
        )
    return None

# Refersh will check all operators and sync local model changes
def refresh_models():
    update_operator()
    avaliable_models = get_all_available_models()
    local_models = _get_local_models()
    responses = local_models.copy()
    if responses is None:
        responses = []
    responses += _get_ollama_model()
    for operator in get_all_operators():
        try:
            model_ins = get_model_instance_by_operator(operator.operator)
            if model_ins is None:
                continue
            models = model_ins.list_models()
        except Exception as e:
            output_log(f"Error getting models for operator {operator.operator}: {e}", "Warning")
            continue
        for model in models.split("\n"):
            local_match = next((local_model for local_model in local_models if local_model.model_name == model), None)
            # no-dd-sa:python-best-practices/nested-blocks
            if local_match:
                continue
            ## Order Matters: Embedding > Image > Audio > Video > Chatdock
            elif _check_new_model(operator.operator, model, operator.embedding_pattern, "embedding"):
                responses.append(_check_new_model(operator.operator, model, operator.embedding_pattern, "embedding"))
            elif _check_new_model(operator.operator, model, operator.image_pattern, "image"):
                responses.append(_check_new_model(operator.operator, model, operator.image_pattern, "image"))
            elif _check_new_model(operator.operator, model, operator.audio_pattern, "audio"):
                responses.append(_check_new_model(operator.operator, model, operator.audio_pattern, "audio"))
            elif _check_new_model(operator.operator, model, operator.video_pattern, "video"):
                responses.append(_check_new_model(operator.operator, model, operator.video_pattern, "video"))
            elif _check_new_model(operator.operator, model, operator.chat_pattern, "chat"):
                responses.append(_check_new_model(operator.operator, model, operator.chat_pattern, "chat"))
    for response in responses:
        if response.model_name in [model["model_name"] for model in avaliable_models]:
            response.isAvailable = True
    _save_local_models(responses)
    mysql = MysqlConnect()
    try:
        for response in responses:
            mysql.delete_record("model", {"model_name": response.model_name})
            mysql.create_record("model", response.to_dict())
    finally:
        mysql.close()
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

def get_all_available_models():
    mysql = MysqlConnect()
    return mysql.read_record_v2("model", {"isAvailable=": 1})
