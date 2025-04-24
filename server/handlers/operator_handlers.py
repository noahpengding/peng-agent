from utils.mysql_connect import MysqlConnect
from utils.minio_connection import MinioStorage
from models.operator_config import OperatorConfig

def get_operator(operator_name: str) -> OperatorConfig:
    mysql = MysqlConnect()
    operator = mysql.read_records("operator", {"operator": operator_name})
    mysql.close()
    return OperatorConfig(**operator[0]) if operator else None

def update_operator() -> None:
    minio = MinioStorage()
    minio.file_download("peng-bot/peng-agent/operator.xlsx", "operator.xlsx")
    import pandas as pd

    operators = pd.read_excel("operator.xlsx")
    operators = operators.fillna("")
    for index, row in operators.iterrows():
        operator = OperatorConfig(
            operator=row["operator"],
            runtime=row["runtime"],
            endpoint=row["endpoint"],
            api_key=row["api_key"],
            org_id=row["org_id"],
            project_id=row["project_id"],
            embedding_pattern=row["embedding_pattern"],
            image_pattern=row["image_pattern"],
            audio_pattern=row["audio_pattern"],
            video_pattern=row["video_pattern"],
            chat_pattern=row["chat_pattern"],
        )
        mysql = MysqlConnect()
        try:
            mysql.delete_record("operator", {"operator": operator.operator})
            mysql.create_record("operator", operator.to_dict())
        finally:
            mysql.close()
    
def get_all_operators() -> list[OperatorConfig]:
    mysql = MysqlConnect()
    operators = mysql.read_records("operator")
    mysql.close()
    return [OperatorConfig(**operator) for operator in operators] if operators else []
