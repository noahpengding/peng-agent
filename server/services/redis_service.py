from typing import Any, Dict, List, Optional

from redis.exceptions import RedisError

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


def _log_redis_error(action: str, exc: Exception) -> None:
    output_log(f"Redis {action} failed: {exc}", "warning")


def refresh_table_cache(table: str) -> List[Dict[str, Any]]:
    """Reload a table from MySQL into Redis."""
    _validate_table(table)
    records = mysql_client.read_records(table)
    try:
        redis_cache.clear_table(table)
        redis_cache.load_records(table=table, records=records, id=TABLES_ID[table])
        output_log(f"Refreshed Redis cache for table {table}", "debug")
    except RedisError as exc:
        _log_redis_error(f"refresh {table}", exc)
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
        try:
            cached = redis_cache.get_records(table)
            if cached:
                return cached
        except RedisError as exc:
            _log_redis_error(f"get {table} records", exc)
    return refresh_table_cache(table)


def get_table_record(
    table: str, record_id: str, force_refresh: bool = False
) -> Optional[Dict[str, Any]]:
    """Fetch a single record by id, optionally refreshing from MySQL when missing."""
    _validate_table(table)
    if not force_refresh:
        try:
            cached = redis_cache.get_record(table, record_id)
            if cached:
                return cached
        except RedisError as exc:
            _log_redis_error(f"get {table} record", exc)
    # Use the correct field name for lookup based on TABLES_ID
    lookup_field = TABLES_ID[table]
    records = mysql_client.read_records(table, {lookup_field: record_id})
    if not records:
        return None
    try:
        redis_cache.save_record(table, records[0], id=lookup_field)
    except RedisError as exc:
        _log_redis_error(f"save {table} record", exc)
    return records[0]


def create_table_record(table: str, record: Dict[str, Any], redis_id: Optional[str] = "id") -> Dict[str, Any]:
    """Create a new record in both MySQL and Redis."""
    _validate_table(table)
    created_record = mysql_client.create_record(table, record)
    try:
        redis_cache.save_record(table, created_record, id=redis_id)
    except RedisError as exc:
        _log_redis_error(f"save {table} record", exc)
    return created_record

def update_table_record(table: str, record: Dict[str, Any], conditions: Dict[str, Any], redis_id: Optional[str] = "id") -> int:
    """Update records in both MySQL and Redis."""
    _validate_table(table)
    updated_count = mysql_client.update_record(table, record, conditions)
    if updated_count > 0:
        lookup_field = TABLES_ID[table]
        record_id = conditions.get(lookup_field) or record.get(lookup_field)
        if record_id:
            updated_record = mysql_client.read_records(table, {lookup_field: record_id})
            if updated_record:
                try:
                    redis_cache.save_record(table, updated_record[0], id=redis_id)
                except RedisError as exc:
                    _log_redis_error(f"save {table} record", exc)
    return updated_count


def delete_table_record(table: str, record_id: str) -> None:
    """Delete a cached record from Redis."""
    _validate_table(table)
    lookup_field = TABLES_ID[table]
    mysql_client.delete_record(table, {lookup_field: record_id})
    try:
        redis_cache.delete_record(table, record_id)
    except RedisError as exc:
        _log_redis_error(f"delete {table} record", exc)
