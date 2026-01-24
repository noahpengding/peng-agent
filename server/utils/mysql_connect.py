from typing import Dict, List, Optional, Any, Type
from sqlalchemy import and_, or_, not_
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from contextlib import contextmanager

from models.db_models import (
    AIResponse,
    AIReasooning,
    Base,
    Chat,
    ToolCall,
    ToolOutput,
    KnowledgeBase,
    User,
    UserInput,
    Operator,
    Model,
    Tools,
    get_session_maker,
    create_db_engine,
)
from utils.log import output_log


# Mapping of table names to ORM models
TABLE_MODEL_MAP = {
    "ai_response": AIResponse,
    "ai_reasoning": AIReasooning,
    "chat": Chat,
    "tool_call": ToolCall,
    "tool_output": ToolOutput,
    "knowledge_base": KnowledgeBase,
    "user": User,
    "user_input": UserInput,
    "operator": Operator,
    "model": Model,
    "tools": Tools,
}


class MysqlConnect:
    def __init__(self):
        self.SessionMaker = get_session_maker()
        self._session = None
        output_log("SQLAlchemy session maker initialized", "debug")

    @contextmanager
    def get_session(self):
        """Context manager for database sessions"""
        session = self.SessionMaker()
        try:
            yield session
            session.commit()
        except SQLAlchemyError as e:
            session.rollback()
            output_log(f"Database error: {e}", "error")
            raise
        finally:
            session.close()

    def close(self):
        """Close the session maker if needed"""
        if self._session:
            self._session.close()
            output_log("SQLAlchemy session closed", "debug")

    def _get_model(self, table: str) -> Type[Base]:
        """Get the ORM model class for a given table name"""
        model = TABLE_MODEL_MAP.get(table)
        if not model:
            raise ValueError(f"Unknown table: {table}")
        return model

    def _build_filter_conditions(self, model: Type[Base], conditions: dict):
        """
        Supports operators in keys:
        - "field=": equals
        - "field<>": not equals
        - "field>": greater than
        - "field<": less than
        - "field>=": greater than or equal
        - "field<=": less than or equal
        """
        filters = []
        for key, value in conditions.items():
            if key.endswith("="):
                field_name = key[:-1]
                filters.append(getattr(model, field_name) == value)
            elif key.endswith("<>"):
                field_name = key[:-2]
                filters.append(getattr(model, field_name) != value)
            elif key.endswith(">="):
                field_name = key[:-2]
                filters.append(getattr(model, field_name) >= value)
            elif key.endswith("<="):
                field_name = key[:-2]
                filters.append(getattr(model, field_name) <= value)
            elif key.endswith(">"):
                field_name = key[:-1]
                filters.append(getattr(model, field_name) > value)
            elif key.endswith("<"):
                field_name = key[:-1]
                filters.append(getattr(model, field_name) < value)
            else:
                # Default to equals
                filters.append(getattr(model, key) == value)
        return filters

    def create_record(self, table: str, data: dict):
        """Create a new record in the specified table"""
        model = self._get_model(table)
        with self.get_session() as session:
            record = model(**data)
            session.add(record)
            session.flush()
            output_log(f"Created record in {table}: {data}", "debug")
            session.refresh(record)
            return record.to_dict()


    def read_records(self, table: str, conditions: Optional[dict] = None) -> List[dict]:
        model = self._get_model(table)
        with self.get_session() as session:
            query = session.query(model)
            
            if conditions:
                filters = self._build_filter_conditions(model, conditions)
                query = query.filter(and_(*filters))
            
            results = query.all()
            output_log(f"Read {len(results)} records from {table} with conditions: {conditions}", "debug")
            return [record.to_dict() for record in results]

    def update_record(self, table: str, data: dict, conditions: dict):
        """Update records in the specified table matching the conditions"""
        model = self._get_model(table)
        with self.get_session() as session:
            query = session.query(model)
            
            if conditions:
                filters = self._build_filter_conditions(model, conditions)
                query = query.filter(and_(*filters))
            
            count = query.update(data, synchronize_session=False)
            output_log(f"Updated {count} records in {table} with data: {data}", "debug")

    def delete_record(self, table: str, conditions: Optional[dict]):
        """Delete records from the specified table matching the conditions"""
        model = self._get_model(table)
        with self.get_session() as session:
            query = session.query(model)
            
            if conditions:
                filters = self._build_filter_conditions(model, conditions)
                query = query.filter(and_(*filters))
            
            count = query.delete(synchronize_session=False)
            output_log(f"Deleted {count} records from {table}", "debug")
