from sqlalchemy import text
from utils.log import output_log
from utils.mysql_connect import MysqlConnect
from datetime import datetime, timedelta
from config.config import config
import json


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
        
async def update_lt_memory(username: str):
    output_log("POST /memory/update_lt_memory", "DEBUG")
    mysql = MysqlConnect()
    one_day_chat = mysql.read_records("chat", {"user_name": username, "created_at>=": datetime.now() - timedelta(days=1)})
    if not one_day_chat:
        return []
    one_day_memory = [f"Human: {chat['human_input']}\n\n" for chat in one_day_chat]
    output_log(f"One day chat for {username}: {one_day_memory}", "debug")
    prompt = f'''Extract important information from the following conversations for long-term memory. You will receive multiple conversation input. You should output the important information in a list format seperated by ";".
        Sample1: 
        Input: Human: Using python with uv to develop a web server, what should I do?
        Output: User prefer python; User want to use uv for python package management;
        Sample2: 
        Input: answer this question in actuarial science?
        Output: 
        (No record for sample 2 since it's not important information in the conversation)
        ONLY RECORDED OBVIOUS and IMPORTANT INFORMATION. DO NOT RECORD EVERY DETAIL. IF THE CONVERSATION IS NOT IMPORTANT, JUST SKIP IT.
        Today's conversation:
        {one_day_memory}'''
    from handlers.chat_handlers import chat_completions_handler
    from models.chat_config import ChatConfig
    chat_config = ChatConfig(
        operator=config.default_operator,
        base_model=config.default_base_model,
    )
    lt_memory = await chat_completions_handler(
        username, prompt, None, None, chat_config
    )
    lt_memory = lt_memory[-1].content[0]["text"].strip()
    lt_memory = lt_memory.replace("\n", "").replace("\r", "")
    lt_memory = lt_memory.split(";")
    if lt_memory != [] and lt_memory != [""]:
        lt_memory = json.dumps(lt_memory)
        with mysql.get_session():
            mysql.update_record("user", {"long_term_memory": lt_memory}, {"user_name": username})
