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
    # Ensure message is a string for single chat
    if isinstance(request.message, list):
        raise HTTPException(status_code=400, detail="Single chat endpoint expects a string message, not a list")
    if request.message.strip() == "":
        raise HTTPException(status_code=400, detail="Empty message")
    from handlers.chat_handlers import create_streaming_response

    return create_streaming_response(
        request.user_name, request.message, request.knowledge_base, request.image, request.config
    )


@router.post("/chat_completions")
async def chat_completions(
    request: ChatRequest, auth: dict = Depends(authenticate_request)
):
    output_log(request, "DEBUG")
    # Ensure message is a string for single chat
    if isinstance(request.message, list):
        raise HTTPException(status_code=400, detail="Chat completions endpoint expects a string message, not a list")
    if request.message.strip() == "":
        raise HTTPException(status_code=400, detail="Empty message")
    from handlers.chat_handlers import chat_completions_handler

    result = await chat_completions_handler(
        request.user_name, request.message, request.knowledge_base, request.image, request.config
    )
    return {"response": result}


@router.options("/chat_batch")
async def options_chat_batch():
    return Response(headers={"Allow": "POST, OPTIONS"})


@router.post("/chat_batch")
async def chat_batch(request: ChatRequest, auth: dict = Depends(authenticate_request)):
    output_log(request, "DEBUG")
    # Normalize message to a list of strings
    if isinstance(request.message, str):
        messages_list = [request.message]
    else:
        messages_list = request.message or []
    
    if not messages_list or all(msg.strip() == "" for msg in messages_list):
        raise HTTPException(status_code=400, detail="Empty messages")
    from handlers.chat_handlers import create_batch_response

    return create_batch_response(
        request.user_name, messages_list, request.knowledge_base, request.image, request.config
    )
