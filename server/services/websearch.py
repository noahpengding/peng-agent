from config.config import config
from tavily import TavilyClient


def _tavily_search(query, num_results=5):
    client = TavilyClient(config.tavily_api_key)
    response = client.search(
        query=query,
        num_results=num_results,
    )
    return response["results"] if response else []


def websearch_main(query):
    search_results = _tavily_search(query)
    return ";".join(
        [f"{result['title']} - {result['content']}" for result in search_results]
    )
