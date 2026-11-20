import os
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from hashlib import sha256
from hmac import compare_digest
from secrets import token_urlsafe
from typing import Annotated, Literal
from uuid import UUID, uuid4, uuid5

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    String,
    Table,
    Uuid,
    delete,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.database import DB, metadata
from app.rate_limits import enforce


class Role(StrEnum):
    FARMER = "farmer"
    BUYER = "buyer"
    AGENT = "agent"
    ADMIN = "admin"


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


ShortText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
VerificationStatus = Literal["pending", "verified", "rejected"]
router = APIRouter(prefix="/v1", tags=["Identity"])
bearer = HTTPBearer(auto_error=False)
TOKEN_TTL = timedelta(hours=8)

users = Table(
    "users",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("name", String(100), nullable=False),
    Column("district", String(100), nullable=False),
    Column("language", String(2), nullable=False),
    Column("demo_key", String(32), unique=True),
    Column("verified", Boolean, nullable=False, default=False),
    Column("nid", String(20), unique=True),
    Column("phone", String(20), unique=True),
    Column("verification_status", String(20), nullable=False, server_default="pending"),
    Column(
        "verified_by",
        Uuid,
        ForeignKey("memberships.id", name="users_verified_by_fkey", use_alter=True),
    ),
    Column("verified_at", DateTime(timezone=True)),
    CheckConstraint(
        "verification_status in ('pending', 'verified', 'rejected')",
        name="user_verification_status",
    ),
)
organizations = Table(
    "organizations",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("name", String(100), nullable=False),
    Column("is_demo", Boolean, nullable=False, default=False),
)
memberships = Table(
    "memberships",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("user_id", ForeignKey("users.id"), nullable=False, index=True),
    Column("organization_id", ForeignKey("organizations.id"), nullable=False),
    Column("role", String(12), nullable=False),
    CheckConstraint(
        "role in ('farmer', 'buyer', 'agent', 'admin')", name="membership_role"
    ),
)
member_accounts = memberships.join(users, memberships.c.user_id == users.c.id).join(
    organizations
)
sessions = Table(
    "sessions",
    metadata,
    Column("token_hash", String(64), primary_key=True),
    Column("membership_id", ForeignKey("memberships.id"), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
)
delegations = Table(
    "delegations",
    metadata,
    Column("farmer_membership_id", ForeignKey("memberships.id"), primary_key=True),
    Column("agent_membership_id", ForeignKey("memberships.id"), primary_key=True),
)
audit_log = Table(
    "audit_log",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("membership_id", ForeignKey("memberships.id"), nullable=False),
    Column("action", String(60), nullable=False),
    Column("resource_id", Uuid, nullable=False, index=True),
    Column("context", JSON, nullable=False, default=dict),
    Column(
        "recorded_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    ),
)


class Profile(BaseModel):
    user_id: UUID
    membership_id: UUID
    organization_id: UUID
    organization: str
    name: str
    district: str
    language: Literal["bn", "en"]
    role: Role
    verified: bool
    is_demo: bool


class VerificationRequest(Input):
    user_id: UUID
    action: Literal["verify", "reject"]
    reason: Annotated[str, StringConstraints(max_length=500)] = ""


class PendingSignup(BaseModel):
    user_id: UUID
    membership_id: UUID
    name: str
    district: str
    role: Role


class ProfileEdit(Input):
    name: ShortText
    district: ShortText
    language: Literal["bn", "en"]


class DemoLogin(Input):
    identity: Annotated[str, StringConstraints(max_length=32)]
    access_key: Annotated[str, StringConstraints(max_length=256)] = ""


class DemoIdentity(BaseModel):
    identity: str
    name: str
    role: Role


class SessionToken(BaseModel):
    token: str
    expires_at: datetime


class DelegationView(BaseModel):
    membership_id: UUID
    name: str
    district: str


def demo_enabled() -> bool:
    return (
        os.getenv("APP_ENV") in {"development", "test"}
        and os.getenv("DEMO_MODE") == "true"
    )


def showcase_access_key() -> str | None:
    key = os.getenv("SHOWCASE_ACCESS_KEY", "")
    return key if os.getenv("APP_ENV") == "production" and len(key) >= 20 else None


DEMO_MEMBERS = {
    "farmer": ("Rahim · Pabna", "Pabna", Role.FARMER, False),
    "farmer-two": ("Salma · Pabna", "Pabna", Role.FARMER, False),
    "buyer": ("Nadia · Dhaka", "Dhaka", Role.BUYER, True),
    "buyer-two": ("Hasan · Dhaka", "Dhaka", Role.BUYER, False),
    "agent": ("Jalil · Pabna", "Pabna", Role.AGENT, True),
    "admin": ("Operations desk", "Dhaka", Role.ADMIN, True),
}
DEMO_NAMESPACE = UUID("15e4a3fb-cb8f-4da0-9b72-686ed8bf45ce")


def demo_id(kind: str, identity: str) -> UUID:
    return uuid5(DEMO_NAMESPACE, f"{kind}:{identity}")


def seed_demo(db: Session) -> None:
    for key, (name, district, role, verified) in DEMO_MEMBERS.items():
        user_id = demo_id("user", key)
        organization_id = demo_id("organization", key)
        db.execute(
            pg_insert(users)
            .values(
                id=user_id,
                name=name,
                district=district,
                language="bn",
                demo_key=key,
                verified=verified,
                verification_status="verified",
            )
            .on_conflict_do_nothing()
        )
        db.execute(
            pg_insert(organizations)
            .values(
                id=organization_id,
                name=name,
                is_demo=True,
            )
            .on_conflict_do_nothing()
        )
        db.execute(
            pg_insert(memberships)
            .values(
                id=demo_id("membership", key),
                user_id=user_id,
                organization_id=organization_id,
                role=role,
            )
            .on_conflict_do_nothing()
        )
    db.execute(
        pg_insert(delegations)
        .values(
            farmer_membership_id=demo_id("membership", "farmer"),
            agent_membership_id=demo_id("membership", "agent"),
        )
        .on_conflict_do_nothing()
    )


def fingerprint(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def actor_for(
    db: DB,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Profile:
    if credentials is None or len(credentials.credentials) != 43:
        raise HTTPException(401, "sign_in_required")
    row = (
        db.execute(
            select(
                users.c.id.label("user_id"),
                memberships.c.id.label("membership_id"),
                organizations.c.id.label("organization_id"),
                organizations.c.name.label("organization"),
                users.c.name,
                users.c.district,
                users.c.language,
                memberships.c.role,
                users.c.verified,
                organizations.c.is_demo,
                users.c.verification_status,
            )
            .select_from(
                sessions.join(
                    member_accounts, sessions.c.membership_id == memberships.c.id
                )
            )
            .where(
                sessions.c.token_hash == fingerprint(credentials.credentials),
                sessions.c.expires_at > func.now(),
            )
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise HTTPException(401, "session_expired")
    if row["is_demo"] and not (demo_enabled() or showcase_access_key()):
        raise HTTPException(401, "session_expired")
    if not row["is_demo"] and row["verification_status"] != "verified":
        raise HTTPException(401, "session_expired")
    if os.getenv("APP_ENV") == "production":
        enforce(db, "member", str(row["membership_id"]), limit=120, seconds=60)
    return Profile.model_validate(row)


Actor = Annotated[Profile, Depends(actor_for)]


def require_role(actor: Profile, *roles: Role) -> None:
    if actor.role not in roles:
        raise HTTPException(403, "role_forbidden")


def verified_agents(is_demo: bool):
    return (
        select(memberships.c.id)
        .select_from(member_accounts)
        .where(
            memberships.c.role == Role.AGENT,
            users.c.verified,
            organizations.c.is_demo == is_demo,
        )
    )


def audit(
    db: Session, actor: Profile | UUID, action: str, resource_id: UUID, **context: str
) -> None:
    db.execute(
        insert(audit_log).values(
            membership_id=actor if isinstance(actor, UUID) else actor.membership_id,
            action=action,
            resource_id=resource_id,
            context=context,
        )
    )


@router.get("/auth/demo", response_model=list[DemoIdentity])
def demo_identities() -> list[DemoIdentity]:
    if not (demo_enabled() or showcase_access_key()):
        raise HTTPException(404, "demo_disabled")
    return [
        DemoIdentity(identity=identity, name=name, role=role)
        for identity, (name, _, role, _) in DEMO_MEMBERS.items()
    ]


@router.post("/auth/demo", response_model=SessionToken, status_code=201)
def demo_login(
    body: DemoLogin, db: DB, request: Request, response: Response
) -> SessionToken:
    access_key = showcase_access_key()
    if not (demo_enabled() or access_key):
        raise HTTPException(404, "demo_disabled")
    if access_key:
        enforce(
            db,
            "showcase-login",
            request.client.host if request.client else "unknown",
            limit=30,
            seconds=60,
        )
        if not compare_digest(body.access_key.encode(), access_key.encode()):
            raise HTTPException(401, "showcase_access_invalid")
    if body.identity not in DEMO_MEMBERS:
        raise HTTPException(422, "unknown_demo_identity")
    member_id = demo_id("membership", body.identity)
    if (
        db.get_bind() is None
        or db.scalar(select(memberships.c.id).where(memberships.c.id == member_id))
        is None
    ):
        raise HTTPException(503, "demo_seed_required")
    return issue_token(db, member_id, response)


def require_signup_reviewer(actor: Profile) -> None:
    require_role(actor, Role.AGENT, Role.ADMIN)
    if actor.is_demo or not actor.verified:
        raise HTTPException(403, "role_forbidden")


def signup_accounts(*columns):
    return (
        select(*columns)
        .select_from(member_accounts)
        .where(
            organizations.c.is_demo.is_(False),
            memberships.c.role.in_((Role.FARMER, Role.BUYER)),
            users.c.nid.is_not(None),
        )
    )


@router.get("/auth/verifications", response_model=list[PendingSignup])
def pending_signups(
    actor: Actor, db: DB, offset: Annotated[int, Query(ge=0, le=10000)] = 0
):
    require_signup_reviewer(actor)
    return (
        db.execute(
            signup_accounts(
                users.c.id.label("user_id"),
                memberships.c.id.label("membership_id"),
                users.c.name,
                users.c.district,
                memberships.c.role,
            )
            .where(users.c.verification_status == "pending")
            .order_by(users.c.name, memberships.c.id)
            .offset(offset)
            .limit(50)
        )
        .mappings()
        .all()
    )


def record_signup_decision(
    db: Session, actor: Profile, user_id: UUID, status: VerificationStatus
) -> None:
    db.execute(
        update(users)
        .where(users.c.id == user_id)
        .values(
            verification_status=status,
            verified=status == "verified",
            verified_by=actor.membership_id,
            verified_at=func.now(),
        )
    )
    if status == "rejected":
        db.execute(
            delete(sessions).where(
                sessions.c.membership_id.in_(
                    select(memberships.c.id).where(memberships.c.user_id == user_id)
                )
            )
        )


@router.post("/auth/verify", status_code=204)
def verify_user(body: VerificationRequest, actor: Actor, db: DB):
    require_signup_reviewer(actor)
    current = db.scalar(
        signup_accounts(users.c.verification_status)
        .where(users.c.id == body.user_id)
        .with_for_update(of=users)
    )
    if current is None:
        raise HTTPException(404, "not_found")
    status = "verified" if body.action == "verify" else "rejected"
    if current == status:
        return
    if current != "pending":
        raise HTTPException(409, "already_processed")
    record_signup_decision(db, actor, body.user_id, status)
    audit(db, actor, f"user.{status}", body.user_id, reason=body.reason)
    db.commit()


def issue_token(db: Session, member_id: UUID, response: Response) -> SessionToken:
    token = token_urlsafe(32)
    expires_at = datetime.now(UTC) + TOKEN_TTL
    db.execute(delete(sessions).where(sessions.c.expires_at <= func.now()))
    db.execute(
        insert(sessions).values(
            token_hash=fingerprint(token),
            membership_id=member_id,
            expires_at=expires_at,
        )
    )
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    return SessionToken(token=token, expires_at=expires_at)


@router.get("/me", response_model=Profile)
def me(actor: Actor) -> Profile:
    return actor


@router.patch("/me", response_model=Profile)
def edit_profile(body: ProfileEdit, actor: Actor, db: DB) -> Profile:
    db.execute(
        update(users).where(users.c.id == actor.user_id).values(**body.model_dump())
    )
    audit(db, actor, "profile.updated", actor.user_id)
    db.commit()
    return actor.model_copy(update=body.model_dump())


@router.get("/delegations", response_model=list[DelegationView])
def list_delegations(
    actor: Actor, db: DB, offset: Annotated[int, Query(ge=0, le=10000)] = 0
):
    require_role(actor, Role.FARMER, Role.AGENT)
    own, partner = delegations.c.farmer_membership_id, delegations.c.agent_membership_id
    if actor.role == Role.AGENT:
        own, partner = partner, own
    return list(
        db.execute(
            select(
                memberships.c.id.label("membership_id"), users.c.name, users.c.district
            )
            .select_from(
                delegations.join(memberships, partner == memberships.c.id)
                .join(users, memberships.c.user_id == users.c.id)
                .join(organizations)
            )
            .where(own == actor.membership_id, organizations.c.is_demo == actor.is_demo)
            .order_by(users.c.name, memberships.c.id)
            .offset(offset)
            .limit(50)
        ).mappings()
    )


@router.put("/delegations/{agent_id}", status_code=204)
def grant_delegation(agent_id: UUID, actor: Actor, db: DB):
    require_role(actor, Role.FARMER)
    eligible = db.scalar(
        verified_agents(actor.is_demo).where(memberships.c.id == agent_id)
    )
    if eligible is None:
        raise HTTPException(404, "verified_agent_not_found")
    created = db.scalar(
        pg_insert(delegations)
        .values(
            farmer_membership_id=actor.membership_id,
            agent_membership_id=agent_id,
        )
        .on_conflict_do_nothing()
        .returning(delegations.c.agent_membership_id)
    )
    if created:
        audit(db, actor, "delegation.granted", agent_id)
    db.commit()


@router.delete("/delegations/{agent_id}", status_code=204)
def revoke_delegation(agent_id: UUID, actor: Actor, db: DB):
    require_role(actor, Role.FARMER)
    revoked = db.scalar(
        delete(delegations)
        .where(
            delegations.c.farmer_membership_id == actor.membership_id,
            delegations.c.agent_membership_id == agent_id,
        )
        .returning(delegations.c.agent_membership_id)
    )
    if revoked:
        audit(db, actor, "delegation.revoked", agent_id)
    db.commit()


@router.delete("/auth/session", status_code=204)
def logout(
    db: DB,
    actor: Actor,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Response:
    assert credentials is not None
    db.execute(
        delete(sessions).where(
            sessions.c.token_hash == fingerprint(credentials.credentials)
        )
    )
    db.commit()
    return Response(status_code=204)
