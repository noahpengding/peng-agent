from typing import List, Optional
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


class UserProfile(BaseModel):
    username: str
    email: str
    api_token: str
    default_base_model: str
    default_output_model: str
    default_embedding_model: str
    system_prompt: Optional[str] = None
    long_term_memory: List[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    password: Optional[str] = None
    email: Optional[str] = None
    default_base_model: Optional[str] = None
    default_output_model: Optional[str] = None
    default_embedding_model: Optional[str] = None
    system_prompt: Optional[str] = None
    long_term_memory: Optional[List[str]] = None
