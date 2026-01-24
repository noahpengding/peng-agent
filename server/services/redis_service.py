from typing import Any, Dict, List, Optional

from utils.log import output_log
from utils.mysql_connect import MysqlConnect
from utils.redis import redis_cache

TABLES_ID = {
    "operator":"operator", 
    "model":"model_name", 
    "user":"user_name", 
    "tools":"name",
}

mysql_client = MysqlConnect()


def _validate_table(table: str) -> None:
    if table not in TABLES_ID.keys():
        raise ValueError(f"Unsupported table for Redis operations: {table}")


def refresh_table_cache(table: str) -> List[Dict[str, Any]]:
    """Reload a table from MySQL into Redis."""
    _validate_table(table)
    records = mysql_client.read_records(table)
    redis_cache.clear_table(table)
    redis_cache.load_records(table=table, records=records, id=TABLES_ID[table])
    output_log(f"Refreshed Redis cache for table {table}", "debug")
    return records

def setup_redis_cache():
    """Initial setup of Redis cache for all allowed tables."""
    for table in TABLES_ID.keys():
        refresh_table_cache(table)
        output_log(f"Set up Redis cache for table {table}", "info")


def get_table_records(table: str, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """Fetch all records for a table from Redis, optionally refreshing from MySQL."""
    _validate_table(table)
    if not force_refresh:
        cached = redis_cache.get_records(table)
        if cached:
            return cached
    return refresh_table_cache(table)


def get_table_record(
    table: str, record_id: str, force_refresh: bool = False
) -> Optional[Dict[str, Any]]:
    """Fetch a single record by id, optionally refreshing from MySQL when missing."""
    _validate_table(table)
    if not force_refresh:
        cached = redis_cache.get_record(table, record_id)
        if cached:
            return cached
    records = mysql_client.read_records(table, {"id": record_id})
    if not records:
        return None
    redis_cache.save_record(table, records[0])
    return records[0]


def create_table_record(table: str, record: Dict[str, Any], redis_id: Optional[str] = "id") -> Dict[str, Any]:
    """Create a new record in both MySQL and Redis."""
    _validate_table(table)
    mysql_client.create_record(table, record)
    redis_cache.save_record(table, record, id=redis_id)
    return record

def update_table_record(table: str, record: Dict[str, Any], conditions: Dict[str, Any], redis_id: Optional[str] = "id") -> int:
    """Update records in both MySQL and Redis."""
    _validate_table(table)
    updated_count = mysql_client.update_record(table, record, conditions)
    if updated_count > 0:
        record_id = conditions.get("id") or record.get("id")
        if record_id:
            updated_record = mysql_client.read_records(table, {"id": record_id})
            if updated_record:
                redis_cache.save_record(table, updated_record[0], id=redis_id)
    return updated_count


def delete_table_record(table: str, record_id: str) -> None:
    """Delete a cached record from Redis."""
    _validate_table(table)
    mysql_client.delete_record(table, {"id": record_id})
    redis_cache.delete_record(table, record_id)

