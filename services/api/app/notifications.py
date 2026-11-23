import base64
import json
import os
import re
from datetime import UTC, datetime, timedelta
from http.client import HTTPException as HttpClientError
from typing import Annotated
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as OutboundRequest
from urllib.request import urlopen
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    UniqueConstraint,
    Uuid,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app import twilio
from app.auth import Actor, Input, Profile, audit, memberships
from app.database import DB, metadata

router = APIRouter(prefix="/v1", tags=["Notifications"])
SMS_PATH = "/v1/webhooks/messaging/twilio"
DHAKA = ZoneInfo("Asia/Dhaka")

contacts = Table(
    "verified_contacts",
    metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("phone_e164", String(16), unique=True, nullable=False),
    Column("verified_at", DateTime(timezone=True), nullable=False),
)
preferences = Table(
    "notification_preferences",
    metadata,
    Column("membership_id", ForeignKey("memberships.id"), primary_key=True),
    Column("sms_enabled", Boolean, nullable=False),
    Column("sms_consented_at", DateTime(timezone=True)),
    Column("quiet_start", Integer, nullable=False),
    Column("quiet_end", Integer, nullable=False),
)
notifications = Table(
    "notifications",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("recipient_id", ForeignKey("memberships.id"), nullable=False, index=True),
    Column("event_key", String(150), nullable=False),
    Column("kind", String(40), nullable=False),
    Column("summary", String(700)),
    Column("resource_type", String(12), nullable=False),
    Column("resource_id", Uuid, nullable=False),
    Column("read_at", DateTime(timezone=True)),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    UniqueConstraint("recipient_id", "event_key", name="uq_notification_event"),
)
deliveries = Table(
    "sms_deliveries",
    metadata,
    Column("notification_id", ForeignKey("notifications.id"), primary_key=True),
    Column("status", String(16), nullable=False),
    Column("attempts", Integer, nullable=False),
    Column("next_at", DateTime(timezone=True), nullable=False, index=True),
    Column("claimed_at", DateTime(timezone=True)),
    Column("provider_reference", String(64), unique=True),
)


class Alert(BaseModel):
    id: UUID
    kind: str
    summary: str | None = None
    resource_type: str
    resource_id: UUID
    created_at: datetime
    read_at: datetime | None


class Inbox(BaseModel):
    items: list[Alert]
    unread: int
    next_offset: int | None


class PreferencesInput(Input):
    sms_enabled: bool
    quiet_start: Annotated[int, Field(ge=0, le=23)] = 22
    quiet_end: Annotated[int, Field(ge=0, le=23)] = 7


class Preferences(PreferencesInput):
    verified_phone: bool
    sms_provider_ready: bool


def utc_now() -> datetime:
    return datetime.now(UTC)


def sms_provider() -> tuple[twilio.Settings, str] | None:
    config = twilio.settings("sms")
    sender = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "")
    if config and re.fullmatch(r"MG[0-9a-fA-F]{32}", sender):
        return config, sender
    return None


def phone_for(db: Session, member_id: UUID):
    return db.scalar(
        select(contacts.c.phone_e164)
        .select_from(
            memberships.join(contacts, memberships.c.user_id == contacts.c.user_id)
        )
        .where(memberships.c.id == member_id)
    )


def publish(
    db: Session,
    recipients,
    kind: str,
    resource_type: str,
    resource_id: UUID,
    version: str = "",
    summary: str | None = None,
):
    for recipient_id in sorted(set(recipients)):
        alert_id = db.scalar(
            pg_insert(notifications)
            .values(
                recipient_id=recipient_id,
                kind=kind,
                summary=summary,
                resource_type=resource_type,
                resource_id=resource_id,
                event_key=f"{kind}:{resource_id}:{version}",
            )
            .on_conflict_do_nothing(constraint="uq_notification_event")
            .returning(notifications.c.id)
        )
        if (
            alert_id
            and sms_provider()
            and db.scalar(
                select(preferences.c.sms_enabled).where(
                    preferences.c.membership_id == recipient_id,
                    preferences.c.sms_consented_at.is_not(None),
                )
            )
            and phone_for(db, recipient_id)
        ):
            db.execute(
                insert(deliveries).values(
                    notification_id=alert_id,
                    status="queued",
                    attempts=0,
                    next_at=utc_now(),
                )
            )


@router.get("/notifications", response_model=Inbox)
def inbox(actor: Actor, db: DB, offset: Annotated[int, Query(ge=0, le=10000)] = 0):
    scope = notifications.c.recipient_id == actor.membership_id
    rows = (
        db.execute(
            select(notifications)
            .where(scope)
            .order_by(notifications.c.created_at.desc(), notifications.c.id.desc())
            .offset(offset)
            .limit(51)
        )
        .mappings()
        .all()
    )
    unread = db.scalar(
        select(func.count())
        .select_from(notifications)
        .where(scope, notifications.c.read_at.is_(None))
    )
    return Inbox(
        items=[Alert.model_validate(row) for row in rows[:50]],
        unread=unread,
        next_offset=offset + 50 if len(rows) > 50 else None,
    )


@router.post("/notifications/read-all", status_code=204)
def mark_all(actor: Actor, db: DB):
    db.execute(
        update(notifications)
        .where(
            notifications.c.recipient_id == actor.membership_id,
            notifications.c.read_at.is_(None),
        )
        .values(read_at=func.now())
    )
    db.commit()


@router.post("/notifications/{alert_id}/read", status_code=204)
def mark_read(alert_id: UUID, actor: Actor, db: DB):
    result = db.scalar(
        update(notifications)
        .where(
            notifications.c.id == alert_id,
            notifications.c.recipient_id == actor.membership_id,
        )
        .values(read_at=func.coalesce(notifications.c.read_at, func.now()))
        .returning(notifications.c.id)
    )
    if result is None:
        raise HTTPException(404, "not_found")
    db.commit()


def preference_view(db: Session, actor: Profile):
    row = (
        db.execute(
            select(preferences).where(
                preferences.c.membership_id == actor.membership_id
            )
        )
        .mappings()
        .one_or_none()
    )
    phone = not actor.is_demo and phone_for(db, actor.membership_id) is not None
    return Preferences(
        sms_enabled=bool(phone and row and row["sms_enabled"]),
        quiet_start=row["quiet_start"] if row else 22,
        quiet_end=row["quiet_end"] if row else 7,
        verified_phone=phone,
        sms_provider_ready=sms_provider() is not None,
    )


@router.get("/notifications/preferences", response_model=Preferences)
def get_preferences(actor: Actor, db: DB):
    return preference_view(db, actor)


@router.put("/notifications/preferences", response_model=Preferences)
def save_preferences(body: PreferencesInput, actor: Actor, db: DB):
    if body.sms_enabled and (actor.is_demo or not phone_for(db, actor.membership_id)):
        raise HTTPException(422, "sms_verified_phone_required")
    values = body.model_dump()
    db.execute(
        pg_insert(preferences)
        .values(
            **values,
            membership_id=actor.membership_id,
            sms_consented_at=utc_now() if body.sms_enabled else None,
        )
        .on_conflict_do_update(
            index_elements=[preferences.c.membership_id],
            set_={
                **values,
                "sms_consented_at": func.coalesce(
                    preferences.c.sms_consented_at, func.now()
                )
                if body.sms_enabled
                else None,
            },
        )
    )
    if not body.sms_enabled:
        cancel_queued(db, [actor.membership_id])
    audit(db, actor, "notifications.preferences", actor.membership_id)
    db.commit()
    return preference_view(db, actor)


def cancel_queued(db: Session, recipients):
    db.execute(
        update(deliveries)
        .where(
            deliveries.c.status == "queued",
            deliveries.c.notification_id.in_(
                select(notifications.c.id).where(
                    notifications.c.recipient_id.in_(recipients)
                ),
            ),
        )
        .values(status="cancelled")
    )


def resume_after(instant: datetime, start: int, end: int) -> datetime:
    local = instant.astimezone(DHAKA)
    hour = local.hour
    quiet = (
        start <= hour < end
        if start < end
        else (start > end and (hour >= start or hour < end))
    )
    if not quiet:
        return instant
    resume = local.replace(hour=end, minute=0, second=0, microsecond=0)
    return (
        resume + (timedelta(days=1) if resume <= local else timedelta(0))
    ).astimezone(UTC)


NOTICE = "PeyajFlow: You have a new workspace notification. Sign in to view it."


def send_sms(
    config: twilio.Settings,
    sender: str,
    phone: str,
    body: str = NOTICE,
    *,
    callback: bool = True,
) -> tuple[str, str | None]:
    fields = {"To": phone, "MessagingServiceSid": sender, "Body": body}
    if callback:
        fields["StatusCallback"] = f"{config.origin}{SMS_PATH}/status"
    authorization = base64.b64encode(
        f"{config.account_sid}:{config.auth_token}".encode()
    ).decode()
    request = OutboundRequest(
        f"https://api.twilio.com/2010-04-01/Accounts/{config.account_sid}/Messages.json",
        urlencode(fields).encode(),
        headers={
            "Authorization": f"Basic {authorization}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=7) as response:
            sid = json.loads(response.read(8192))["sid"]
        if isinstance(sid, str) and re.fullmatch(r"SM[0-9a-fA-F]{32}", sid):
            return "accepted", twilio.fingerprint(sid)
        return "unknown", None
    except HTTPError as error:
        if error.code == 429:
            return "retry", None
        return ("failed" if 400 <= error.code < 500 else "unknown"), None
    except (URLError, TimeoutError, ValueError, KeyError, OSError, HttpClientError):
        # A lost response can hide an accepted send. Preserve it for reconciliation.
        return "unknown", None


def process_deliveries(engine, sender_fn=None, limit=8):
    provider = sms_provider()
    if not provider:
        return
    sender_fn = sender_fn or send_sms
    with Session(engine) as db, db.begin():
        db.execute(
            update(deliveries)
            .where(
                deliveries.c.status == "sending",
                deliveries.c.claimed_at < utc_now() - timedelta(minutes=5),
            )
            .values(status="unknown")
        )
    for _ in range(limit):
        with Session(engine) as db, db.begin():
            instant = utc_now()
            row = (
                db.execute(
                    select(
                        deliveries,
                        notifications.c.recipient_id,
                        notifications.c.summary,
                        notifications.c.kind,
                    )
                    .select_from(deliveries.join(notifications))
                    .where(
                        deliveries.c.status == "queued", deliveries.c.next_at <= instant
                    )
                    .order_by(deliveries.c.next_at, deliveries.c.notification_id)
                    .limit(1)
                    .with_for_update(of=deliveries, skip_locked=True)
                )
                .mappings()
                .one_or_none()
            )
            if row is None:
                return
            key = row["notification_id"]
            current = update(deliveries).where(deliveries.c.notification_id == key)
            pref = (
                db.execute(
                    select(preferences).where(
                        preferences.c.membership_id == row["recipient_id"],
                        preferences.c.sms_enabled,
                        preferences.c.sms_consented_at.is_not(None),
                    )
                )
                .mappings()
                .one_or_none()
            )
            phone = phone_for(db, row["recipient_id"]) if pref else None
            if phone is None:
                db.execute(current.values(status="cancelled"))
                continue
            resume = resume_after(instant, pref["quiet_start"], pref["quiet_end"])
            if resume > instant:
                db.execute(current.values(next_at=resume))
                continue
            attempts = row["attempts"] + 1
            db.execute(
                current.values(status="sending", claimed_at=instant, attempts=attempts)
            )
        if row["kind"] == "market.weekly" and row["summary"]:
            result, ref = sender_fn(*provider, phone, row["summary"])
        else:
            result, ref = sender_fn(*provider, phone)
        with Session(engine) as db, db.begin():
            if result == "retry":
                result = "queued" if attempts < 4 else "failed"
            if ref:
                lock_receipts(db, ref)
                observed = db.scalars(
                    select(twilio.events.c.kind)
                    .where(
                        twilio.events.c.channel == "sms",
                        twilio.events.c.reference == ref,
                    )
                    .order_by(twilio.events.c.received_at.desc())
                ).all()
                for candidate in reversed(observed):
                    if candidate in SMS_STATES and SMS_STATES[
                        candidate
                    ] > SMS_STATES.get(result, 0):
                        result = candidate
            db.execute(
                current.where(deliveries.c.status == "sending").values(
                    status=result,
                    provider_reference=ref,
                    next_at=utc_now() + timedelta(seconds=30 * 2**attempts),
                )
            )


async def verify_sms(request: Request):
    return await twilio.verified_form(request, "sms")


SmsCallback = Annotated[
    tuple[twilio.Settings, dict[str, list[str]]], Depends(verify_sms)
]
SMS_STATES = {"accepted": 1, "sent": 2, "delivered": 3, "failed": 3, "undelivered": 3}


def message_ref(fields):
    sid = twilio.one(fields, "MessageSid")
    if not re.fullmatch(r"SM[0-9a-fA-F]{32}", sid):
        raise HTTPException(400, "provider_callback_invalid")
    return twilio.fingerprint(sid)


def lock_receipts(db: Session, reference: str) -> None:
    # Serialize the outbox update with callbacks arriving before the send response.
    key = int.from_bytes(bytes.fromhex(reference[:16]), "big", signed=True)
    db.execute(select(func.pg_advisory_xact_lock(key)))


@router.post("/webhooks/messaging/twilio/status", status_code=204)
def sms_status(callback: SmsCallback, db: DB):
    _, fields = callback
    reference = message_ref(fields)
    kind = twilio.one(fields, "MessageStatus")
    if kind in SMS_STATES:
        lock_receipts(db, reference)
        first, _ = twilio.record(db, "sms", kind, reference, "state")
        if first:
            predecessors = [
                key for key, rank in SMS_STATES.items() if rank < SMS_STATES[kind]
            ]
            db.execute(
                update(deliveries)
                .where(
                    deliveries.c.provider_reference == reference,
                    deliveries.c.status.in_(predecessors),
                )
                .values(status=kind)
            )
        db.commit()


@router.post("/webhooks/messaging/twilio/opt-out")
def sms_opt_out(callback: SmsCallback, db: DB):
    _, fields = callback
    reference = message_ref(fields)
    if twilio.one(fields, "OptOutType", default="") == "STOP":
        phone = twilio.one(fields, "From")
        if not re.fullmatch(r"\+[1-9][0-9]{7,14}", phone):
            raise HTTPException(400, "provider_callback_invalid")
        first, _ = twilio.record(db, "sms", "opt_out", reference, "stop")
        if first:
            recipients = db.scalars(
                select(memberships.c.id)
                .select_from(
                    memberships.join(
                        contacts, memberships.c.user_id == contacts.c.user_id
                    )
                )
                .where(contacts.c.phone_e164 == phone)
            ).all()
            db.execute(
                update(preferences)
                .where(preferences.c.membership_id.in_(recipients))
                .values(sms_enabled=False, sms_consented_at=None)
            )
            cancel_queued(db, recipients)
        db.commit()
    return Response("<Response />", media_type="application/xml")
