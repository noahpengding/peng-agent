from fastapi import APIRouter, Depends
from fastapi.responses import Response
from models.rag_requests import RagRequest
from handlers.auth_handlers import authenticate_request

router = APIRouter()


@router.get("/rag")
async def rag(auth: dict = Depends(authenticate_request)):
    from handlers.rag_handlers import get_rag

    return get_rag()


@router.post("/rag")
async def index_file_api(
    request: RagRequest, auth: dict = Depends(authenticate_request)
):
    if request.user_name == "":
        request.user_name = auth["username"]
    from handlers.rag_handlers import index_all

    return index_all(
        request.user_name,
        request.file_path,
        request.type_of_file,
        request.collection_name,
    )


@router.options("/rag")
async def options_rag():
    return Response(headers={"Allow": "POST, OPTIONS, GET"})
