from pydantic import BaseModel, Field


class UserLogin(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    admin_password: str
    username: str
    password: str = Field(default="")
    email: str = Field(default="")
    default_based_model: str = Field(default="")
    default_embedding_model: str = Field(default="")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
