from utils.log import output_log
from utils.mysql_connect import MysqlConnect

def get_memory():
    output_log("GET /memory", "DEBUG")
    m = MysqlConnect()
    return m.read_records("chat")