"""Revocable integration credentials. The API enforces scopes before routing."""

import re
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import Field
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    String,
    Table,
    Uuid,
    func,
    insert,
    select,
    update,
)

from app.auth import Actor, Input, Role, audit, fingerprint
from app.database import DB, metadata
from app.rate_limits import enforce

router = APIRouter(prefix="/v1/integrations/tokens", tags=["Integration tokens"])
tokens = Table(
    "api_tokens",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("membership_id", ForeignKey("memberships.id"), nullable=False, index=True),
    Column("token_hash", String(64), nullable=False, unique=True),
    Column("label", String(80), nullable=False),
    Column("scopes", JSON, nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("revoked_at", DateTime(timezone=True)),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)
# Exact routes, never a broad /v1/* or GET-only bypass. Scope does not grant roles.
READ_ROUTES = {
    "market:read": (r"/v1/market/(series|prices|forecasts)",),
    "lots:read": (r"/v1/lots", r"/v1/lots/[0-9a-f-]{36}(/risk|/recommendation)?"),
    "trade:read": (r"/v1/(offers|orders)",),
    "knowledge:read": (
        r"/v1/knowledge/(answer|sources)",
        r"/v1/knowledge/sources/[a-z0-9-]{1,80}",
    ),
    "operations:read": (r"/v1/admin/(data-quality|overview|disputes)",),
}
WRITE_ROUTES = {
    "automation:run": r"/v1/automation/jobs/(weekly-prices|freshness|alert-routing)",
    "imports:stage": r"/v1/automation/imports",
}


def check_scope(scopes: list[str], request: Request) -> None:
    path = request.url.path.rstrip("/")
    if request.method == "GET" and path == "/v1/me":
        return
    for scope in scopes:
        if request.method == "GET" and any(
            re.fullmatch(pattern, path) for pattern in READ_ROUTES.get(scope, ())
        ):
            return
        if (
            request.method == "POST"
            and scope in WRITE_ROUTES
            and re.fullmatch(WRITE_ROUTES[scope], path)
        ):
            return
    raise HTTPException(403, "token_scope_forbidden")


class TokenInput(Input):
    label: Annotated[str, Field(min_length=1, max_length=80)]
    scopes: Annotated[list[str], Field(min_length=1, max_length=7)]
    days: Annotated[int, Field(ge=1, le=90)] = 30


@router.get("")
def list_tokens(actor: Actor, db: DB):
    return list(
        db.execute(
            select(
                tokens.c.id,
                tokens.c.label,
                tokens.c.scopes,
                tokens.c.expires_at,
                tokens.c.revoked_at,
            )
            .where(tokens.c.membership_id == actor.membership_id)
            .order_by(tokens.c.created_at.desc())
            .limit(100)
        ).mappings()
    )


@router.post("", status_code=201)
def create_token(body: TokenInput, actor: Actor, db: DB, response: Response):
    if not set(body.scopes) <= (READ_ROUTES.keys() | WRITE_ROUTES.keys()):
        raise HTTPException(422, "token_scope_invalid")
    if set(body.scopes) & {"operations:read", *WRITE_ROUTES} and (
        actor.role != Role.ADMIN or not actor.verified
    ):
        raise HTTPException(403, "role_forbidden")
    enforce(db, "token-create", str(actor.membership_id), limit=10, seconds=3600)
    secret = "pf_" + token_urlsafe(32)
    token_id = uuid4()
    expires = datetime.now(UTC) + timedelta(days=body.days)
    db.execute(
        insert(tokens).values(
            id=token_id,
            membership_id=actor.membership_id,
            token_hash=fingerprint(secret),
            label=body.label,
            scopes=sorted(set(body.scopes)),
            expires_at=expires,
        )
    )
    audit(db, actor, "integration.token_created", token_id)
    db.commit()
    response.headers["Cache-Control"] = "private, no-store"
    return {"id": token_id, "token": secret, "expires_at": expires}


@router.delete("/{token_id}", status_code=204)
def revoke_token(token_id: UUID, actor: Actor, db: DB):
    found = db.scalar(
        update(tokens)
        .where(tokens.c.id == token_id, tokens.c.membership_id == actor.membership_id)
        .values(revoked_at=datetime.now(UTC))
        .returning(tokens.c.id)
    )
    if found is None:
        raise HTTPException(404, "token_not_found")
    audit(db, actor, "integration.token_revoked", token_id)
    db.commit()
