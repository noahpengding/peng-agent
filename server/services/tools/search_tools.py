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
        max_results=5,
    )
    return [
        f"{result['title']} --- {result['url']}: {result['content']}"
        for result in response["results"]
    ]


tavily_search_tool = StructuredTool.from_function(
    func=_tavily_search,
    name="tavily_search_tool",
    description="A search engine that searches the web for relevant information. Input should be a query string for search, a topic choosen from [general, news, finance]",
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
