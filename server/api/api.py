from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from models.agent_request import ChatRequest
from models.rag_requests import RagRequest
from models.user_models import UserLogin, TokenResponse, UserCreate
from handlers.auth_handlers import authenticate_request
from utils.log import output_log
from config.config import config
import secrets
import importlib.metadata

__version__ = importlib.metadata.version("Peng-Agent")
__author__ = importlib.metadata.metadata("Peng-Agent")["Author-email"]

app = FastAPI(
    title=f"{config.app_name} API",
    root_path="/api",
    version=__version__,
)

origins = [
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST, OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)


@app.get("/")
async def read_root():
    return {
        "message": f"{config.app_name} API",
        "version": __version__,
        "author": __author__,
    }


@app.options("/chat")
async def options_chat():
    return Response(headers={"Allow": "POST, OPTIONS"})


@app.post("/chat")
async def chat(request: ChatRequest, auth: dict = Depends(authenticate_request)):
    output_log(request, "DEBUG")
    if request.message.strip() == "":
        raise HTTPException(status_code=400, detail="Empty message")
    from handlers.chat_handlers import create_streaming_response
    return create_streaming_response(
        request.user_name, request.message, request.image, request.config
    )


@app.post("/chat_completions")
async def chat_completions(
    request: ChatRequest, auth: dict = Depends(authenticate_request)
):
    output_log(request, "DEBUG")
    if request.message.strip() == "":
        raise HTTPException(status_code=400, detail="Empty message")
    from handlers.chat_handlers import create_completion_response
    return await create_completion_response(
        request.user_name, request.message, request.image, request.config
    )


@app.options("/chat_batch")
async def options_chat_batch():
    return Response(headers={"Allow": "POST, OPTIONS"})


@app.post("/chat_batch")
async def chat_batch(request: ChatRequest, auth: dict = Depends(authenticate_request)):
    output_log(request, "DEBUG")
    if not request.message or all(msg.strip() == "" for msg in request.message):
        raise HTTPException(status_code=400, detail="Empty messages")
    from handlers.chat_handlers import create_batch_response
    return create_batch_response(
        request.user_name, request.message, request.image, request.config
    )


@app.options("/memory")
async def options_memory():
    return Response(headers={"Allow": "POST, OPTIONS"})


@app.post("/memory")
async def memory(request: dict, auth: dict = Depends(authenticate_request)):
    from handlers.memory_handlers import get_memory
    return get_memory(request["user_name"])


@app.options("/model")
async def options_model():
    return Response(headers={"Allow": "GET, OPTIONS, POST"})


@app.get("/model")
async def model(auth: dict = Depends(authenticate_request)):
    from handlers.model_handlers import get_model
    return get_model()


@app.options("/operator")
async def options_operator():
    return Response(headers={"Allow": "GET, OPTIONS, POST"})


@app.get("/operator")
async def operator(auth: dict = Depends(authenticate_request)):
    from handlers.operator_handlers import get_all_operators
    return get_all_operators()


@app.post("/operator")
async def operator_update(auth: dict = Depends(authenticate_request)):
    from handlers.operator_handlers import update_operator
    update_operator()
    return {"message": "Operator updated successfully"}


@app.post("/model_avaliable")
async def flip_model(request: dict, auth: dict = Depends(authenticate_request)):
    from handlers.model_handlers import flip_avaliable
    return flip_avaliable(request["model_name"])


@app.post("/model_multimodal")
async def flip_model_multimodal(
    request: dict, auth: dict = Depends(authenticate_request)
):
    from handlers.model_handlers import flip_multimodal
    return flip_multimodal(request["model_name"])


@app.get("/model_refresh")
async def model_refresh(auth: dict = Depends(authenticate_request)):
    from handlers.model_handlers import refresh_models
    return refresh_models()


@app.options("/model_refresh")
async def options_model_refresh(auth: dict = Depends(authenticate_request)):
    return Response(headers={"Allow": "POST, OPTIONS"})


@app.post("/avaliable_model")
async def avaliable_model(request: dict, auth: dict = Depends(authenticate_request)):
    from handlers.model_handlers import avaliable_models
    return avaliable_models(request["type"])


@app.get("/rag")
async def rag(auth: dict = Depends(authenticate_request)):
    from handlers.rag_handlers import get_rag
    return get_rag()


@app.post("/rag")
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


@app.options("/rag")
async def options_rag():
    return Response(headers={"Allow": "POST, OPTIONS, GET"})


@app.options("/login")
async def options_login():
    return Response(headers={"Allow": "POST, OPTIONS"})


# Login with Username and Password
# Mainly used by the web UI
@app.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    from handlers.auth_handlers import authenticate_user, create_access_token
    user = authenticate_user(user_data.username, user_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user["user_name"]}, expiration_days=7
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/signup")
async def signup(user_data: UserCreate):
    
    if user_data.admin_password != config.admin_password:
        raise HTTPException(status_code=401, detail="Incorrect admin password")
    if user_data.username == "":
        raise HTTPException(status_code=422, detail="Empty username")
    if user_data.password == "":
        user_data.password = str(secrets.token_urlsafe(16))
    if user_data.email == "":
        user_data.email = user_data.username + "@example.com"
    if user_data.default_based_model == "":
        user_data.default_based_model = config.default_base_model
    user_data.default_embedding_model = config.embedding_model
    from handlers.auth_handlers import create_user
    response = create_user(user_data)
    if not response:
        raise HTTPException(status_code=400, detail="User Creation Failed")
    return response

@app.options("/tools")
async def options_tools():
    return Response(headers={"Allow": "GET, POST, OPTIONS"})

@app.get("/tools")
async def get_tools(auth: dict = Depends(authenticate_request)):
    from handlers.tool_handlers import get_all_tools
    return get_all_tools()

@app.get("/tool/{tool_name}")
async def get_tool_by_name(tool_name: str, auth: dict = Depends(authenticate_request
)):
    from handlers.tool_handlers import get_tool_by_name
    tool = get_tool_by_name(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool

@app.post("/tools")
async def update_tools(auth: dict = Depends(authenticate_request)):
    from handlers.tool_handlers import update_tools
    update_tools()
    return {"message": "Tools updated successfully"}