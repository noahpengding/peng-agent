from langchain_core.tools import StructuredTool
from config.config import config


def _wikipedia_search(query) -> str:
    from langchain_community.tools import WikipediaQueryRun
    from langchain_community.utilities import WikipediaAPIWrapper

    wikipedia = WikipediaAPIWrapper(doc_content_chars_max=10000)
    search = WikipediaQueryRun(api_wrapper=wikipedia)
    results = search.run(query)
    return results


def _tavily_search(query: str, topic="general") -> str:
    from tavily import TavilyClient

    client = TavilyClient(
        api_key=config.tavily_api_key,
    )
    response = client.search(
        query=query,
        topic=topic,
        search_depth="advanced",
        max_results=config.web_search_max_results,
        include_images=True,
        include_image_descriptions=True,
    )
    return [
        f"{result['title']} --- {result['url']}: {result['content']}"
        for result in response["results"]] + [
        f"url: {result['url']}, description:{result['description']}" 
        for result in response["images"] if response["images"] is not None
    ]

def _tavily_crawler(url: str, instructions: str) -> str:
    from tavily import TavilyClient

    client = TavilyClient(
        api_key=config.tavily_api_key,
    )
    response = client.crawl(
        url=url,
        instructions=instructions,
        max_depth=3,
        max_breadth=20,
        limit=30,
        allow_external=False,
    )
    return [
        f"{result['title']} --- {result['url']}: {result['content']}"
        for result in response["results"]
    ]

tavily_search_tool = StructuredTool.from_function(
    func=_tavily_search,
    name="tavily_search_tool",
    description="A search engine using Tavily (SaaS remote provider) that searches the web for relevant information. Input should be a query string for search. Use this tool when you want to search the web for information and did not have a specific url to start with",
    args_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The query to run on the web.",
            },
        },
        "required": ["query"],
    },
    return_direct=False,
)

tavily_crawler_tool = StructuredTool.from_function(
    func=_tavily_crawler,
    name="tavily_crawler_tool",
    description="A web crawler using Tavily (SaaS remote provider) that crawls a given url and extract relevant information based on the given instructions. Input should be a url and instructions for crawling. Use this tool when you have a specific url to start with",
    args_schema={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The url to crawl.",
            },
            "instructions": {
                "type": "string",
                "description": "The instructions for crawling the url.",
            },
        },
        "required": ["url", "instructions"],
    },
    return_direct=False,
)

tavily_tools = [tavily_search_tool, tavily_crawler_tool]

wikipedia_search_tool = StructuredTool.from_function(
    func=_wikipedia_search,
    name="wikipedia_search_tool",
    description="Search Wikipedia for Professional and Detailed information. Input should be a query string for search.",
    args_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The query to run on Wikipedia.",
            }
        },
        "required": ["query"],
    },
    return_direct=False,
)
