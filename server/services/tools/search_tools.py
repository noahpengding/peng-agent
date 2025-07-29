from langchain_core.tools import StructuredTool
from langchain_tavily import TavilySearch


def _wikipedia_search(query) -> str:
    from langchain_community.tools import WikipediaQueryRun
    from langchain_community.utilities import WikipediaAPIWrapper

    wikipedia = WikipediaAPIWrapper(doc_content_chars_max=10000)
    search = WikipediaQueryRun(api_wrapper=wikipedia)
    results = search.run(query)
    return results


tavily_search_tool = TavilySearch(
    max_results=5,
)

wikipedia_search_tool = StructuredTool.from_function(
    func=_wikipedia_search,
    name="wikipedia_search_tool",
    description="Search Wikipedia for Professional and Detailed information. Input should be a search query string.",
    args_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query to run on Wikipedia.",
            }
        },
        "required": ["query"],
    },
    return_direct=False,
)
