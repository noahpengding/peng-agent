from typing import List

def tools_routers(tools_name: List[str]):
    tools = []
    for tool_name in tools_name:
        if tool_name == "tavily_search_tool":
            from services.search_tools import tavily_search_tool
            tools += [tavily_search_tool]
        elif tool_name == "wikipedia_search_tool":
            from services.search_tools import wikipedia_search_tool
            tools += [wikipedia_search_tool]
        elif tool_name == "rag_tool":
            from services.rag_tools import rag_usage_tool
            tools += [rag_usage_tool]
        elif tool_name == "requests_tools":
            from services.web_page_tools import requests_tools
            tools += [requests_tools]
        elif tool_name == "playwright_tools":
            from services.web_page_tools import playwright_tools
            tools += [playwright_tools]
        elif tool_name == "email_send_tool":
            from services.smtp_tools import email_send_tool
            tools += [email_send_tool]

    return tools
