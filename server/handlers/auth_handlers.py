from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import jwt
from passlib.context import CryptContext
from utils.mysql_connect import MysqlConnect
from utils.log import output_log
from config.config import config

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
        if user["password"] == password:
            return user
        output_log(f"Invalid password for user: {username}", "warning")
        return None
    except Exception as e:
        output_log(f"Authentication error: {str(e)}", "error")
        return None
    finally:
        db.close()


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, config.jwt_secret_key, algorithm="HS256")
    return encoded_jwt
