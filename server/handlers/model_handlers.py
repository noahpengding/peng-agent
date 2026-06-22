from models.model_config import ModelConfig
from utils.log import output_log
from utils.minio_connection import MinioStorage
from handlers.operator_handlers import get_all_operators, update_operator
from config.config import config
from io import BytesIO
from services.redis_service import (
    create_table_record,
    get_table_record,
    get_table_records,
    update_table_record,
)
import pandas as pd


def _rank_sort_key(value) -> tuple[int, int | str]:
    if value in (None, ""):
        return (2, "")
    try:
        return (0, int(value))
    except (TypeError, ValueError):
        return (1, str(value).casefold())


def _operator_rank_by_name() -> dict[str, tuple[int, int | str]]:
    operators = get_table_records("operator", db_backed=False)
    return {
        operator["operator"]: _rank_sort_key(operator.get("id"))
        for operator in operators
        if isinstance(operator, dict) and operator.get("operator")
    }


def _sort_models(models: list[dict]) -> list[dict]:
    operator_rank = _operator_rank_by_name()
    return sorted(
        models,
        key=lambda model: (
            operator_rank.get(model.get("operator"), (2, "")),
            str(model.get("model_name", "")).casefold(),
        ),
    )


def _get_local_models() -> list[ModelConfig]:
    m = MinioStorage()
    model_data = m.file_download_to_memory(f"{config.s3_base_path}/models.xlsx")
    if model_data is None:
        return []
    models = pd.read_excel(BytesIO(model_data))
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
    models = get_table_records("model", db_backed=False)
    return _sort_models(models)


# Refresh will check all operators and discover new models
def refresh_models():
    update_operator()
    current_models = get_table_records("model", force_refresh=False, db_backed=False)
    current_models = {model["model_name"] for model in current_models if isinstance(model, dict)}
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
            if not model.strip():
                continue
            model_name = f"{operator.operator}/{model}"
            existing = model_name in current_models
            if not existing:
                new_model = ModelConfig(
                    operator=operator.operator,
                    model_name=model_name,
                    isAvailable=False,
                    reasoning_effect="not a reasoning model",
                )
                create_table_record(
                    "model",
                    new_model.to_dict(),
                    redis_id="model_name",
                    db_backed=False,
                )
    return get_model()


def save_models_to_s3():
    models_dict = get_table_records("model", db_backed=False)
    models = [ModelConfig(**model) for model in models_dict if isinstance(model, dict)]
    _save_local_models(models)


def load_models_from_s3():
    local_models = _get_local_models()
    for model in local_models:
        existing = get_table_record("model", model.model_name, db_backed=False)
        if not existing:
            create_table_record(
                "model",
                model.to_dict(),
                redis_id="model_name",
                db_backed=False,
            )


def _flip_record(model_name: str, field: str):
    model = get_table_record("model", model_name, db_backed=False)
    if model:
        pre_value = model[field]
        update_table_record(
            "model",
            {field: not pre_value},
            {"model_name": model_name},
            redis_id="model_name",
            db_backed=False,
        )
        return f"Model {model_name}'s {field} status changed to {not pre_value}"
    return f"Model {model_name} not found"


def flip_avaliable(model_name: str):
    return _flip_record(model_name, "isAvailable")


def avaliable_models():
    models = get_table_records("model", db_backed=False)
    models = [model for model in models if model.get("isAvailable") in (True, 1)]
    return _sort_models(models)


def check_multimodal(model_name: str) -> bool:
    model = get_table_record("model", model_name, db_backed=False)
    if model:
        return model["input_image"] or model["input_audio"] or model["input_video"]
    return False


def flip_multimodal(model_name: str, column: str):
    if column not in ["input_text", "output_text", "input_image", "output_image", "input_audio", "output_audio", "input_video", "output_video"]:
        return f"Invalid column name: {column}"
    return _flip_record(model_name, column)


def get_all_available_models():
    models = get_table_records("model", db_backed=False)
    models = [model for model in models if model.get("isAvailable") in (True, 1)]
    return _sort_models(models)


def update_reasoning_effect(model_name: str, reasoning_effect: str):
    model = get_table_record("model", model_name, db_backed=False)
    if model:
        update_table_record(
            "model",
            {"reasoning_effect": reasoning_effect},
            {"model_name": model_name},
            redis_id="model_name",
            db_backed=False,
        )
    return f"Model {model_name} not found"


def get_reasoning_effect(model_name: str):
    model = get_table_record("model", model_name, db_backed=False)
    if model:
        return model["reasoning_effect"]
    return "not a reasoning model"
