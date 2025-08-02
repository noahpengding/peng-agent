from pydantic import BaseModel, Field


class ModelConfig(BaseModel):
    operator: str = Field(default="openai")
    type: str = Field(default="chat")
    model_name: str = Field(default="gpt-3.5-turbo")
    isAvailable: bool = Field(default=False)
    isMultimodal: bool = Field(default=False)
    reasoning_effect: str = Field(default="Not Reasoning Model")

    def to_dict(self):
        return self.model_dump()
