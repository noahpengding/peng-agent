from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from models.agent_request import ChatRequest
from handlers.auth_handlers import authenticate_request
from utils.log import output_log

router = APIRouter()


@router.options("/chat")
async def options_chat():
    return Response(headers={"Allow": "POST, OPTIONS"})


@router.post("/chat")
async def chat(request: ChatRequest, auth: dict = Depends(authenticate_request)):
    output_log(request, "DEBUG")
    if request.message.strip() == "":
        raise HTTPException(status_code=400, detail="Empty message")
    from handlers.chat_handlers import create_streaming_response

    return create_streaming_response(
        request.user_name, request.message, request.image, request.config
    )


@router.post("/chat_completions")
async def chat_completions(
    request: ChatRequest, auth: dict = Depends(authenticate_request)
):
    output_log(request, "DEBUG")
    if request.message.strip() == "":
        raise HTTPException(status_code=400, detail="Empty message")
    from handlers.chat_handlers import chat_completions_handler

    result = await chat_completions_handler(
        request.user_name, request.message, request.image, request.config
    )
    return {"response": result}


@router.options("/chat_batch")
async def options_chat_batch():
    return Response(headers={"Allow": "POST, OPTIONS"})


@router.post("/chat_batch")
async def chat_batch(request: ChatRequest, auth: dict = Depends(authenticate_request)):
    output_log(request, "DEBUG")
    if not request.message or all(msg.strip() == "" for msg in request.message):
        raise HTTPException(status_code=400, detail="Empty messages")
    from handlers.chat_handlers import create_batch_response

    return create_batch_response(
        request.user_name, request.message, request.image, request.config
    )
