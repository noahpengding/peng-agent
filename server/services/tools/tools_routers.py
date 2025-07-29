from typing import List

def tools_routers(tools_name: List[str]):
    tools = []
    for tool_name in tools_name:
        if tool_name == "tavily_search_tool":
            from services.tools.search_tools import tavily_search_tool
            tools += [tavily_search_tool]
        elif tool_name == "wikipedia_search_tool":
            from services.tools.search_tools import wikipedia_search_tool
            tools += [wikipedia_search_tool]
        elif tool_name == "current_date_tool":
            from services.tools.current_date_tool import date_tools
            tools += date_tools
        elif tool_name == "rag_tool":
            from services.tools.rag_tools import rag_usage_tool
            tools += [rag_usage_tool]
        elif tool_name == "requests_tools":
            from services.tools.web_page_tools import requests_tools
            tools += requests_tools
        elif tool_name == "playwright_tools":
            from services.tools.web_page_tools import async_playwright_tools
            tools += async_playwright_tools
        elif tool_name == "email_send_tool":
            from services.tools.smtp_tools import email_send_tool
            tools += [email_send_tool]
        elif tool_name == "minio_upload_tool":
            from services.tools.minio_tools import minio_upload_tool
            tools += [minio_upload_tool]

    return tools
