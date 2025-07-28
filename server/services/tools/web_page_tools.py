def async_playwright_toolkit():
    from langchain_community.agent_toolkits import PlayWrightBrowserToolkit
    from langchain_community.tools.playwright.utils import create_async_playwright_browser
    import nest_asyncio

    nest_asyncio.apply()
    async_browser = create_async_playwright_browser()
    toolkit = PlayWrightBrowserToolkit.from_browser(async_browser=async_browser)
    tools = toolkit.get_tools()
    return tools

def sync_playwright_toolkit():
    from langchain_community.agent_toolkits import PlayWrightBrowserToolkit
    from langchain_community.tools.playwright.utils import create_sync_playwright_browser
    sync_browser = create_sync_playwright_browser()
    toolkit = PlayWrightBrowserToolkit.from_browser(sync_browser=sync_browser)
    tools = toolkit.get_tools()
    return tools

def requests_toolkit():
    from langchain_community.agent_toolkits.openapi.toolkit import RequestsToolkit
    from langchain_community.utilities.requests import TextRequestsWrapper
    HEADERS = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
    }
    toolkit = RequestsToolkit(
        requests_wrapper=TextRequestsWrapper(headers=HEADERS),
        allow_dangerous_requests=True,
    )
    tools = toolkit.get_tools()
    return tools

async_playwright_tools = async_playwright_toolkit()
requests_tools = requests_toolkit()
