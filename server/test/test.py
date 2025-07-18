import os
from dotenv import load_dotenv

# Load environment variables from .env file
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../test/.env')
load_dotenv(dotenv_path)

import sys

SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.dirname(SCRIPT_DIR+ '../'))
print(SCRIPT_DIR)

import uvicorn
from api.api import app
from api.setup import set_up
from config.config import config

if __name__ == "__main__":
    set_up()
    uvicorn.run(app, host=config.host, port=config.port)

