from fastapi.responses import JSONResponse
from typing import Any


def success_response(data: Any = None, message: str = "Berhasil", status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "message": message,
            "data": data,
        },
    )


def error_response(message: str = "Terjadi kesalahan", status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "data": None,
        },
    )


def paginated_response(data: list, total: int, skip: int, limit: int) -> dict:
    return {
        "success": True,
        "total": total,
        "skip": skip,
        "limit": limit,
        "data": data,
    }
