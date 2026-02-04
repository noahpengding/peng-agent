from utils.minio_connection import MinioStorage
from models.operator_config import OperatorConfig
from config.config import config
from services.redis_service import (
    create_table_record,
    get_table_record,
    get_table_records,
    update_table_record,
)


def get_operator(operator_name: str) -> OperatorConfig:
    operator = get_table_record("operator", operator_name)
    return OperatorConfig(**operator) if operator else None


def update_operator() -> None:
    minio = MinioStorage()
    minio.file_download(f"{config.s3_base_path}/operator.xlsx", "operator.xlsx")
    import pandas as pd

    operators = pd.read_excel("operator.xlsx")
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
