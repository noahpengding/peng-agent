from pydantic import BaseModel, Field

class AgentResponse(BaseModel):
    user_name: str
    message: str
