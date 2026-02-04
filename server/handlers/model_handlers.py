from models.model_config import ModelConfig
from utils.log import output_log
from utils.minio_connection import MinioStorage
from handlers.operator_handlers import get_all_operators, update_operator
from config.config import config
from services.redis_service import (
    create_table_record,
    get_table_record,
    get_table_records,
    update_table_record,
)
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
    operator_record = get_table_records("operator")
    operator = [op["operator"] for op in operator_record if isinstance(op, dict)]
    models = get_table_records("model")
    model_order = {val: i for i, val in enumerate(operator)}
    models.sort(key=lambda x: model_order.get(x["operator"], float("inf")))
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
            from handlers.model_utils import get_model_instance

            model_ins = get_model_instance(model_name="", operator_name=operator.operator)
            if model_ins is None:
                continue
            models = model_ins.list_models()
        except Exception as e:
            output_log(
                f"Error getting models for operator {operator.operator}: {e}", "Warning"
            )
            continue
        for model in models.split("\n"):
            model_name = f"{operator.operator}/{model}"
            server_match = next(
                (
                    server_model
                    for server_model in server_models
                    if server_model.model_name == model_name
                    and server_model.operator == operator.operator
                ),
                None,
            )
            # no-dd-sa:python-best-practices/nested-blocks
            if server_match is not None:
                continue
            else:
                new_model = ModelConfig(
                    operator=operator.operator,
                    model_name=model_name,
                    isAvailable=False,
                    reasoning_effect="not a reasoning model",
                )
                if new_model:
                    responses.append(new_model)
    for local_model in local_models:
        if not any(
            local_model.model_name == response.model_name and local_model.operator == response.operator
            for response in responses
        ):
            responses.append(local_model)
    _save_local_models(responses)
    for response in responses:
        existing = get_table_record("model", response.model_name)
        if existing:
            update_table_record(
                "model",
                response.to_dict(),
                {"model_name": response.model_name},
                redis_id="model_name",
            )
        else:
            create_table_record(
                "model",
                response.to_dict(),
                redis_id="model_name",
            )
    return get_model()


def _flip_record(model_name: str, field: str):
    model = get_table_record("model", model_name)
    if model:
        pre_value = model[field]
        update_table_record(
            "model",
            {field: not pre_value},
            {"model_name": model_name},
            redis_id="model_name",
        )
        return f"Model {model_name}'s {field} status changed to {not pre_value}"
    return f"Model {model_name} not found"


def flip_avaliable(model_name: str):
    return _flip_record(model_name, "isAvailable")


def avaliable_models():
    models = get_table_records("model")
    models = [model for model in models if model.get("isAvailable") in (True, 1)]
    operator = get_table_records("operator")
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
    return models


def check_multimodal(model_name: str) -> bool:
    model = get_table_record("model", model_name)
    if model:
        return model["input_image"] or model["input_audio"] or model["input_video"]
    return False


def flip_multimodal(model_name: str, column: str):
    if column not in ["input_text", "output_text", "input_image", "output_image", "input_audio", "output_audio", "input_video", "output_video"]:
        return f"Invalid column name: {column}"
    return _flip_record(model_name, column)


def get_all_available_models():
    models = get_table_records("model")
    return [model for model in models if model.get("isAvailable") in (True, 1)]


def update_reasoning_effect(model_name: str, reasoning_effect: str):
    model = get_table_record("model", model_name)
    if model:
        update_table_record(
            "model",
            {"reasoning_effect": reasoning_effect},
            {"model_name": model_name},
            redis_id="model_name",
        )
        return f"Model {model_name}'s reasoning effect updated to {reasoning_effect}"
    return f"Model {model_name} not found"


def get_reasoning_effect(model_name: str):
    model = get_table_record("model", model_name)
    if model:
        return model["reasoning_effect"]
    return "not a reasoning model"
