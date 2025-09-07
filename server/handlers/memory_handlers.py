from utils.log import output_log
from utils.mysql_connect import MysqlConnect


def get_memory(username: str = ""):
    output_log("GET /memory", "DEBUG")
    m = MysqlConnect()
    if username == "":
        return m.read_records("chat", {"type": "assistant"})
    records = m.read_records("chat", {"user_name": username, "type": "assistant"})
    return sorted(records, key=lambda x: x["created_at"], reverse=True)
