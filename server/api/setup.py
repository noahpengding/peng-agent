from utils.mysql_connect import MysqlConnect

def set_up():
    mysql = MysqlConnect()
    mysql.create_table(
        "chat", 
        {
            "id": "INT AUTO_INCREMENT PRIMARY KEY", 
            "user_name": "VARCHAR(64)",
            "base_model": "TEXT",
            "embedding_model": "TEXT",
            "human_input": "VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", 
            "ai_response": "VARCHAR(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", 
            "knowledge_base": "TEXT",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "expire_at": "TIMESTAMP"})
    mysql.create_table(
        "knowledge_base",
        {
            "id": "INT AUTO_INCREMENT PRIMARY KEY",
            "user_name": "VARCHAR(64)",
            "knowledge_base": "TEXT",
            "title": "TEXT",
            "type": "TEXT",
            "path": "TEXT",
            "source": "TEXT",
            "created_by": "TEXT",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "modified_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"})
    mysql.create_table(
        "model",
        {
            "id": "INT AUTO_INCREMENT PRIMARY KEY",
            "operator": "VARCHAR(64)",
            "type": "VARCHAR(64)",
            "model_name": "TEXT",
            "available": "BOOL DEFAULT FALSE"
        }
    )
    mysql.create_table(
        "user",
        {
            "id": "INT AUTO_INCREMENT PRIMARY KEY",
            "user_name": "VARCHAR(64)",
            "password": "VARCHAR(64)",
            "email": "VARCHAR(64)",
            "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "modified_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        }
    )
    mysql.close()
