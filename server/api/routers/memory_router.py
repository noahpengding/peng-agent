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

@router.options("/update_lt_memory")
async def options_update_lt_memory():
    return Response(headers={"Allow": "POST, OPTIONS"})

@router.post("/update_lt_memory")
async def update_lt_memory(request: dict, auth: dict = Depends(authenticate_request)):
    from handlers.memory_handlers import update_lt_memory

    await update_lt_memory(request["user_name"])
    return {"message": "Long-term memory updated successfully"}
