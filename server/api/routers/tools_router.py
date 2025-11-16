from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from handlers.auth_handlers import authenticate_request

router = APIRouter()


@router.options("/tools")
async def options_tools():
    return Response(headers={"Allow": "GET, POST, OPTIONS"})


@router.get("/tools")
async def get_tools(auth: dict = Depends(authenticate_request)):
    from handlers.tool_handlers import get_all_tools

    return get_all_tools()


@router.get("/tool/{tool_name}")
async def get_tool_by_name(tool_name: str, auth: dict = Depends(authenticate_request)):
    from handlers.tool_handlers import get_tool_by_name

    tool = get_tool_by_name(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.post("/tools")
async def update_tools(auth: dict = Depends(authenticate_request)):
    from handlers.tool_handlers import update_tools

    update_tools()
    return {"message": "Tools updated successfully"}
