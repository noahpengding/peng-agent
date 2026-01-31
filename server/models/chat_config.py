from pydantic import BaseModel, Field
from typing import List


class ChatConfig(BaseModel):
    operator: str = Field(default="openai")
    base_model: str = Field(default="gpt-3.5-turbo")
    tools_name: List[str] = Field(default=[])
    short_term_memory: List[int] = Field(default=[])
    long_term_memory: List[str] = Field(default=[])
