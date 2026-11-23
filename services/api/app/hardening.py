import json
import logging
import os
import re
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger("uvicorn.error")


class RequestBodyLimit:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in {"POST", "PATCH", "PUT"}:
            await self.app(scope, receive, send)
            return
        path = scope["path"].rstrip("/")
        limit = (
            12_288
            if path.startswith("/v1/webhooks/")
            else (
                13 * 1024 * 1024
                if path.endswith("/inspections")
                else 16 * 1024
                if path.startswith("/v1/auth/")
                else 2 * 1024 * 1024
            )
        )
        detail = (
            "image_too_large" if path.endswith("/inspections") else "request_too_large"
        )
        length = dict(scope["headers"]).get(b"content-length", b"0")
        if length.isdigit() and (len(length) > 12 or int(length) > limit):
            await JSONResponse({"detail": detail}, status_code=413)(
                scope, receive, send
            )
            return
        received = 0

        async def bounded_receive():
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > limit:
                raise HTTPException(413, detail)
            return message

        await self.app(scope, bounded_receive, send)


def configure(app: FastAPI) -> None:
    app.add_middleware(RequestBodyLimit)

    @app.exception_handler(RequestValidationError)
    async def validation(_request: Request, _error: RequestValidationError):
        return JSONResponse({"detail": "invalid_input"}, status_code=422)

    @app.exception_handler(SQLAlchemyError)
    async def database_error(_request: Request, error: SQLAlchemyError):
        logger.warning("database_request_failed (%s)", type(error).__name__)
        return JSONResponse({"detail": "database_unavailable"}, status_code=503)

    @app.middleware("http")
    async def request_metadata(request: Request, call_next):
        request_id = uuid4().hex
        started = perf_counter()
        try:
            scheme, _, credential = request.headers.get("authorization", "").partition(
                " "
            )
            integration = (
                scheme.casefold() == "bearer"
                and len(credential) == 46
                and credential.startswith("pf_")
            )
            from app.api_tokens import WRITE_ROUTES

            # Public auth/provider endpoints do not depend on Actor. An
            # integration credential must not bypass its scope via those routes.
            allowed_job = request.method == "POST" and any(
                re.fullmatch(pattern, request.url.path.rstrip("/"))
                for pattern in WRITE_ROUTES.values()
            )
            if (
                integration
                and request.method not in {"GET", "HEAD", "OPTIONS"}
                and not allowed_job
            ):
                response = JSONResponse(
                    {"detail": "token_scope_forbidden"}, status_code=403
                )
            else:
                response = await call_next(request)
        except Exception as error:
            logger.error(
                "unexpected_request_failure %s (%s)", request_id, type(error).__name__
            )
            response = JSONResponse({"detail": "service_unavailable"}, status_code=500)
        response.headers["X-Request-ID"] = request_id
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        if os.getenv("APP_ENV") == "production" and (
            response.status_code >= 400 or not request.url.path.startswith("/health/")
        ):
            route = getattr(request.scope.get("route"), "path", "unmatched")
            logger.info(
                json.dumps(
                    {
                        "event": "http_request",
                        "id": request_id,
                        "method": request.method,
                        "route": route,
                        "status": response.status_code,
                        "elapsed_ms": round(1000 * (perf_counter() - started)),
                    }
                )
            )
        return response
