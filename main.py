import uvicorn
from front.api import app
from config.config import config
import setup

if __name__ == "__main__":
    setup.set_up()
    uvicorn.run(app, host=config.host, port=config.port)