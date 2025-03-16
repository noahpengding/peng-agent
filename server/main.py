import uvicorn
from api.api import app
from config.config import config
import api.setup as setup

if __name__ == "__main__":
    setup.set_up()
    uvicorn.run(app, host=config.host, port=config.port)