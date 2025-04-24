from pydantic import BaseModel, Field


class ModelConfig(BaseModel):
    operator: str = Field(default="openai")
    type: str = Field(default="chat")
    model_name: str = Field(default="gpt-3.5-turbo")
    isAvailable: bool = Field(default=False)

    def to_dict(self):
        return self.model_dump()
