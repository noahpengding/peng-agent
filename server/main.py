import uvicorn
from api.api import app
from config.config import config
import api.setup as setup
from utils.log import output_log
import importlib.metadata

if __name__ == "__main__":
    setup.set_up()
    output_log(f"Starting {config.app_name} API", "INFO")
    output_log(f"Version: {importlib.metadata.version('Peng-Agent')}", "INFO")
    uvicorn.run(app, host=config.host, port=config.port, log_level=config.log_level.lower())
