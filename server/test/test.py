import os
import sys
import uvicorn
from dotenv import load_dotenv

# Load environment variables from .env file
dotenv_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "../../test/.env"
)
with open(dotenv_path, "r") as f:
    for line in f:
        if line.strip() and not line.startswith("#"):
            key, value = line.strip().split("=", 1)
            os.environ[key] = value

SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.dirname(SCRIPT_DIR + "../"))

from api.api import app
from api.setup import set_up
from config.config import config
set_up()
uvicorn.run(app, host=config.host, port=config.port)
