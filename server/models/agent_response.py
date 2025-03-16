from pydantic import BaseModel
from typing import Optional

class ChatResponse(BaseModel):
    user_name: str
    message: str
    image: Optional[str] = None
