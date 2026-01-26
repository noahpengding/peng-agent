from fastapi import APIRouter, Depends
from fastapi.responses import Response
from handlers.auth_handlers import authenticate_request

router = APIRouter()


@router.options("/operator")
async def options_operator():
    return Response(headers={"Allow": "GET, OPTIONS, POST"})


@router.get("/operator")
async def operator(auth: dict = Depends(authenticate_request)):
    from handlers.operator_handlers import get_all_operators

    return get_all_operators()


@router.post("/operator")
async def operator_update(auth: dict = Depends(authenticate_request)):
    from handlers.operator_handlers import update_operator

    update_operator()
    return {"message": "Operator updated successfully"}
