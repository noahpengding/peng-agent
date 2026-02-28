import json
from typing import Dict
from fastapi import HTTPException
from models.user_models import UserProfile, UserUpdate
from utils.mysql_connect import MysqlConnect
from utils.log import output_log
from handlers.auth_handlers import get_password_hash, create_access_token

def get_user_profile(username: str) -> UserProfile:
    mysql = MysqlConnect()
    try:
        user_records = mysql.read_records("user", {"user_name": username})
        if not user_records or len(user_records) == 0:
            raise HTTPException(status_code=404, detail="User not found")

        user = user_records[0]

        # Parse long_term_memory from JSON string
        long_term_memory = []
        if user.get("long_term_memory"):
            try:
                long_term_memory = json.loads(user["long_term_memory"])
                if not isinstance(long_term_memory, list):
                    long_term_memory = []
            except json.JSONDecodeError:
                output_log(f"Error decoding long_term_memory for user {username}", "error")
                long_term_memory = []

        return UserProfile(
            username=user["user_name"],
            email=user.get("email") or "",
            api_token=user.get("api_token") or "",
            default_base_model=user.get("default_base_model") or "",
            default_output_model=user.get("default_output_model") or "",
            default_embedding_model=user.get("default_embedding_model") or "",
            system_prompt=user.get("system_prompt"),
            long_term_memory=long_term_memory
        )
    finally:
        mysql.close()

def update_user_profile(username: str, user_data: UserUpdate) -> Dict:
    mysql = MysqlConnect()
    try:
        # Check if user exists using read_records (which handles its own session)
        user_records = mysql.read_records("user", {"user_name": username})
        if not user_records or len(user_records) == 0:
            raise HTTPException(status_code=404, detail="User not found")

        update_fields = {}

        if user_data.password:
            update_fields["password"] = get_password_hash(user_data.password)

        if user_data.email is not None:
            update_fields["email"] = user_data.email

        if user_data.default_base_model is not None:
            update_fields["default_base_model"] = user_data.default_base_model

        if user_data.default_output_model is not None:
            update_fields["default_output_model"] = user_data.default_output_model

        if user_data.default_embedding_model is not None:
            update_fields["default_embedding_model"] = user_data.default_embedding_model

        if user_data.system_prompt is not None:
            update_fields["system_prompt"] = user_data.system_prompt

        if user_data.long_term_memory is not None:
            # Validate long_term_memory entries
            MAX_MEMORY_LENGTH = 100
            for i, memory in enumerate(user_data.long_term_memory):
                if len(memory) > MAX_MEMORY_LENGTH:
                    user_data.long_term_memory[i] = memory[:MAX_MEMORY_LENGTH]
            update_fields["long_term_memory"] = json.dumps(user_data.long_term_memory)

        if not update_fields:
            return {"message": "No changes to update"}

        # Use mysql.get_session() to handle commit/rollback explicitly for the update
        with mysql.get_session():
            mysql.update_record("user", update_fields, {"user_name": username})

        return {"message": "User profile updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        output_log(f"Error updating user profile: {str(e)}", "error")
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")
    finally:
        mysql.close()

def regenerate_user_token(username: str) -> Dict:
    mysql = MysqlConnect()
    try:
        user_records = mysql.read_records("user", {"user_name": username})
        if not user_records or len(user_records) == 0:
            raise HTTPException(status_code=404, detail="User not found")

        new_token = create_access_token({"sub": username}, None)

        with mysql.get_session():
            mysql.update_record("user", {"api_token": new_token}, {"user_name": username})

        return {"api_token": new_token}
    except Exception as e:
        output_log(f"Error regenerating token: {str(e)}", "error")
        raise HTTPException(status_code=500, detail=f"Failed to regenerate token: {str(e)}")
    finally:
        mysql.close()
