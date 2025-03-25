import mysql.connector
from mysql.connector import Error
from config.config import config
from utils.log import output_log


class MysqlConnect:
    def __init__(self):
        self.config = {
            "host": config.mysql_host,
            "user": config.mysql_user,
            "password": config.mysql_password,
            "database": config.mysql_database,
        }
        self.connection = self._connect()

    def _connect(self):
        try:
            output_log(f"Connecting to config {self.config}", "debug")
            conn = mysql.connector.connect(**self.config)
            if conn.is_connected():
                return conn
        except Error as e:
            output_log(f"Connection to config {self.config} with error: {e}", "error")
            raise

    def close(self):
        if self.connection.is_connected():
            self.connection.close()

    def execute_query(self, query, params=None):
        cursor = self.connection.cursor(dictionary=True)
        output_log(f"Executing query: {query} with params: {params}", "debug")
        try:
            cursor.execute(query, params)
            self.connection.commit()
            return cursor
        except Error as e:
            self.connection.rollback()
            output_log(f"Query {query} with error: {e}", "error")
            raise
        finally:
            cursor.close()

    def create_record(self, table, data: dict):
        keys = ", ".join(data.keys())
        placeholders = ", ".join(["%s"] * len(data))
        query = f"INSERT INTO {table} ({keys}) VALUES ({placeholders})"
        params = tuple(data.values())
        self.execute_query(query, params)

    def create_table(self, table, columns: dict):
        cols = ", ".join([f"{k} {v}" for k, v in columns.items()])
        if len(table.split(".")) > 2:
            database, table = table.split(".")
        create_query = f"CREATE TABLE IF NOT EXISTS {table} ({cols});"
        self.execute_query(create_query)

    def read_records(self, table, conditions: dict = None):
        if conditions:
            new_conditions = {}
            for key, value in conditions.items():
                if isinstance(value, str):
                    new_conditions[f"{key}="] = f"{value}"
            return self.read_record_v2(table, new_conditions)
        return self.read_record_v2(table, conditions)

    def read_record_v2(self, table, conditions: dict):
        query = f"SELECT * FROM {table}"
        params = None
        if conditions:
            conds = " AND ".join([f"{k}%s" for k in conditions.keys()])
            query += " WHERE " + conds
            params = tuple(conditions.values())
        cursor = self.connection.cursor(dictionary=True)
        output_log(f"Executing query: {query} with params: {params}", "debug")
        try:
            cursor.execute(query, params)
            return cursor.fetchall()
        except Error as e:
            output_log(f"Query {query} with error: {e}", "error")
            raise
        finally:
            cursor.close()

    def update_record(self, table, data: dict, conditions: dict):
        set_clause = ", ".join([f"{k}=%s" for k in data.keys()])
        cond_clause = " AND ".join([f"{k}=%s" for k in conditions.keys()])
        query = f"UPDATE {table} SET {set_clause} WHERE {cond_clause}"
        params = tuple(data.values()) + tuple(conditions.values())
        self.execute_query(query, params)

    def delete_record(self, table, conditions: dict):
        cond_clause = " AND ".join([f"{k}=%s" for k in conditions.keys()])
        query = f"DELETE FROM {table} WHERE {cond_clause}"
        params = tuple(conditions.values())
        self.execute_query(query, params)
