import logging
from config.config import config

logger = logging.getLogger(config.app_name)
logger.setLevel(config.log_level)
handler = logging.StreamHandler()
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)


def output_log(message, level):
    global logger
    if level.lower() == "warning":
        logger.warning(message)
    elif level.lower() == "error":
        logger.error(message)
    elif level.lower() == "debug":
        logger.debug(message)
    else:
        logger.info(message)
