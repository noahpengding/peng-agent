from langchain_mcp_adapters.client import MultiServerMCPClient

async def create_mcp_tools(tool_name, url, header):
    if not url:
        return []
    if not header:
        client = MultiServerMCPClient({
            tool_name: {
                "url": url,
                "transport": "streamable_http",
            }
        })
    else:
        client = MultiServerMCPClient({
            tool_name: {
                "url": url,
                "headers": header,
                "transport": "streamable_http",
            }
        })
    
    tools = await client.get_tools()
    return tools