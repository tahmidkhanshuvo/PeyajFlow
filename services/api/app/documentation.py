import re
from datetime import UTC, datetime, timedelta
from threading import Lock
from time import monotonic
from typing import Annotated, Literal
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import (
    AwareDatetime,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)
from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    DateTime,
    Integer,
    String,
    Table,
    distinct,
    func,
    insert,
    select,
    update,
)

from app import intent_model, notifications, twilio
from app.auth import (
    Actor,
    Input,
    Role,
    audit,
    audit_log,
    member_accounts,
    memberships,
    organizations,
    require_role,
    users,
)
from app.database import DB, metadata
from app.docs_seed import STARTER
from app.lots import lots
from app.trade import offers, orders

router = APIRouter(prefix="/v1/docs", tags=["Live documentation"])
RESOURCE = UUID("53d9f804-0072-46fc-a046-f5272ffe4227")
KEY = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9-]{0,47}$")]
TITLE = Annotated[str, StringConstraints(min_length=1, max_length=120)]
Mode = Literal["off", "public", "scheduled"]

settings = Table(
    "documentation_settings",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=False),
    Column("revision", Integer, nullable=False),
    Column("mode", String(12), nullable=False),
    Column("starts_at", DateTime(timezone=True), nullable=False),
    Column("ends_at", DateTime(timezone=True), nullable=False),
    Column("draft", JSON),
    Column("published_version", Integer, nullable=False),
    CheckConstraint("id = 1", name="documentation_singleton"),
    CheckConstraint(
        "mode in ('off', 'public', 'scheduled')", name="documentation_mode"
    ),
    CheckConstraint("starts_at < ends_at", name="documentation_window"),
)
versions = Table(
    "documentation_versions",
    metadata,
    Column("version", Integer, primary_key=True, autoincrement=False),
    Column("document", JSON, nullable=False),
    Column("note", String(240), nullable=False),
    Column(
        "published_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    ),
)


class Block(Input):
    kind: Literal[
        "paragraph", "heading", "bullet", "quote", "node", "upcoming", "planned"
    ]
    text: Annotated[str, StringConstraints(min_length=1, max_length=3000)]

    @model_validator(mode="after")
    def node_size(self):
        if self.kind == "node" and (
            len(self.text) > 38 or len(self.text.splitlines()) != 1
        ):
            raise ValueError(
                "Diagram nodes must be a single line of up to 38 characters"
            )
        return self


class Section(Input):
    key: KEY
    group: Literal["pitch", "engineering"]
    title: TITLE
    blocks: list[Block] = Field(max_length=12)

    @model_validator(mode="after")
    def diagram_size(self):
        if sum(block.kind == "node" for block in self.blocks) > 6:
            raise ValueError("Diagrams support up to six nodes")
        return self


class TeamMember(Input):
    name: TITLE
    role: TITLE
    email: Annotated[
        str,
        StringConstraints(
            max_length=160, pattern=r"^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
        ),
    ]
    photo: Annotated[str, StringConstraints(max_length=1000)] = ""

    @field_validator("photo")
    @classmethod
    def safe_photo(cls, photo: str):
        if not photo:
            return photo
        if any(char.isspace() or ord(char) < 32 for char in photo) or "\\" in photo:
            raise ValueError("Invalid photo URL")
        if re.fullmatch(
            r"/[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:png|jpe?g|webp|avif)",
            photo,
            flags=re.IGNORECASE,
        ):
            return photo
        url = urlsplit(photo)
        if (
            url.scheme == "https"
            and url.hostname
            and not (url.username or url.password)
        ):
            return photo
        raise ValueError("A photo must use HTTPS or a local image path")


class Document(Input):
    title: TITLE
    summary: Annotated[str, StringConstraints(min_length=1, max_length=420)]
    team_name: Annotated[str, StringConstraints(max_length=100)] = ""
    team: list[TeamMember] = Field(max_length=20)
    sections: list[Section] = Field(min_length=1, max_length=36)

    @field_validator("sections")
    @classmethod
    def unique_sections(cls, sections: list[Section]):
        required = {item["key"]: item["group"] for item in STARTER["sections"]}
        if any(
            required.get(section.key, section.group) != section.group
            for section in sections
        ):
            raise ValueError("Required sections must remain in their original group")
        if not required.keys() <= {section.key for section in sections}:
            raise ValueError("Required documentation sections must be present")
        if len({section.key for section in sections}) != len(sections):
            raise ValueError("Section anchors must be unique")
        return sections


class DraftEdit(Input):
    revision: int = Field(ge=0)
    document: Document


class Publish(Input):
    revision: int = Field(ge=0)
    confirm_team_public: bool = False
    note: Annotated[str, StringConstraints(min_length=1, max_length=240)]


class Visibility(Input):
    revision: int = Field(ge=0)
    mode: Mode
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    duration_hours: int | None = Field(default=None, ge=1, le=8760)

    @field_validator("starts_at", "ends_at")
    @classmethod
    def valid_year(cls, value: datetime | None):
        if value is not None and not 1970 <= value.year <= 9998:
            raise ValueError("Schedule is outside the supported date range")
        return value

    @model_validator(mode="after")
    def validate_window(self):
        if self.mode == "scheduled":
            if self.duration_hours is not None:
                if self.ends_at is not None:
                    raise ValueError("Choose a fixed end or a duration")
            elif (
                self.starts_at is None
                or self.ends_at is None
                or self.starts_at >= self.ends_at
            ):
                raise ValueError("Start must precede end")
        return self


def require_docs_admin(actor: Actor):
    require_role(actor, Role.ADMIN)
    if actor.is_demo or not actor.verified:
        raise HTTPException(403, "role_forbidden")


def get_settings(db: DB, revision: int | None = None):
    query = select(settings).where(settings.c.id == 1)
    if revision is not None:
        query = query.with_for_update()
    row = db.execute(query).mappings().one()
    if revision is not None and row["revision"] != revision:
        raise HTTPException(409, "docs_revision_conflict")
    return row


def is_public(row, now: datetime) -> bool:
    return row["mode"] == "public" or (
        row["mode"] == "scheduled" and row["starts_at"] <= now < row["ends_at"]
    )


def public_settings(db: DB):
    row = get_settings(db)
    now = datetime.now(UTC)
    if not is_public(row, now):
        raise HTTPException(403, "docs_unavailable")
    return row, now


def document_at(db: DB, version: int):
    if version == 0:
        return STARTER
    doc = db.scalar(select(versions.c.document).where(versions.c.version == version))
    if doc is None:
        raise HTTPException(404, "not_found")
    return doc


def history(db: DB):
    return [
        dict(row)
        for row in db.execute(
            select(versions.c.version, versions.c.note, versions.c.published_at)
            .order_by(versions.c.version.desc())
            .limit(50)
        ).mappings()
    ]


def operation_list(schema):
    return [
        {
            "path": path,
            "method": method.upper(),
            "summary": operation.get("summary", ""),
            "group": operation.get("tags", ["Other"])[0],
        }
        for path, operations in sorted(schema["paths"].items())
        for method, operation in operations.items()
        if method in {"get", "head", "post", "put", "delete", "patch"}
    ]


def features(schema):
    paths = schema["paths"]
    configured_sms = notifications.sms_provider() is not None
    capabilities = [
        ("stock", "/v1/lots", True),
        ("trade", "/v1/offers", True),
        ("market", "/v1/market/series", True),
        ("inspection", "/v1/lots/{lot_id}/inspections", True),
        ("assistant", "/v1/voice/calls", True),
        ("simulator", "/v1/simulator/sms", True),
        ("model_fallback", "/v1/voice/resolve", intent_model.enabled()),
        ("sms", "/v1/auth/otp", configured_sms),
        (
            "carrier",
            "/v1/webhooks/telephony/twilio",
            twilio.settings("voice") is not None,
        ),
    ]
    return {
        key: "available" if enabled else "configuration_required"
        for key, path, enabled in capabilities
        if path in paths
    }


_stats_lock = Lock()


def statistics(request: Request, db: DB, now: datetime):
    cached = getattr(request.app.state, "docs_statistics", None)
    if cached is not None and monotonic() < cached[0]:
        return cached[1]
    with _stats_lock:
        cached = getattr(request.app.state, "docs_statistics", None)
        if cached is not None and monotonic() < cached[0]:
            return cached[1]
        since = now - timedelta(days=7)
        cohorts = {}
        for name, demo in (("operational", False), ("showcase", True)):
            cohort = organizations.c.is_demo == demo
            cohorts[name] = {
                "verified_users": db.scalar(
                    select(func.count(distinct(users.c.id)))
                    .select_from(member_accounts)
                    .where(cohort, users.c.verification_status == "verified")
                ),
                "lots": db.scalar(
                    select(func.count()).select_from(lots).where(lots.c.is_demo == demo)
                ),
                "orders": db.scalar(
                    select(func.count())
                    .select_from(orders.join(offers))
                    .where(offers.c.is_demo == demo)
                ),
                "activity_7d": db.scalar(
                    select(func.count())
                    .select_from(audit_log.join(memberships).join(organizations))
                    .where(
                        cohort,
                        audit_log.c.recorded_at >= since,
                        ~audit_log.c.action.startswith("docs."),
                    )
                ),
            }
        snapshot = {"sampled_at": now, "cohorts": cohorts}
        request.app.state.docs_statistics = (monotonic() + 15, snapshot)
        return snapshot


@router.get("/public")
def public_document(request: Request, db: DB, known_version: int | None = None):
    row, now = public_settings(db)
    schema = request.app.openapi()
    version = row["published_version"]
    snapshot = {
        "version": version,
        "checked_at": now,
        "closes_at": row["ends_at"] if row["mode"] == "scheduled" else None,
        "statistics": statistics(request, db, now),
        "features": features(schema),
        "api_version": schema["info"]["version"],
        "schema_revision": next(iter(request.app.state.migration_heads)),
    }
    if known_version != version:
        snapshot.update(
            document=document_at(db, version),
            history=history(db),
            operations=operation_list(schema),
        )
    return snapshot


@router.get("/public/openapi", include_in_schema=False)
def public_contract(request: Request, db: DB):
    public_settings(db)
    return request.app.openapi()


def admin_view(db: DB):
    row = get_settings(db)
    return {
        "revision": row["revision"],
        "mode": row["mode"],
        "starts_at": row["starts_at"],
        "ends_at": row["ends_at"],
        "public": is_public(row, datetime.now(UTC)),
        "version": row["published_version"],
        "draft": row["draft"] or document_at(db, row["published_version"]),
        "has_draft": row["draft"] is not None,
        "history": history(db),
    }


@router.get("/admin")
def manage(actor: Actor, db: DB):
    require_docs_admin(actor)
    return admin_view(db)


@router.get("/admin/versions/{version}")
def get_version(version: int, actor: Actor, db: DB):
    require_docs_admin(actor)
    return document_at(db, version)


@router.put("/admin/draft")
def save_draft(body: DraftEdit, actor: Actor, db: DB):
    require_docs_admin(actor)
    row = get_settings(db, body.revision)
    draft = body.document.model_dump()
    if row["draft"] != draft:
        db.execute(
            update(settings)
            .where(settings.c.id == 1)
            .values(draft=draft, revision=body.revision + 1)
        )
        audit(db, actor, "docs.draft_saved", RESOURCE)
    db.commit()
    return admin_view(db)


@router.post("/admin/publish")
def publish(body: Publish, actor: Actor, db: DB):
    require_docs_admin(actor)
    row = get_settings(db, body.revision)
    if row["draft"] is None:
        raise HTTPException(409, "docs_draft_required")
    if row["draft"]["team"] and not body.confirm_team_public:
        raise HTTPException(422, "docs_team_confirmation_required")
    version = row["published_version"] + 1
    db.execute(
        insert(versions).values(version=version, document=row["draft"], note=body.note)
    )
    db.execute(
        update(settings)
        .where(settings.c.id == 1)
        .values(draft=None, published_version=version, revision=body.revision + 1)
    )
    audit(db, actor, "docs.published", RESOURCE, version=str(version))
    db.commit()
    return admin_view(db)


@router.put("/admin/visibility")
def set_visibility(body: Visibility, actor: Actor, db: DB):
    require_docs_admin(actor)
    row = get_settings(db, body.revision)
    start, end = row["starts_at"], row["ends_at"]
    if body.mode == "scheduled":
        start = body.starts_at or datetime.now(UTC)
        end = (
            body.ends_at
            if body.duration_hours is None
            else start + timedelta(hours=body.duration_hours)
        )
    if (body.mode, start, end) != (row["mode"], row["starts_at"], row["ends_at"]):
        db.execute(
            update(settings)
            .where(settings.c.id == 1)
            .values(
                mode=body.mode, starts_at=start, ends_at=end, revision=body.revision + 1
            )
        )
        audit(db, actor, "docs.visibility_changed", RESOURCE, mode=body.mode)
    db.commit()
    return admin_view(db)
