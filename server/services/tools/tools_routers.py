from typing import List
from utils.log import output_log


async def tools_routers(tools_name: List[str]):
    tools = []
    output_log(f"Initializing tools: {tools_name}", "DEBUG")
    for tool_name in tools_name:
        if tool_name == "tavily_search_tool":
            from services.tools.search_tools import tavily_search_tool

            tools += [tavily_search_tool]
        elif tool_name == "wikipedia_search_tool":
            from services.tools.search_tools import wikipedia_search_tool

            tools += [wikipedia_search_tool]

        elif tool_name == "rag_tool":
            from services.tools.rag_tools import rag_usage_tool

            tools += [rag_usage_tool]
        elif tool_name == "requests_tools":
            from services.tools.web_page_tools import requests_tools

            tools += requests_tools

        elif tool_name == "adaptive_web_crawler_tool":
            from services.tools.web_page_tools import adaptive_web_crawler_tool

            tools += [adaptive_web_crawler_tool]

        elif tool_name == "deep_web_crawler_tool":
            from services.tools.web_page_tools import deep_web_crawler_tool

            tools += [deep_web_crawler_tool]

        elif tool_name == "email_send_tool":
            from services.tools.smtp_tools import email_send_tool

            tools += [email_send_tool]
        elif tool_name == "minio_tool":
            from services.tools.minio_tools import minio_tool

            tools += minio_tool

        elif tool_name.endswith("_sql"):
            from services.tools.sql_tool import create_sql_tool

            tools += create_sql_tool(tool_name)

        elif tool_name == "General_ssh":
            from services.tools.ssh_tools import get_general_ssh_tool
            from handlers.tool_handlers import get_tool_by_name

            tool_info = get_tool_by_name(tool_name)
            tools += [get_general_ssh_tool(tool_info["url"])]

        elif tool_name.endswith("_ssh"):
            from services.tools.ssh_tools import get_ssh_tool
            from handlers.tool_handlers import get_tool_by_name

            tool_info = get_tool_by_name(tool_name)
            if tool_info["url"]:
                tools += [get_ssh_tool(tool_info["url"])]
            else:
                tools += [get_ssh_tool(tool_name[:-4])]

        elif tool_name.endswith("_mcp"):
            from services.tools.mcp_tools import create_mcp_tools
            from handlers.tool_handlers import get_tool_by_name

            tool_info = get_tool_by_name(tool_name)
            tools += await create_mcp_tools(
                tool_name, tool_info["url"], tool_info["headers"]
            )

    return tools
