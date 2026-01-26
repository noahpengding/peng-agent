from fastapi import APIRouter, Depends
from fastapi.responses import Response
from handlers.auth_handlers import authenticate_request

router = APIRouter()


@router.options("/model")
async def options_model():
    return Response(headers={"Allow": "GET, OPTIONS, POST"})


@router.get("/model")
async def model(auth: dict = Depends(authenticate_request)):
    from handlers.model_handlers import get_model

    return get_model()


@router.post("/model_avaliable")
async def flip_model(request: dict, auth: dict = Depends(authenticate_request)):
    from handlers.model_handlers import flip_avaliable

    return flip_avaliable(request["model_name"])


@router.post("/model_multimodal")
async def flip_model_multimodal(
    request: dict, auth: dict = Depends(authenticate_request)
):
    from handlers.model_handlers import flip_multimodal

    return flip_multimodal(request["model_name"], request["column"])


@router.post("/model_reasoning_effect")
async def update_model_reasoning_effect(
    request: dict, auth: dict = Depends(authenticate_request)
):
    from handlers.model_handlers import update_reasoning_effect

    return update_reasoning_effect(request["model_name"], request["reasoning_effect"])


@router.get("/model_reasoning_effect")
async def get_model_reasoning_effect(
    model_name: str, auth: dict = Depends(authenticate_request)
):
    from handlers.model_handlers import get_reasoning_effect

    return get_reasoning_effect(model_name)


@router.get("/model_refresh")
async def model_refresh(auth: dict = Depends(authenticate_request)):
    from handlers.model_handlers import refresh_models

    return refresh_models()


@router.options("/model_refresh")
async def options_model_refresh(auth: dict = Depends(authenticate_request)):
    return Response(headers={"Allow": "POST, OPTIONS"})


@router.post("/avaliable_model")
async def avaliable_model(request: dict, auth: dict = Depends(authenticate_request)):
    from handlers.model_handlers import avaliable_models

    return avaliable_models()
