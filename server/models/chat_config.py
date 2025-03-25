from pydantic import BaseModel, Field
from typing import List


class ChatConfig(BaseModel):
    operator: str = Field(default="openai")
    base_model: str = Field(default="gpt-3.5-turbo")
    embedding_model: str = Field(default="gpt-3.5-turbo")
    collection_name: str = Field(default="")
    web_search: bool = Field(default=False)
    short_term_memory: List[str] = Field(default=[])
    long_term_memory: List[str] = Field(default=[])
