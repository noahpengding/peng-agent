from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from models.agent_request import ChatRequest
from models.agent_response import ChatResponse
from models.rag_requests import RagRequest
from handlers.chat_handlers import chat_handler
from handlers.memory_handlers import get_memory
from handlers.model_handlers import get_model, refresh_models, flip_avaliable, avaliable_models
from handlers.rag_handlers import get_rag, index_all
from utils.log import output_log

app = FastAPI()

# Configure CORS - Update to include all necessary origins
origins = [
    "http://localhost",
    "http://localhost:3000",  # React app
    "http://127.0.0.1:3000",  # React app via IP
    "http://127.0.0.1:5173",  # Vite default
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

@app.get("/")
async def read_root():
    return {"Hello": "World"}

@app.options("/chat")
async def options_chat():
    return Response(headers={
        "Allow": "POST, OPTIONS"
    })

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    output_log(request, "DEBUG")
    if request.message.strip() == "":
        raise HTTPException(status_code=400, detail="Empty message")
    return chat_handler(request.user_name, request.message, request.config)

@app.options("/memory")
async def options_memory():
    return Response(headers={
        "Allow": "GET, OPTIONS"
    })

@app.get("/memory")
async def memory():
    return get_memory()

@app.options("/model")
async def options_model():
    return Response(headers={
        "Allow": "GET, OPTIONS, POST"
    })

@app.get("/model")
async def model():
    return get_model()

@app.post("/model")
async def flip_model(request: dict):
    return flip_avaliable(request["model_name"])

@app.get("/model_refresh")
async def model_refresh():
    return refresh_models()

@app.options("/model_refresh")
async def options_model_refresh():
    return Response(headers={
        "Allow": "POST, OPTIONS"
    })

@app.post("/avaliable_model")
async def avaliable_model(request: dict):
    return avaliable_models(request["type"])

@app.get("/rag")
async def rag():
    return get_rag()

@app.post("/rag")
async def index_file_api(request: RagRequest):
    return index_all(request.user_name, request.file_path, request.collection_name)

@app.options("/rag")
async def options_rag():
    return Response(headers={
        "Allow": "POST, OPTIONS, GET"
    })