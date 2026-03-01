from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from models.agent_request import ChatRequest, ChatFeedbackRequest
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


@router.options("/chat_feedback")
async def options_chat_feedback():
    return Response(headers={"Allow": "POST, OPTIONS"})


@router.post("/chat_feedback")
async def chat_feedback(
    request: ChatFeedbackRequest, auth: dict = Depends(authenticate_request)
):
    output_log(request, "DEBUG")

    auth_username = auth.get("username", "")
    request_username = request.user_name or auth_username

    if not request_username:
        raise HTTPException(status_code=400, detail="Missing user_name")

    if auth_username and request_username != auth_username:
        raise HTTPException(status_code=403, detail="Unauthorized user for feedback update")

    from handlers.chat_handlers import update_chat_feedback

    updated = update_chat_feedback(request.chat_id, request_username, request.feedback)
    if not updated:
        raise HTTPException(status_code=404, detail="Chat not found")

    return {
        "message": "Feedback updated successfully",
        "chat_id": request.chat_id,
        "feedback": request.feedback,
    }
