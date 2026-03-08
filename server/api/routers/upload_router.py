from fastapi import APIRouter, Depends
from fastapi.responses import Response
from handlers.auth_handlers import authenticate_request

router = APIRouter()


@router.options("/upload")
async def options_upload():
    return Response(headers={"Allow": "POST, OPTIONS"})


@router.post("/upload")
async def upload_file(request: dict, auth: dict = Depends(authenticate_request)):
    from handlers.file_handlers import file_upload_frontend_with_name

    upload_path, success = file_upload_frontend_with_name(
        request["file_content"],
        request["content_type"],
        request.get("file_name"),
        auth.get("username", ""),
    )

    return {"upload_path": upload_path, "success": success}
