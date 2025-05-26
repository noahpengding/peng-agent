from pydantic import BaseModel, Field


class RagRequest(BaseModel):
    user_name: str = Field(default="")
    file_path: str = Field(default="")
    type_of_file: str = Field(default="standard")
    collection_name: str = Field(default="")
