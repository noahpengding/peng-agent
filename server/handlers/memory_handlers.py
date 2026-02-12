from utils.log import output_log
from utils.mysql_connect import MysqlConnect


def get_memory(username: str = ""):
    output_log("GET /memory", "DEBUG")
    mysql = MysqlConnect()
    if username == "":
        return []
    chat = mysql.read_records(table="chat", conditions={"user_name": username})
    records = []

    if chat:
        chat_ids = [item["id"] for item in chat]
        all_user_inputs = mysql.read_records(
            table="user_input",
            conditions={"chat_id": chat_ids},
        )
        all_ai_responses = mysql.read_records(
            table="ai_response",
            conditions={"chat_id": chat_ids},
        )

        # Sort by id to ensure deterministic order (assuming id is auto-incrementing)
        all_user_inputs.sort(key=lambda x: x["id"])
        all_ai_responses.sort(key=lambda x: x["id"])

        user_input_map = {}
        for ui in all_user_inputs:
            user_input_map.setdefault(ui["chat_id"], []).append(ui)

        ai_response_map = {}
        for ar in all_ai_responses:
            ai_response_map.setdefault(ar["chat_id"], []).append(ar)
    else:
        user_input_map = {}
        ai_response_map = {}

    for item in chat:
        user_input = user_input_map.get(item["id"], [])
        ai_response = ai_response_map.get(item["id"], [])

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
