from langchain_core.tools import StructuredTool
from config.config import config
from crawl4ai import AdaptiveCrawler, AdaptiveConfig, CrawlerRunConfig, CrawlResult, Crawl4aiDockerClient
import asyncio


class DockerCrawlerAdapter:
    def __init__(self, docker_client):
        self._client = docker_client

    async def arun(self, url: str, config: CrawlerRunConfig = None, **kwargs) -> CrawlResult:
        result_list = await self._client.crawl(
            urls=[url],
            crawler_config=config,
            **kwargs
        )
        
        if result_list:
            return result_list
        return None


async def _adaptive_web_crawler(url: str, instructions: str) -> str:
    try:
        async with Crawl4aiDockerClient(base_url=config.crawler4ai_url) as docker_client:
            adapter = DockerCrawlerAdapter(docker_client)
            adaptive_config = AdaptiveConfig(
                confidence_threshold=0.8, max_pages=20, top_k_links=10, min_gain_threshold=0.05
            )
            crawler = AdaptiveCrawler(adapter, adaptive_config)
            await crawler.digest(
                start_url=url,
                query=instructions,
            )
            relevant_pages = crawler.get_relevant_content(top_k=10)
            return "\n".join([f"{page['url']}: {page['content']}" for page in relevant_pages])
    except Exception as e:
        return f"Error occurred during crawling: {str(e)}"

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


web_crawler_tool = StructuredTool.from_function(
    func=lambda url, instructions: asyncio.run(_adaptive_web_crawler(url, instructions)),
    name="web_crawler_tool",
    description="A web page crawler using Crawl4ai (Local Python Library) that can crawl web pages and extract relevant information based on a query. Input should be a URL for the starting web page and a query string for the information to extract.",
    args_schema={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The Starting URL of the web page to crawl.",
            },
            "instructions": {
                "type": "string",
                "description": "The query string for the information to extract from the crawled web pages.",
            },
        },
        "required": ["url", "instructions"],
    },
    return_direct=False,
)

requests_tools = requests_toolkit()
