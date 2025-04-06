from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import jwt
from passlib.context import CryptContext
from utils.mysql_connect import MysqlConnect
from utils.log import output_log
from config.config import config
from fastapi import HTTPException, Request
from models.user_models import UserCreate

# Configure password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def authenticate_user(username: str, password: str) -> Optional[Dict]:
    try:
        db = MysqlConnect()
        user_records = db.read_record_v2("user", {"user_name=": username})

        if not user_records or len(user_records) == 0:
            output_log(f"User not found: {username}", "warning")
            return None

        user = user_records[0]
        if verify_password(password, user["password"]):
            return user
        output_log(f"Invalid password for user: {username}", "warning")
        return None
    except Exception as e:
        output_log(f"Authentication error: {str(e)}", "error")
        return None
    finally:
        db.close()


def create_user(user_data: UserCreate) -> Optional[Dict]:
    try:
        db = MysqlConnect()
        user_records = db.read_record_v2("user", {"user_name=": user_data.username})
        if user_records and len(user_records) > 0:
            output_log(f"User already exists: {user_data.username}", "warning")
            raise HTTPException(status_code=400, detail="User already exists")
        hashed_password = get_password_hash(user_data.password)
        api_token = create_access_token({"sub": user_data.username}, None)
        db.create_record(
            "user",
            {
                "user_name": user_data.username,
                "password": hashed_password,
                "email": user_data.email,
                "api_token": api_token,
                "default_based_model": user_data.default_based_model,
                "default_embedding_model": user_data.default_embedding_model,
            },
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
    finally:
        db.close()


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
            raise HTTPException(
                status_code=401, detail="Invalid authentication credentials"
            )
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
