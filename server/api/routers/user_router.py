from fastapi import APIRouter, Depends
from fastapi.responses import Response
from handlers.auth_handlers import authenticate_request
from models.user_models import UserProfile, UserUpdate

router = APIRouter()

@router.options("/user/profile")
async def options_user_profile():
    return Response(headers={"Allow": "GET, PUT, OPTIONS"})

@router.get("/user/profile", response_model=UserProfile)
async def get_profile(auth: dict = Depends(authenticate_request)):
    from handlers.user_handlers import get_user_profile
    return get_user_profile(auth["username"])

@router.put("/user/profile")
async def update_profile(user_data: UserUpdate, auth: dict = Depends(authenticate_request)):
    from handlers.user_handlers import update_user_profile
    return update_user_profile(auth["username"], user_data)
