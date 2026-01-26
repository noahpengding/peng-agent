from utils.log import output_log
from utils.mysql_connect import MysqlConnect


def get_memory(username: str = ""):
    output_log("GET /memory", "DEBUG")
    mysql = MysqlConnect()
    if username == "":
        return []
    chat = mysql.read_records(table="chat", conditions={"user_name": username})
    records = []
    for item in chat:
        user_input = mysql.read_records(
            table="user_input",
            conditions={"chat_id=": item["id"]},
        )
        ai_response = mysql.read_records(
            table="ai_response",
            conditions={"chat_id=": item["id"]},
        )
        if len(user_input) == 0 or len(ai_response) == 0:
            continue
        records.append(
            {
                "id": item["id"],
                "username": item["user_name"],
                "type": item["type"],
                "base_model": item["base_model"],
                "human_input": user_input[0]["input_content"],
                "other_input": user_input[0]["input_location"],
                "ai_response": ai_response[-1]["ai_response"],
                "created_at": item["created_at"],
            }
        )
    return sorted(records, key=lambda x: x["created_at"], reverse=True)
