from pydantic import BaseModel, Field
from typing import Union, List, Literal
from datetime import datetime
from models.chat_config import ChatConfig


class ChatRequest(BaseModel):
    id: datetime = Field(default=datetime.now)
    user_name: str = Field(default="")
    message: Union[str, List[str]] = Field(default="")
    knowledge_base: str = Field(default="")
    image: Union[str, List[str]] = Field(default="")
    config: ChatConfig = Field(default=ChatConfig())


class ChatFeedbackRequest(BaseModel):
    chat_id: int = Field(default=0)
    user_name: str = Field(default="")
    feedback: Literal["upvote", "downvote", "no_response"] = Field(default="no_response")
