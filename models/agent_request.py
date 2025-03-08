from pydantic import BaseModel, Field
from datetime import datetime

class AgentRequest(BaseModel):
    id: datetime = Field(default=datetime.now)
    user_name: str
    type: str
    operator: str
    file_path: str
    collection_name: str
    message: str

