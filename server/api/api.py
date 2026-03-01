from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config.config import config
import importlib.metadata

# Import routers
from .routers import (
    auth_router,
    chat_router,
    memory_router,
    model_router,
    operator_router,
    rag_router,
    tools_router,
    upload_router,
    user_router,
)

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


# Include routers
app.include_router(auth_router.router, tags=["Authentication"])
app.include_router(chat_router.router, tags=["Chat"])
app.include_router(memory_router.router, tags=["Memory"])
app.include_router(model_router.router, tags=["Model"])
app.include_router(operator_router.router, tags=["Operator"])
app.include_router(rag_router.router, tags=["RAG"])
app.include_router(tools_router.router, tags=["Tools"])
app.include_router(upload_router.router, tags=["Upload"])
app.include_router(user_router.router, tags=["User"])
