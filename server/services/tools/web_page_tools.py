from langchain_core.tools import StructuredTool
import asyncio


async def adaptive_web_crawler(url: str, query: str) -> str:
    from crawl4ai import AsyncWebCrawler, AdaptiveCrawler, AdaptiveConfig

    adaptive_config = AdaptiveConfig(
        confidence_threshold=0.8, max_pages=10, top_k_links=5, min_gain_threshold=0.05
    )

    async with AsyncWebCrawler() as crawler:
        adaptive = AdaptiveCrawler(crawler, adaptive_config)
        await adaptive.digest(
            start_url=url,
            query=query,
        )

        relevant_pages = adaptive.get_relevant_content(top_k=10)
    return "\n\n".join(
        [
            f"Source: {page['url']}\nContent: {page['content']}"
            for page in relevant_pages
        ]
    )


async def deep_web_crawler(url: str) -> str:
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
    from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
    from crawl4ai.content_scraping_strategy import LXMLWebScrapingStrategy

    config = CrawlerRunConfig(
        deep_crawl_strategy=BFSDeepCrawlStrategy(
            max_depth=5, include_external=True, max_pages=10, score_threshold=0.2
        ),
        scraping_strategy=LXMLWebScrapingStrategy(),
        verbose=False,
    )

    async with AsyncWebCrawler() as crawler:
        results = await crawler.arun(url, config=config)
    response = ""
    for result in results:
        if len(str(result.html)) > 1000:
            from handlers.model_utils import get_model_instance_by_operator

            llm = get_model_instance_by_operator("openai", "gpt-4.1-mini")
            summary = await llm.ainvoke(
                f"Extract useful information from the following web page content do not summary or modify them:\n{result.html}"
            )
            response += f"Source: {result.url}\nContent: {summary.content}\n\n"
        else:
            response += f"Source: {result.url}\nContent: {result.html}\n\n"
    return response


def requests_toolkit():
    from langchain_community.agent_toolkits.openapi.toolkit import RequestsToolkit
    from langchain_community.utilities.requests import TextRequestsWrapper

    HEADERS = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
    }
    toolkit = RequestsToolkit(
        requests_wrapper=TextRequestsWrapper(headers=HEADERS),
        allow_dangerous_requests=True,
    )
    tools = toolkit.get_tools()
    return tools


adaptive_web_crawler_tool = StructuredTool.from_function(
    func=lambda url, query: asyncio.run(adaptive_web_crawler(url, query)),
    name="adaptive_web_crawler_tool",
    description="A web page crawler that can crawl web pages and extract relevant information based on a query. Input should be a URL for the starting web page and a query string for the information to extract.",
    args_schema={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The Starting URL of the web page to crawl.",
            },
            "query": {
                "type": "string",
                "description": "The query string for the information to extract from the web pages.",
            },
        },
        "required": ["url", "query"],
    },
    return_direct=False,
)

deep_web_crawler_tool = StructuredTool.from_function(
    func=lambda url: asyncio.run(deep_web_crawler(url)),
    name="deep_web_crawler_tool",
    description="A web page crawler that can deeply crawl web pages and extract all the information under the page and its subpages. Input should be a URL for the starting web page.",
    args_schema={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The Starting URL of the web page to crawl.",
            },
        },
        "required": ["url"],
    },
    return_direct=False,
)


requests_tools = requests_toolkit()
