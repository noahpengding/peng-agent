from fastapi import APIRouter, Depends
from fastapi.responses import Response
from handlers.auth_handlers import authenticate_request

router = APIRouter()


@router.options("/memory")
async def options_memory():
    return Response(headers={"Allow": "POST, OPTIONS"})


@router.post("/memory")
async def memory(request: dict, auth: dict = Depends(authenticate_request)):
    from handlers.memory_handlers import get_memory

    return get_memory(request["user_name"])
