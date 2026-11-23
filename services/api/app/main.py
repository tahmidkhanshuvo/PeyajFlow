import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from enum import StrEnum

from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from fastapi import FastAPI, Response
from pydantic import BaseModel
from sqlalchemy import Engine
from sqlalchemy.exc import SQLAlchemyError

from app import (
    admin,
    advice,
    api_tokens,
    auth,
    automation,
    credentials,
    demand,
    documentation,
    forecast,
    hardening,
    inspection,
    integrations,
    knowledge,
    logistics,
    lots,
    market_data,
    notifications,
    operator_agent,
    phone_sim,
    rate_limits,
    risk,
    settlement,
    telephony,
    trade,
    voice,
)
from app.database import alembic_config, database_engine
from app.database import metadata as metadata


class DatabaseStatus(StrEnum):
    READY = "ready"
    UNCONFIGURED = "unconfigured"
    UNREACHABLE = "unreachable"
    MIGRATION_REQUIRED = "migration_required"


class Liveness(BaseModel):
    status: str = "ok"


class Readiness(BaseModel):
    database: DatabaseStatus


def check_database(
    engine: Engine | None, expected_heads: frozenset[str]
) -> DatabaseStatus:
    if engine is None:
        return DatabaseStatus.UNCONFIGURED

    try:
        with engine.connect() as connection:
            current_heads = frozenset(
                MigrationContext.configure(connection).get_current_heads()
            )
    except SQLAlchemyError:
        return DatabaseStatus.UNREACHABLE

    if current_heads != expected_heads:
        return DatabaseStatus.MIGRATION_REQUIRED
    return DatabaseStatus.READY


async def expire_reservations(engine: Engine) -> None:
    while True:
        await asyncio.sleep(20)
        await asyncio.to_thread(trade.sweep_expired, engine)


async def deliver_notifications(engine: Engine) -> None:
    while True:
        await asyncio.sleep(15)
        try:
            await asyncio.to_thread(notifications.process_deliveries, engine)
        except SQLAlchemyError:
            logging.getLogger(__name__).warning("notification_delivery_unavailable")


async def prune_rate_limits(engine: Engine) -> None:
    while True:
        await asyncio.sleep(600)
        try:
            await asyncio.to_thread(rate_limits.prune, engine)
        except SQLAlchemyError:
            logging.getLogger(__name__).warning("rate_limit_cleanup_unavailable")


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    heads = frozenset(ScriptDirectory.from_config(alembic_config()).get_heads())
    if len(heads) != 1:
        raise RuntimeError("PeyajFlow requires exactly one Alembic head")

    engine = database_engine()
    application.state.database_engine = engine
    application.state.docs_statistics = None
    application.state.migration_heads = heads
    workers = (
        [
            asyncio.create_task(task(engine))
            for task in (expire_reservations, deliver_notifications, prune_rate_limits)
        ]
        if engine is not None
        else []
    )
    try:
        yield
    finally:
        for worker in workers:
            worker.cancel()
        for worker in workers:
            with suppress(asyncio.CancelledError):
                await worker
        if engine is not None:
            engine.dispose()


app = FastAPI(title="PeyajFlow API", version="0.1.0", lifespan=lifespan)
hardening.configure(app)
app.include_router(auth.router)
app.include_router(credentials.router)
app.include_router(lots.router)
app.include_router(demand.router)
app.include_router(trade.router)
app.include_router(inspection.router)
app.include_router(risk.router)
app.include_router(market_data.router)
app.include_router(forecast.router)
app.include_router(advice.router)
app.include_router(logistics.router)
app.include_router(voice.router)
app.include_router(phone_sim.router)
app.include_router(telephony.router)
app.include_router(notifications.router)
app.include_router(admin.router)
app.include_router(settlement.router)
app.include_router(documentation.router)
app.include_router(api_tokens.router)
app.include_router(knowledge.router)
app.include_router(automation.router)
app.include_router(operator_agent.router)
app.include_router(integrations.router)


@app.get("/health/live", response_model=Liveness, tags=["Health"])
def live() -> Liveness:
    return Liveness()


@app.get(
    "/health/ready",
    response_model=Readiness,
    responses={
        503: {"model": Readiness, "description": "Database unavailable or out of date"}
    },
    tags=["Health"],
)
def ready(response: Response) -> Readiness:
    database = check_database(app.state.database_engine, app.state.migration_heads)
    if database != DatabaseStatus.READY:
        response.status_code = 503
    return Readiness(database=database)
