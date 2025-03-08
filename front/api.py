from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from models.agent_request import AgentRequest
from models.agent_response import AgentResponse
from handlers.message_handlers import CreateMessage

app = FastAPI()

@app.get("/")
async def read_root():
    return {"Hello": "World"}

@app.post("/chat", response_model=AgentResponse)
async def chat(request: AgentRequest):
    if request.message.strip() == "":
        raise HTTPException(status_code=400, detail="Empty message")
    
    response = CreateMessage(
        user_name=request.user_name,
        type=request.type,
        operator="openai",
        file_path=request.file_path,
        message=request.message
    )

    return JSONResponse(content={
        "user_name": request.user_name,
        "message": response
    })