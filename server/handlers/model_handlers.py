from utils.mysql_connect import MysqlConnect
from models.model_config import ModelConfig
from utils.log import output_log
from utils.minio_connection import MinioStorage
from handlers.model_utils import get_model_instance_by_operator
from handlers.operator_handlers import get_all_operators, update_operator
import re
import pandas as pd


def _get_local_models() -> list[ModelConfig]:
    m = MinioStorage()
    m.file_download("peng-bot/peng-agent/models.xlsx", "models.xlsx")
    models = pd.read_excel("models.xlsx")
    models.dropna(subset=["model_name"], inplace=True)
    result = []
    for index, row in models.iterrows():
        result.append(ModelConfig(**row.to_dict()))
    return result


def _save_local_models(models: list[ModelConfig]):
    df = pd.DataFrame([model.to_dict() for model in models])
    df.to_excel("models.xlsx", index=False)
    m = MinioStorage()
    m.file_upload(
        "models.xlsx",
        "peng-bot/peng-agent/models.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def get_model():
    mysql = MysqlConnect()
    return mysql.read_records("model")


def _check_new_model(
    operator: str, model_name: str, patterns, model_type: str
) -> ModelConfig:
    if not patterns:
        return None
    if any(re.search(str(pattern), model_name) for pattern in patterns.split(";")):
        return ModelConfig(
            operator=operator,
            type=model_type,
            model_name=model_name,
            isAvailable=False,
            isMultimodal=False,
        )
    return None


# Refersh will check all operators and sync local model changes
def refresh_models():
    update_operator()
    avaliable_models = get_all_available_models()
    multimodal_models = get_all_multimodal_models()
    local_models = _get_local_models()
    responses = local_models.copy()
    if responses is None:
        responses = []
    for operator in get_all_operators():
        try:
            model_ins = get_model_instance_by_operator(operator.operator)
            if model_ins is None:
                continue
            models = model_ins.list_models()
        except Exception as e:
            output_log(
                f"Error getting models for operator {operator.operator}: {e}", "Warning"
            )
            continue
        for model in models.split("\n"):
            local_match = next(
                (
                    local_model
                    for local_model in local_models
                    if local_model.model_name == model
                ),
                None,
            )
            # no-dd-sa:python-best-practices/nested-blocks
            if local_match:
                continue
            ## Order Matters: Embedding > Image > Audio > Video > Chatdock
            elif _check_new_model(
                operator.operator, model, operator.embedding_pattern, "embedding"
            ):
                responses.append(
                    _check_new_model(
                        operator.operator,
                        model,
                        operator.embedding_pattern,
                        "embedding",
                    )
                )
            elif _check_new_model(
                operator.operator, model, operator.image_pattern, "image"
            ):
                responses.append(
                    _check_new_model(
                        operator.operator, model, operator.image_pattern, "image"
                    )
                )
            elif _check_new_model(
                operator.operator, model, operator.audio_pattern, "audio"
            ):
                responses.append(
                    _check_new_model(
                        operator.operator, model, operator.audio_pattern, "audio"
                    )
                )
            elif _check_new_model(
                operator.operator, model, operator.video_pattern, "video"
            ):
                responses.append(
                    _check_new_model(
                        operator.operator, model, operator.video_pattern, "video"
                    )
                )
            elif _check_new_model(
                operator.operator, model, operator.chat_pattern, "chat"
            ):
                responses.append(
                    _check_new_model(
                        operator.operator, model, operator.chat_pattern, "chat"
                    )
                )
    for response in responses:
        if response.model_name in [model["model_name"] for model in avaliable_models]:
            response.isAvailable = True
        if response.model_name in [model["model_name"] for model in multimodal_models]:
            response.isMultimodal = True
    _save_local_models(responses)
    mysql = MysqlConnect()
    try:
        for response in responses:
            mysql.delete_record("model", {"model_name": response.model_name})
            mysql.create_record("model", response.to_dict())
    finally:
        mysql.close()
    return get_model()


def _flip_record(model_name: str, field: str):
    mysql = MysqlConnect()
    model = mysql.read_records("model", {"model_name": model_name})
    if model:
        pre_value = model[0][field]
        mysql.update_record("model", {field: not pre_value}, {"model_name": model_name})
        return f"Model {model_name}'s {field} status changed to {not pre_value}"
    mysql.close()
    return f"Model {model_name} not found"


def flip_avaliable(model_name: int):
    return _flip_record(model_name, "isAvailable")


def avaliable_models(type: str):
    mysql = MysqlConnect()
    if type == "embedding":
        return mysql.read_record_v2("model", {"type=": "embedding", "isAvailable=": 1})
    return mysql.read_record_v2("model", {"type<>": "embedding", "isAvailable=": 1})


def check_multimodal(model_name: str) -> bool:
    mysql = MysqlConnect()
    model = mysql.read_records("model", {"model_name": model_name})
    if model:
        return model[0]["isMultimodal"]
    mysql.close()
    return False


def flip_multimodal(model_name: str):
    return _flip_record(model_name, "isMultimodal")


def get_all_available_models():
    mysql = MysqlConnect()
    return mysql.read_record_v2("model", {"isAvailable=": 1})


def get_all_multimodal_models():
    mysql = MysqlConnect()
    return mysql.read_record_v2("model", {"isMultimodal=": 1})
