import json
from datetime import datetime, timedelta
from math import ceil

from sqlalchemy import text

from config.config import config
from utils.log import output_log
from utils.mysql_connect import MysqlConnect


MEMORY_PAGE_SIZE = 20

MEMORY_QUERY_BASE = """
    FROM (
        SELECT
            c.id,
            c.user_name,
            c.type,
            c.base_model,
            c.human_input,
            c.created_at,
            COALESCE((SELECT input_location FROM user_input WHERE chat_id = c.id ORDER BY id ASC LIMIT 1), '') as other_input,
            (SELECT ai_response FROM ai_response WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as ai_response
        FROM chat c
        WHERE c.user_name = :username
    ) memory_rows
    WHERE memory_rows.ai_response IS NOT NULL
      AND memory_rows.ai_response != ''
      AND (
          :search = ''
          OR LOWER(COALESCE(memory_rows.human_input, '')) LIKE :search_pattern
          OR LOWER(COALESCE(memory_rows.ai_response, '')) LIKE :search_pattern
          OR LOWER(COALESCE(memory_rows.base_model, '')) LIKE :search_pattern
      )
"""


def _empty_memory_page(page: int = 1, search: str = ""):
    return {
        "memories": [],
        "page": max(page, 1),
        "page_size": MEMORY_PAGE_SIZE,
        "total_count": 0,
        "total_pages": 1,
        "has_next": False,
        "has_previous": False,
        "search": search,
    }


def get_memory(username: str = "", page: int = 1, search: str = ""):
    output_log("POST /memory", "DEBUG")
    try:
        page = max(int(page), 1)
    except (TypeError, ValueError):
        page = 1
    search = (search or "").strip().lower()
    if username == "":
        return _empty_memory_page(page, search)

    mysql = MysqlConnect()
    with mysql.get_session() as session:
        count_query = text(f"""
            SELECT COUNT(*)
            {MEMORY_QUERY_BASE}
        """)
        records_query = text(f"""
            SELECT
                memory_rows.id,
                memory_rows.user_name,
                memory_rows.type,
                memory_rows.base_model,
                memory_rows.human_input,
                memory_rows.other_input,
                memory_rows.ai_response,
                memory_rows.created_at
            {MEMORY_QUERY_BASE}
            ORDER BY memory_rows.created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        try:
            base_params = {
                "username": username,
                "search": search,
                "search_pattern": f"%{search}%",
            }
            total_count = session.execute(count_query, base_params).scalar() or 0
            total_pages = max(ceil(total_count / MEMORY_PAGE_SIZE), 1)
            page = min(page, total_pages)
            result = session.execute(
                records_query,
                {
                    **base_params,
                    "limit": MEMORY_PAGE_SIZE,
                    "offset": (page - 1) * MEMORY_PAGE_SIZE,
                },
            )

            records = []
            for row in result:
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
            return {
                "memories": records,
                "page": page,
                "page_size": MEMORY_PAGE_SIZE,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_previous": page > 1,
                "search": search,
            }
        except Exception as e:
            output_log(f"Error executing memory query: {e}", "error")
            return _empty_memory_page(page, search)


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
    mysql.close()
    return None
