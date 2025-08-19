from handlers.tool_handlers import get_tool_by_name


def get_sql_engine(tool_name: str):
    tool = get_tool_by_name(tool_name)
    if not tool:
        raise ValueError(f"Tool {tool_name} not found in database.")

    from sqlalchemy import create_engine

    if not tool["url"]:
        raise ValueError(f"Tool {tool_name} does not have a valid URL.")
    return create_engine(tool["url"])


def create_sql_tool(tool_name: str):
    from langchain_community.utilities.sql_database import SQLDatabase
    from langchain_community.agent_toolkits.sql.toolkit import SQLDatabaseToolkit
    from handlers.operator_handlers import get_operator
    from langchain.chat_models import init_chat_model

    import os

    operator = get_operator("openai")
    os.environ["OPENAI_API_KEY"] = operator.api_key
    db = SQLDatabase(get_sql_engine(tool_name))
    llm = init_chat_model("gpt-4o-mini", model_provider="openai")

    toolkit = SQLDatabaseToolkit(db=db, llm=llm)
    return toolkit.get_tools()
