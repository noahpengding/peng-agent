from pydantic import BaseModel, Field


class ModelConfig(BaseModel):
    operator: str = Field(default="openai")
    type: str = Field(default="chat")
    model_name: str = Field(default="gpt-3.5-turbo")
    isAvailable: bool = Field(default=False)
    input_text: bool = Field(default=True)
    output_text: bool = Field(default=True)
    input_image: bool = Field(default=False)
    output_image: bool = Field(default=False)
    input_audio: bool = Field(default=False)
    output_audio: bool = Field(default=False)
    input_video: bool = Field(default=False)
    output_video: bool = Field(default=False)
    reasoning_effect: str = Field(default="not a reasoning model")

    def to_dict(self):
        return self.model_dump()
