import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
dotenv_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "../../test/.env"
)
load_dotenv(dotenv_path)

from services.tools.web_page_tools import web_crawler

results = web_crawler("https://www.invesco.com/qqq-etf/en/about.html")
print(results)