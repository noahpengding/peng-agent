from pydantic import BaseModel, Field


class RagRequest(BaseModel):
    user_name: str = Field(default="")
    file_path: str = Field(default="")
    collection_name: str = Field(default="")
