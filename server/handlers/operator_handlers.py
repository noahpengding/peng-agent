from utils.mysql_connect import MysqlConnect
from utils.minio_connection import MinioStorage
from models.operator_config import OperatorConfig
from config.config import config


def get_operator(operator_name: str) -> OperatorConfig:
    mysql = MysqlConnect()
    operator = mysql.read_records("operator", {"operator": operator_name})
    mysql.close()
    return OperatorConfig(**operator[0]) if operator else None


def update_operator() -> None:
    minio = MinioStorage()
    minio.file_download(f"{config.s3_base_path}/operator.xlsx", "operator.xlsx")
    import pandas as pd

    operators = pd.read_excel("operator.xlsx")
    operators = operators.fillna("")
    operators = [OperatorConfig(**row.to_dict()) for _, row in operators.iterrows()]
    mysql = MysqlConnect()

    for operator in operators:
        existing = mysql.read_records(
            "operator", {"operator": operator.operator}
        )
        if existing:
            mysql.update_record(
                "operator", operator.to_dict(), {"operator": operator.operator}
            )
        else:
            mysql.create_record("operator", operator.to_dict())
    mysql.close()


def get_all_operators() -> list[OperatorConfig]:
    mysql = MysqlConnect()
    operators = mysql.read_records("operator")
    mysql.close()
    return [OperatorConfig(**operator) for operator in operators] if operators else []
