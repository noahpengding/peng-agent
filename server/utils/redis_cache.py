import json
from typing import Any, Dict, Iterable, List, Optional

import redis

from config.config import config
from utils.log import output_log

# Tables we support in Redis caching layer
ALLOWED_TABLES = {"operator", "model", "user", "tools"}


class RedisCache:
    """Simple Redis cache to mirror selected MySQL tables."""

    def __init__(self) -> None:
        self.client = redis.Redis(
            host=config.redis_host,
            port=config.redis_port,
            db=config.redis_db,
            password=config.redis_password,
            decode_responses=True,
        )
        output_log(
            f"Initialized Redis client host={config.redis_host} port={config.redis_port} db={config.redis_db}",
            "debug",
        )

    def _assert_table(self, table: str) -> None:
        if table not in ALLOWED_TABLES:
            raise ValueError(f"Unsupported table for Redis cache: {table}")

    def _record_key(self, table: str, record_id: str) -> str:
        return f"{table}:{record_id}"

    def _index_key(self, table: str) -> str:
        return f"{table}:ids"

    def save_record(self, table: str, record: Dict[str, Any]) -> None:
        """Upsert a single record into Redis."""
        self._assert_table(table)
        record_id = record.get("id")
        if record_id is None:
            raise ValueError("Record must contain an 'id' field to be cached in Redis")

        key = self._record_key(table, record_id)
        index_key = self._index_key(table)
        payload = json.dumps(record, default=str)

        pipe = self.client.pipeline()
        pipe.set(key, payload)
        pipe.sadd(index_key, record_id)
        pipe.execute()
        output_log(f"Cached {table} record with id={record_id}", "debug")

    def load_records(self, table: str, records: Iterable[Dict[str, Any]]) -> None:
        """Bulk load a collection of records into Redis."""
        self._assert_table(table)
        pipe = self.client.pipeline()
        index_key = self._index_key(table)
        count = 0
        for record in records:
            record_id = record.get("id")
            if record_id is None:
                continue
            pipe.set(self._record_key(table, record_id), json.dumps(record, default=str))
            pipe.sadd(index_key, record_id)
            count += 1
        if count:
            pipe.execute()
            output_log(f"Bulk cached {count} {table} records", "debug")

    def get_record(self, table: str, record_id: str) -> Optional[Dict[str, Any]]:
        """Get a single record from Redis."""
        self._assert_table(table)
        payload = self.client.get(self._record_key(table, record_id))
        return json.loads(payload) if payload else None

    def get_records(self, table: str) -> List[Dict[str, Any]]:
        """Get all cached records for a table."""
        self._assert_table(table)
        ids = self.client.smembers(self._index_key(table))
        if not ids:
            return []
        pipe = self.client.pipeline()
        for record_id in ids:
            pipe.get(self._record_key(table, record_id))
        payloads = pipe.execute()
        return [json.loads(p) for p in payloads if p]

    def delete_record(self, table: str, record_id: str) -> None:
        """Remove a single record from Redis."""
        self._assert_table(table)
        pipe = self.client.pipeline()
        pipe.delete(self._record_key(table, record_id))
        pipe.srem(self._index_key(table), record_id)
        pipe.execute()
        output_log(f"Deleted {table} record id={record_id} from Redis", "debug")

    def clear_table(self, table: str) -> None:
        """Remove all cached records for a table."""
        self._assert_table(table)
        index_key = self._index_key(table)
        ids = self.client.smembers(index_key)
        if not ids:
            return
        pipe = self.client.pipeline()
        for record_id in ids:
            pipe.delete(self._record_key(table, record_id))
        pipe.delete(index_key)
        pipe.execute()
        output_log(f"Cleared Redis cache for table {table}", "debug")


redis_cache = RedisCache()
