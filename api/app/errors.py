from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = 400
    code = "app_error"

    def __init__(
        self, message: str, status_code: int | None = None, code: str | None = None, retry_after: int | None = None
    ) -> None:
        super().__init__(message)
        self.message = message
        # Seconds until the request may be retried; sent as Retry-After too.
        self.retry_after = retry_after
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationFailedError(AppError):
    status_code = 422
    code = "validation_failed"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        content: dict = {"code": exc.code, "message": exc.message}
        headers = None
        if exc.retry_after is not None:
            content["retry_after"] = exc.retry_after
            headers = {"Retry-After": str(exc.retry_after)}
        return JSONResponse(status_code=exc.status_code, content=content, headers=headers)
