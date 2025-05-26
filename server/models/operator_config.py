from pydantic import BaseModel, Field


class OperatorConfig(BaseModel):
    operator: str
    runtime: str
    endpoint: str
    api_key: str
    org_id: str = Field(default="")
    project_id: str = Field(default="")
    embedding_pattern: str = Field(default="")
    image_pattern: str = Field(default="")
    audio_pattern: str = Field(default="")
    video_pattern: str = Field(default="")
    chat_pattern: str = Field(default="")

    def to_dict(self):
        return self.model_dump()
