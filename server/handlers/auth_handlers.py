from datetime import datetime, timedelta, timezone
from typing import Optional, Dict

import bcrypt
from fastapi import HTTPException, Request
import jwt

from config.config import config
from models.user_models import UserCreate
from utils.log import output_log
from services.redis_service import get_table_record, create_table_record

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        plain_bytes = plain_password.encode("utf-8")
        hashed_bytes = (
            hashed_password.encode("utf-8")
            if isinstance(hashed_password, str)
            else hashed_password
        )
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except (TypeError, ValueError) as exc:
        output_log(f"Password verification error: {str(exc)}", "error")
        return False


def get_password_hash(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def authenticate_user(username: str, password: str) -> Optional[Dict]:
    try:
        user = get_table_record("user", username)
        if not user:
            output_log(f"User not found: {username}", "warning")
            return None
        if verify_password(password, user["password"]):
            return user
        output_log(f"Invalid password for user: {username}", "warning")
        return None
    except Exception as e:
        output_log(f"Authentication error: {str(e)}", "error")
        return None
def create_user(user_data: UserCreate) -> Optional[Dict]:
    try:
        existing_user = get_table_record("user", user_data.username)
        if existing_user:
            output_log(f"User already exists: {user_data.username}", "warning")
            raise HTTPException(status_code=400, detail="User already exists")
        hashed_password = get_password_hash(user_data.password)
        api_token = create_access_token({"sub": user_data.username}, None)
        create_table_record(
            "user",
            {
                "user_name": user_data.username,
                "password": hashed_password,
                "email": user_data.email,
                "api_token": api_token,
                "default_base_model": user_data.default_based_model,
                "default_output_model": user_data.default_based_model,
                "default_embedding_model": user_data.default_embedding_model,
            },
            redis_id="user_name",
        )
        return {
            "user_name": user_data.username,
            "password": user_data.password,
            "email": user_data.email,
            "api_token": api_token,
        }
    except Exception as e:
        output_log(f"User creation error: {str(e)}", "error")
        return None


def create_access_token(data: dict, expiration_days: int) -> str:
    to_encode = data.copy()
    if expiration_days:
        # Other JWT token has expiration
        expire = datetime.now(timezone.utc) + timedelta(days=expiration_days)
        to_encode.update({"exp": expire})
    else:
        # API token has infinite expiration
        to_encode.update({"exp": datetime.max})
    encoded_jwt = jwt.encode(to_encode, config.jwt_secret_key, algorithm="HS256")
    return encoded_jwt


async def authenticate_request(request: Request):
    try:
        token = request.headers.get("Authorization")
        if not token:
            raise HTTPException(status_code=401, detail="Invalid authentication Token")
        if token.startswith("Bearer "):
            token = token[7:]
        payload = jwt.decode(token, config.jwt_secret_key, algorithms=["HS256"])
        username: str = payload.get("sub")
        expiration = payload.get("exp")
        # If expiration is None, it means the token is infinite
        # If expiration is not None, check if it is expired with current time
        if expiration and datetime.fromtimestamp(
            expiration, tz=timezone.utc
        ) < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Token has expired")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid username")
        return {"auth_type": "jwt", "username": username}
    except Exception as e:
        output_log(f"Authentication error: {str(e)}", "error")
        raise HTTPException(
            status_code=401, detail="Invalid authentication credentials"
        )
