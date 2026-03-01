from utils.minio_connection import MinioStorage
from models.operator_config import OperatorConfig
from services.redis_service import (
    create_table_record,
    get_table_record,
    get_table_records,
    update_table_record,
)
from config.config import config
from io import BytesIO
import pandas as pd


def get_operator(operator_name: str) -> OperatorConfig:
    operator = get_table_record("operator", operator_name)
    return OperatorConfig(**operator) if operator else None


def update_operator() -> None:
    minio = MinioStorage()
    operator_data = minio.file_download_to_memory(f"{config.s3_base_path}/operator.xlsx")
    if operator_data is None:
        return
    operators = pd.read_excel(BytesIO(operator_data))
    operators = operators.fillna("")
    operators = [OperatorConfig(**row.to_dict()) for _, row in operators.iterrows()]
    for operator in operators:
        existing = get_table_record("operator", operator.operator)
        if existing:
            update_table_record(
                "operator",
                operator.to_dict(),
                {"operator": operator.operator},
                redis_id="operator",
            )
        else:
            create_table_record("operator", operator.to_dict(), redis_id="operator")


def get_all_operators() -> list[OperatorConfig]:
    operators = get_table_records("operator")
    return [OperatorConfig(**operator) for operator in operators] if operators else []
