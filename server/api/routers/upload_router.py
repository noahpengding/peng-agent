from fastapi import APIRouter, Depends
from fastapi.responses import Response
from handlers.auth_handlers import authenticate_request
from config.config import config
import datetime
import random

router = APIRouter()

@router.options("/upload")
async def options_upload():
    return Response(headers={"Allow": "POST, OPTIONS"})

@router.post("/upload")
async def upload_file(request: dict, auth: dict = Depends(authenticate_request)):
    from handlers.file_handlers import file_upload_frontend
    upload_path, success = file_upload_frontend(request["file_content"], request["content_type"])

    return {
        "upload_path": upload_path,
        "success": success
    }
