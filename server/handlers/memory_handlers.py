from sqlalchemy import text
from utils.log import output_log
from utils.mysql_connect import MysqlConnect


def get_memory(username: str = ""):
    output_log("GET /memory", "DEBUG")
    if username == "":
        return []

    mysql = MysqlConnect()
    with mysql.get_session() as session:
        # Optimized query to fetch all necessary data in one go
        # This avoids N+1 problem and fetching excessively large content
        query = text("""
            SELECT
                c.id,
                c.user_name,
                c.type,
                c.base_model,
                c.human_input,
                c.created_at,
                COALESCE((SELECT input_location FROM user_input WHERE chat_id = c.id ORDER BY id ASC LIMIT 1), "") as other_input,
                (SELECT ai_response FROM ai_response WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as ai_response
            FROM chat c
            WHERE c.user_name = :username
            ORDER BY c.created_at DESC
        """)

        try:
            result = session.execute(query, {"username": username})

            records = []
            for row in result:
                # If ai_response is missing, skip the record as it's incomplete
                if not row.ai_response:
                    continue

                # other_input is handled by COALESCE, so it's always a string (empty if None)
                records.append(
                    {
                        "id": row.id,
                        "username": row.user_name,
                        "type": row.type,
                        "base_model": row.base_model,
                        "human_input": row.human_input,
                        "other_input": row.other_input,
                        "ai_response": row.ai_response,
                        "created_at": row.created_at,
                    }
                )
            return records
        except Exception as e:
            output_log(f"Error executing memory query: {e}", "error")
            return []
