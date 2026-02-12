from langchain_core.tools import StructuredTool
from config.config import config
import time


def _web_crawler(url: str) -> str:
    import requests

    browser_config = {
        "browser_type": "chromium",
        "headless": True,
        "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    }
    crawler_config = {
        "only_text": True,
        "simulate_user": True,
    }
    r = requests.post(
        f"{config.crawler4ai_url}/crawl/job",
        json={
            "urls": [url],
            "browser_config": browser_config,
            "crawler_config": crawler_config,
        },
        timeout=60,
    )
    job_response = r.json()
    task_id = job_response["task_id"]
    start_time = time.time()
    while True:
        if time.time() - start_time > 300:
            return f"Task {task_id}: Request timed out."
        result = requests.get(f"{config.crawler4ai_url}/crawl/job/{task_id}", timeout=60)
        status = result.json()
        if status["status"] and status["status"] == "failed":
            return f"Task {task_id}: Crawling failed with error {status.get("error")}."
        if status["status"] and status["status"] == "completed":
            return status["result"]["results"]
        
        time.sleep(5)

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
    func=_web_crawler,
    name="web_crawler_tool",
    description="A web page crawler that can crawl web pages and extract relevant information. Input should be a URL for the starting web page.",
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
