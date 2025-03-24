from pydantic import BaseModel, Field
from datetime import datetime
from models.chat_config import ChatConfig

class ChatRequest(BaseModel):
    id: datetime = Field(default=datetime.now)
    user_name: str = Field(default="")
    message: str = Field(default="")
    image: str = Field(default="")
    config: ChatConfig = Field(default=ChatConfig())

