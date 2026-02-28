from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP, create_engine, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.mysql import VARCHAR
from config.config import config
import threading

Base = declarative_base()


class Operator(Base):
    __tablename__ = "operator"

    id = Column(Integer, primary_key=True, autoincrement=True)
    operator = Column(String(64), unique=True, nullable=False)
    runtime = Column(String(64))
    endpoint = Column(Text)
    api_key = Column(Text)
    org_id = Column(Text)
    project_id = Column(Text)
    embedding_pattern = Column(Text)
    image_pattern = Column(Text)
    audio_pattern = Column(Text)
    video_pattern = Column(Text)
    chat_pattern = Column(Text)

    def to_dict(self):
        return {
            "id": self.id,
            "operator": self.operator,
            "runtime": self.runtime,
            "endpoint": self.endpoint,
            "api_key": self.api_key,
            "org_id": self.org_id,
            "project_id": self.project_id,
            "embedding_pattern": self.embedding_pattern,
            "image_pattern": self.image_pattern,
            "audio_pattern": self.audio_pattern,
            "video_pattern": self.video_pattern,
            "chat_pattern": self.chat_pattern,
        }


class Model(Base):
    __tablename__ = "model"

    id = Column(Integer, primary_key=True, autoincrement=True)
    operator = Column(String(64), ForeignKey("operator.operator"))
    type = Column(String(64))
    model_name = Column(Text, nullable=False)
    isAvailable = Column(Boolean, default=False)
    input_text = Column(Boolean, default=True)
    output_text = Column(Boolean, default=True)
    input_image = Column(Boolean, default=False)
    output_image = Column(Boolean, default=False)
    input_audio = Column(Boolean, default=False)
    output_audio = Column(Boolean, default=False)
    input_video = Column(Boolean, default=False)
    output_video = Column(Boolean, default=False)
    reasoning_effect = Column(String(64), default="not a reasoning model")

    def to_dict(self):
        return {
            "id": self.id,
            "operator": self.operator,
            "type": self.type,
            "model_name": self.model_name,
            "isAvailable": self.isAvailable,
            "input_text": self.input_text,
            "output_text": self.output_text,
            "input_image": self.input_image,
            "output_image": self.output_image,
            "input_audio": self.input_audio,
            "output_audio": self.output_audio,
            "input_video": self.input_video,
            "output_video": self.output_video,
            "reasoning_effect": self.reasoning_effect,
        }


class Chat(Base):
    __tablename__ = "chat"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_name = Column(String(64))
    type = Column(String(64))
    base_model = Column(Text)
    human_input = Column(
        VARCHAR(config.input_max_length, charset='utf8mb4', collation='utf8mb4_unicode_ci'),
        nullable=False
    )
    knowledge_base = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "user_name": self.user_name,
            "type": self.type,
            "base_model": self.base_model,
            "knowledge_base": self.knowledge_base,
            "human_input": self.human_input,
            "created_at": self.created_at,
        }
    
class AIResponse(Base):
    __tablename__ = "ai_response"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chat_id = Column(Integer, ForeignKey("chat.id"))
    ai_response = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "chat_id": self.chat_id,
            "ai_response": self.ai_response,
            "created_at": self.created_at,
        }

class AIReasooning(Base):
    __tablename__ = "ai_reasoning"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chat_id = Column(Integer, ForeignKey("chat.id"))
    reasoning_process = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "chat_id": self.chat_id,
            "reasoning_process": self.reasoning_process,
            "created_at": self.created_at,
        }
    
class UserInput(Base):
    __tablename__ = "user_input"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chat_id = Column(Integer, ForeignKey("chat.id"))
    input_type = Column(String(64))
    input_content = Column(Text)
    input_location = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "chat_id": self.chat_id,
            "input_type": self.input_type,
            "input_content": self.input_content,
            "input_location": self.input_location,
            "created_at": self.created_at,
        }

class ToolCall(Base):
    __tablename__ = "tool_call"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chat_id = Column(Integer, ForeignKey("chat.id"))
    call_id = Column(String(128))
    tools_name = Column(String(128))
    tools_argument = Column(Text)
    problem = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "chat_id": self.chat_id,
            "call_id": self.call_id,
            "tools_name": self.tools_name,
            "tools_argument": self.tools_argument,
            "problem": self.problem,
            "created_at": self.created_at,
        }
    
class ToolOutput(Base):
    __tablename__ = "tool_output"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chat_id = Column(Integer, ForeignKey("chat.id"))
    call_id = Column(String(128))
    output_content = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "call_id": self.call_id,
            "output_content": self.output_content,
            "created_at": self.created_at,
        }


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_name = Column(String(64))
    knowledge_base = Column(Text)
    title = Column(Text)
    type = Column(Text)
    path = Column(Text)
    source = Column(Text)
    created_by = Column(Text)
    created_at = Column(TIMESTAMP, default=datetime.now)
    modified_at = Column(TIMESTAMP, default=datetime.now, onupdate=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "user_name": self.user_name,
            "knowledge_base": self.knowledge_base,
            "title": self.title,
            "type": self.type,
            "path": self.path,
            "source": self.source,
            "created_by": self.created_by,
            "created_at": self.created_at,
            "modified_at": self.modified_at,
        }


class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_name = Column(String(64), unique=True, nullable=False)
    password = Column(String(64), nullable=False)
    email = Column(String(64))
    api_token = Column(String(256))
    default_base_model = Column(Text)
    default_output_model = Column(Text)
    default_embedding_model = Column(Text)
    system_prompt = Column(Text, nullable=True)
    long_term_memory = Column(Text, nullable=True, default="[]")
    created_at = Column(TIMESTAMP, default=datetime.now)
    modified_at = Column(TIMESTAMP, default=datetime.now, onupdate=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "user_name": self.user_name,
            "password": self.password,
            "email": self.email,
            "api_token": self.api_token,
            "default_base_model": self.default_base_model,
            "default_output_model": self.default_output_model,
            "default_embedding_model": self.default_embedding_model,
            "system_prompt": self.system_prompt,
            "long_term_memory": self.long_term_memory,
            "created_at": self.created_at,
            "modified_at": self.modified_at,
        }


class Tools(Base):
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), unique=True, nullable=False)
    type = Column(String(64))
    url = Column(Text)
    headers = Column(Text)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "url": self.url,
            "headers": self.headers,
        }


# Database engine and session configuration
def get_database_url():
    return f"mysql+mysqlconnector://{config.mysql_user}:{config.mysql_password}@{config.mysql_host}/{config.mysql_database}"


_engine = None
_session_maker = None
_lock = threading.RLock()


def create_db_engine():
    global _engine
    if _engine is None:
        with _lock:
            if _engine is None:
                _engine = create_engine(
                    get_database_url(),
                    pool_pre_ping=True,
                    pool_recycle=3600,
                    echo=False,
                )
    return _engine


def get_session_maker():
    global _session_maker
    if _session_maker is None:
        with _lock:
            if _session_maker is None:
                engine = create_db_engine()
                _session_maker = sessionmaker(bind=engine)
    return _session_maker
