from fastapi import APIRouter, Depends, BackgroundTasks
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
async def flip_model(
    request: dict,
    background_tasks: BackgroundTasks,
    auth: dict = Depends(authenticate_request),
):
    from handlers.model_handlers import flip_avaliable, save_models_to_s3

    result = flip_avaliable(request["model_name"])
    background_tasks.add_task(save_models_to_s3)
    return result


@router.post("/model_multimodal")
async def flip_model_multimodal(
    request: dict,
    background_tasks: BackgroundTasks,
    auth: dict = Depends(authenticate_request),
):
    from handlers.model_handlers import flip_multimodal, save_models_to_s3

    result = flip_multimodal(request["model_name"], request["column"])
    background_tasks.add_task(save_models_to_s3)
    return result


@router.post("/model_reasoning_effect")
async def update_model_reasoning_effect(
    request: dict,
    background_tasks: BackgroundTasks,
    auth: dict = Depends(authenticate_request),
):
    from handlers.model_handlers import update_reasoning_effect, save_models_to_s3

    result = update_reasoning_effect(request["model_name"], request["reasoning_effect"])
    background_tasks.add_task(save_models_to_s3)
    return result


@router.get("/model_reasoning_effect")
async def get_model_reasoning_effect(
    model_name: str, auth: dict = Depends(authenticate_request)
):
    from handlers.model_handlers import get_reasoning_effect

    return get_reasoning_effect(model_name)


@router.get("/model_refresh")
async def model_refresh(
    background_tasks: BackgroundTasks,
    auth: dict = Depends(authenticate_request),
):
    from handlers.model_handlers import refresh_models, save_models_to_s3

    result = refresh_models()
    background_tasks.add_task(save_models_to_s3)
    return result


@router.options("/model_refresh")
async def options_model_refresh(auth: dict = Depends(authenticate_request)):
    return Response(headers={"Allow": "POST, OPTIONS"})


@router.post("/avaliable_model")
async def avaliable_model(request: dict, auth: dict = Depends(authenticate_request)):
    from handlers.model_handlers import avaliable_models

    return avaliable_models()

