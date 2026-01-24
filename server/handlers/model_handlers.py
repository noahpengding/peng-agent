from utils.mysql_connect import MysqlConnect
from models.model_config import ModelConfig
from utils.log import output_log
from utils.minio_connection import MinioStorage
from handlers.operator_handlers import get_all_operators, update_operator
from config.config import config
import pandas as pd


def _get_local_models() -> list[ModelConfig]:
    m = MinioStorage()
    m.file_download(f"{config.s3_base_path}/models.xlsx", "models.xlsx")
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
        f"{config.s3_base_path}/models.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def get_model():
    mysql = MysqlConnect()
    operator_record = mysql.read_records("operator")
    operator = [op["operator"] for op in operator_record if isinstance(op, dict)]
    models = mysql.read_records("model")
    model_order = {val: i for i, val in enumerate(operator)}
    models.sort(key=lambda x: model_order.get(x["operator"], float("inf")))
    mysql.close()
    return models


# Refersh will check all operators and sync local model changes
def refresh_models():
    update_operator()
    server_model_dicts = get_model()
    server_models = [
        ModelConfig(**model) for model in server_model_dicts if isinstance(model, dict)
    ]
    local_models = _get_local_models()
    responses = server_models.copy()
    for operator in get_all_operators():
        try:
            from handlers.model_utils import get_model_instance_by_operator

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
            server_match = next(
                (
                    server_model
                    for server_model in server_models
                    if server_model.model_name == model
                ),
                None,
            )
            # no-dd-sa:python-best-practices/nested-blocks
            if server_match is not None:
                continue
            else:
                new_model = ModelConfig(
                    operator=operator.operator,
                    model_name=model,
                    isAvailable=False,
                    reasoning_effect="not a reasoning model",
                )
                if new_model:
                    responses.append(new_model)
    for local_model in local_models:
        if not any(
            local_model.model_name == response.model_name for response in responses
        ):
            responses.append(local_model)
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


def avaliable_models():
    mysql = MysqlConnect()
    models = mysql.read_records("model", {"isAvailable=": 1})
    operator = mysql.read_records("operator")
    operator_dict = {
        op["operator"]: i for i, op in enumerate(operator) if isinstance(op, dict)
    }
    models.sort(
        key=lambda x: (
            operator_dict.get(x["operator"], float("inf")),
            x["type"],
            x["model_name"],
        )
    )
    mysql.close()
    return models


def check_multimodal(model_name: str) -> bool:
    mysql = MysqlConnect()
    model = mysql.read_records("model", {"model_name": model_name})
    if model:
        return model[0]["input_image"] or model[0]["input_audio"] or model[0]["input_video"]
    mysql.close()
    return False


def flip_multimodal(model_name: str, column: str):
    if column not in ["input_image", "output_image", "input_audio", "output_audio", "input_video", "output_video"]:
        return f"Invalid column name: {column}"
    return _flip_record(model_name, column)


def get_all_available_models():
    mysql = MysqlConnect()
    return mysql.read_records("model", {"isAvailable=": 1})


def update_reasoning_effect(model_name: str, reasoning_effect: str):
    mysql = MysqlConnect()
    model = mysql.read_records("model", {"model_name": model_name})
    if model:
        mysql.update_record(
            "model", {"reasoning_effect": reasoning_effect}, {"model_name": model_name}
        )
        return f"Model {model_name}'s reasoning effect updated to {reasoning_effect}"
    mysql.close()
    return f"Model {model_name} not found"


def get_reasoning_effect(model_name: str):
    mysql = MysqlConnect()
    model = mysql.read_records("model", {"model_name": model_name})
    if model:
        return model[0]["reasoning_effect"]
    mysql.close()
    return "not a reasoning model"
