from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from models.user_models import UserLogin, TokenResponse, UserCreate
from config.config import config
import secrets

router = APIRouter()


@router.options("/login")
async def options_login():
    return Response(headers={"Allow": "POST, OPTIONS"})


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    from handlers.auth_handlers import authenticate_user, create_access_token

    user = authenticate_user(user_data.username, user_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user["user_name"]}, expiration_days=7
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/signup")
async def signup(user_data: UserCreate):
    if user_data.admin_password != config.admin_password:
        raise HTTPException(status_code=401, detail="Incorrect admin password")
    if user_data.username == "":
        raise HTTPException(status_code=422, detail="Empty username")
    if user_data.password == "":
        user_data.password = str(secrets.token_urlsafe(16))
    if user_data.email == "":
        user_data.email = user_data.username + "@example.com"
    if user_data.default_based_model == "":
        user_data.default_based_model = config.default_base_model
    user_data.default_embedding_model = config.embedding_model
    from handlers.auth_handlers import create_user

    response = create_user(user_data)
    if not response:
        raise HTTPException(status_code=400, detail="User Creation Failed")
    return response
