"""Simulated basic phone: SMS, USSD and voice calls without a carrier.

No message or call ever leaves PeyajFlow. Real alerts become Bangla SMS in
a virtual inbox, and SMS replies, USSD menus and simulated calls drive the
same staging and confirmation as the call simulator (``app.voice``): every
change is read back and needs the account's voice PIN, or the displayed
code for demo accounts. Money is never moved; messages say so.
"""

import os
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    String,
    Table,
    UniqueConstraint,
    Uuid,
    func,
    insert,
    select,
)
from sqlalchemy.orm import Session

from app import intent_model, lots, notifications, trade, voice
from app.auth import Actor, Input, Profile, Role, audit
from app.database import DB, metadata
from app.rate_limits import enforce

router = APIRouter(prefix="/v1/simulator", tags=["Phone simulator"])
USSD_CODE = "*7392#"
HOTLINE = "7392"
DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
BANGLA = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")

messages = Table(
    "sim_messages",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("membership_id", ForeignKey("memberships.id"), nullable=False, index=True),
    Column("direction", String(3), nullable=False),
    Column("body", String(700), nullable=False),
    Column("alert_id", Uuid),
    Column("offer_id", Uuid),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    UniqueConstraint("membership_id", "alert_id", name="uq_sim_message_alert"),
    CheckConstraint("direction IN ('in', 'out')", name="sim_message_direction"),
)

# Spoken or typed changes that a basic phone can make without a form.
PHONE_WRITES = {"accept", "reject", "support", "inspection"}
CALL_MENU = {
    "1": "দর",
    "2": "আমার মজুত",
    "3": "অফার",
    "4": "অর্ডার",
    "5": "পরামর্শ",
    "9": "সহায়তা",
}
GREETING = (
    "পেঁয়াজফ্লোতে স্বাগতম। এটি একটি সিমুলেটেড কল। দর জানতে ১, মজুত ২, অফার ৩, "
    "অর্ডার ৪, পরামর্শ ৫, মানুষের সাথে কথা বলতে ৯ চাপুন। অথবা আপনার কথা বলুন।"
)
ERRORS = {
    "voice_negated": "আপনার কথায় “না” আছে, তাই কিছু করা হয়নি। যা চান সরাসরি বলুন।",
    "voice_ambiguous": "একাধিক কাজ বা পরিমাণ শোনা গেছে। একটি কাজ ও একটি পরিমাণ বলুন।",
    "voice_say_quantity": "পরিমাণের সাথে কেজি বা মণ বলুন।",
    "voice_onion_only": "এই সেবা শুধু পেঁয়াজের জন্য।",
    "voice_unsupported": "এই কাজটি ফোনে করা যায় না। অ্যাপ ব্যবহার করুন।",
    "voice_repeat": "বোঝা যায়নি। আবার বলুন, অথবা সহায়তা লিখুন।",
    "voice_quantity_mismatch": "বলা পরিমাণ অফারের পরিমাণের সাথে মেলেনি।",
    "voice_choose_series": "একাধিক বাজারদর আছে। অ্যাপে একটি বাজার বেছে নিন।",
    "voice_choose_lot": "আগে অ্যাপে একটি মজুত যোগ করুন।",
    "voice_pin_required": "নিশ্চিত করার আগে অ্যাপের বাংলা সহকারী পাতায় ভয়েস পিন ঠিক করুন।",
    "voice_pin_locked": "অনেকবার ভুল পিন। ১৫ মিনিট পরে আবার চেষ্টা করুন।",
    "voice_wrong_digits": "পিন বা কোড ভুল। আবার দিন।",
    "voice_wrong_digits_last": "পিন বা কোড ভুল। আর একবার সুযোগ আছে।",
    "voice_confirmation_cancelled": "তিনবার ভুল হওয়ায় কাজটি বাতিল হয়েছে। কিছু বদলায়নি।",
    "voice_confirmation_expired": "সময় শেষ হয়েছে। কিছু বদলায়নি। আবার শুরু করুন।",
    "voice_pending": "আগের কাজটি আগে নিশ্চিত বা বাতিল করুন।",
    "voice_call_limit": "এই সেশনে অনেক কাজ হয়েছে। একটু পরে আবার চেষ্টা করুন।",
    "invalid_transition": "অফারটি আর সক্রিয় নেই।",
    "insufficient_stock": "মজুতে যথেষ্ট পেঁয়াজ নেই।",
    "rate_limited": "অনেক অনুরোধ এসেছে। একটু পরে আবার চেষ্টা করুন।",
}
DONE = {
    "accept": "অফার গ্রহণ নিশ্চিত হয়েছে। অর্ডার তৈরি হয়েছে।",
    "reject": "অফারটি প্রত্যাখ্যান করা হয়েছে।",
    "support": "সহায়তার অনুরোধ পাঠানো হয়েছে। একজন যোগাযোগ করবেন।",
    "inspection": "পরিদর্শনের অনুরোধ পাঠানো হয়েছে।",
}
STATUS = {
    "order.confirmed": "অর্ডার নিশ্চিত",
    "order.dispatched": "মাল পাঠানো হয়েছে",
    "order.delivered": "মাল পৌঁছেছে",
    "order.cancelled": "অর্ডার বাতিল",
    "order.disputed": "অর্ডারে আপত্তি জানানো হয়েছে",
    "order.expired": "অর্ডারের মেয়াদ শেষ",
    "order.dispute_resolved": "আপত্তির মীমাংসা হয়েছে",
    "offer.rejected": "আপনার অফার প্রত্যাখ্যাত",
    "offer.accepted": "আপনার অফার গৃহীত",
    "offer.expired": "অফারের মেয়াদ শেষ",
    "logistics.requested": "পরিবহনের অনুরোধ এসেছে",
    "logistics.quote_recorded": "পরিবহনের দর পাওয়া গেছে",
    "logistics.booked": "পরিবহন বুক হয়েছে",
    "logistics.cancelled": "পরিবহন বাতিল",
    "payment.reported": "ক্রেতা পেমেন্টের রেফারেন্স দিয়েছেন",
    "payment.verified": "পেমেন্টের প্রমাণ যাচাই হয়েছে",
    "payment.rejected": "পেমেন্টের প্রমাণ গ্রহণ হয়নি",
}


class Text(Input):
    body: Annotated[str, Field(min_length=1, max_length=300)]


class UssdInput(Input):
    text: Annotated[str, Field(max_length=120)] = ""


class Message(BaseModel):
    id: UUID
    direction: Literal["in", "out"]
    body: str
    created_at: datetime


class Thread(BaseModel):
    messages: list[Message]


class Reply(BaseModel):
    text: str
    awaiting: Literal["pin", "code"] | None = None
    demo_code: str | None = None
    end: bool = False


def kg(value: Decimal) -> str:
    return f"{value.normalize():f}".translate(BANGLA)


def taka(value: Decimal) -> str:
    return f"৳{value:,.2f}".rstrip("0").rstrip(".").translate(BANGLA)


def reference(resource_id: UUID) -> str:
    return f"PF-{str(resource_id)[:6].upper()}"


# ----------------------------------------------------------- shared engine
def channel_call(db: Session, actor: Profile) -> UUID:
    """The account's active simulator session, reusing the voice call tables.

    Concurrent messages from one account must share one session, so that
    only one change can wait for confirmation. A transaction-level advisory
    lock per account serializes finding or creating it."""
    db.execute(
        select(func.pg_advisory_xact_lock(actor.membership_id.int & (2**63 - 1)))
    )
    call = db.scalar(
        select(voice.calls.c.id)
        .where(
            voice.calls.c.actor_id == actor.membership_id,
            voice.calls.c.status == "active",
            voice.calls.c.expires_at > trade.now() + timedelta(minutes=2),
        )
        .order_by(voice.calls.c.created_at.desc())
        .limit(1)
    )
    return call or voice.start_call(actor, db).id


def pending_action(db: Session, call_id: UUID):
    return (
        db.execute(
            select(voice.actions)
            .where(
                voice.actions.c.call_id == call_id,
                voice.actions.c.state == "pending",
                voice.actions.c.expires_at > trade.now(),
            )
            .order_by(voice.actions.c.created_at.desc())
            .limit(1)
        )
        .mappings()
        .one_or_none()
    )


def actionable_offers(db: Session, actor: Profile) -> list[trade.OfferView]:
    """Active offers waiting for this account's answer, newest first."""
    if actor.role not in (Role.FARMER, Role.BUYER):
        return []
    return [
        offer
        for offer in trade.list_offers(actor, db)
        if offer.status in trade.ACTIVE_OFFERS
        and offer.proposer_id != actor.membership_id
        and offer.expires_at > trade.now()
    ]


def first_lot(db: Session, actor: Profile) -> UUID | None:
    if actor.role not in (Role.FARMER, Role.AGENT):
        return None
    rows = lots.list_lots(actor, db)
    return rows[0].id if rows else None


def error_text(error: HTTPException) -> str:
    return ERRORS.get(str(error.detail), "কাজটি করা যায়নি। আবার চেষ্টা করুন।")


def confirmation_prompt(actor: Profile, code: str | None) -> Reply:
    if actor.is_demo and code:
        return Reply(
            text=f"নিশ্চিত করতে কোড {code.translate(BANGLA)} লিখে পাঠান। বাতিল করতে 0।",
            awaiting="code",
            demo_code=code,
        )
    return Reply(text="নিশ্চিত করতে আপনার ভয়েস পিন দিন। বাতিল করতে 0।", awaiting="pin")


def stage(
    db: Session, actor: Profile, call_id: UUID, phrase: str, tool: str, params: dict
) -> Reply:
    try:
        turn = voice.intent(
            call_id, voice.Intent(phrase=phrase, params=params, tool=tool), actor, db
        )
    except HTTPException as error:
        db.rollback()
        return Reply(text=error_text(error))
    prompt = confirmation_prompt(actor, turn.demo_code)
    return Reply(
        text=f"{turn.entry.readback_bn} {prompt.text}",
        awaiting=prompt.awaiting,
        demo_code=prompt.demo_code,
    )


def stage_offer(
    db: Session, actor: Profile, call_id: UUID, offer: trade.OfferView, tool: str
) -> Reply:
    phrase = "অফার গ্রহণ" if tool == "accept" else "অফার প্রত্যাখ্যান"
    params = {
        "offer_id": str(offer.id),
        "lot_id": str(offer.lot_id),
        "version": offer.version,
    }
    return stage(db, actor, call_id, phrase, tool, params)


def handle(
    db: Session,
    actor: Profile,
    text: str,
    *,
    channel: Literal["sms", "call"],
    offer_id: UUID | None = None,
) -> Reply:
    """One turn of a basic-phone conversation."""
    text = " ".join(text.translate(DIGITS).split())
    call_id = channel_call(db, actor)
    waiting = pending_action(db, call_id)
    if waiting is not None:
        if text in ("0", "বাতিল", "cancel"):
            voice.cancel_action(call_id, waiting["id"], actor, db)
            return Reply(text="কাজটি বাতিল হয়েছে। কিছু বদলায়নি।")
        if re.fullmatch(r"[0-9]{4,6}", text):
            try:
                entry = voice.confirm(
                    call_id,
                    voice.Confirm(action_id=waiting["id"], digits=text),
                    actor,
                    db,
                )
            except HTTPException as error:
                db.rollback()
                again = str(error.detail) in (
                    "voice_wrong_digits",
                    "voice_wrong_digits_last",
                )
                return Reply(
                    text=error_text(error),
                    awaiting=("code" if actor.is_demo else "pin") if again else None,
                )
            if entry.state == "committed":
                return Reply(text=DONE.get(waiting["tool"], "কাজটি সম্পন্ন হয়েছে।"))
            failure = (entry.result or {}).get("error", "")
            return Reply(text=ERRORS.get(failure, "কাজটি করা যায়নি। কিছু বদলায়নি।"))
        return Reply(
            text="আগের কাজটি নিশ্চিত করতে পিন বা কোড দিন, বাতিল করতে 0।",
            awaiting="code" if actor.is_demo else "pin",
        )

    if channel == "sms" and text in ("1", "2") and offer_id is not None:
        offer = next(
            (o for o in actionable_offers(db, actor) if o.id == offer_id), None
        )
        if offer is None:
            return Reply(text="অফারটি আর সক্রিয় নেই।")
        return stage_offer(
            db, actor, call_id, offer, "accept" if text == "1" else "reject"
        )
    if channel == "call" and text in CALL_MENU:
        text = CALL_MENU[text]

    result = voice.understand(db, actor, text)
    code = voice.error_code(result)
    if code or result.tool is None:
        return Reply(text=ERRORS.get(code or "voice_repeat", ERRORS["voice_repeat"]))
    tool = result.tool
    # A model-understood phrase is replaced by the command it chose, with the
    # quantity the grammar read, so the model is not asked a second time.
    phrase = text
    if result.match == "model":
        phrase = voice.grammar.CANONICAL[tool]
        if result.quantity is not None and result.unit is not None:
            unit = "কেজি" if result.unit == "kg" else "মণ"
            phrase = f"{phrase} {result.quantity} {unit}"
    if tool in voice.READS:
        params = {}
        lot = first_lot(db, actor)
        if tool == "advice":
            if lot is None:
                return Reply(text=ERRORS["voice_choose_lot"])
            params["lot_id"] = str(lot)
        try:
            turn = voice.intent(
                call_id,
                voice.Intent(phrase=phrase, params=params, tool=tool),
                actor,
                db,
            )
        except HTTPException as error:
            db.rollback()
            return Reply(text=error_text(error))
        return Reply(text=turn.entry.readback_bn)
    if tool not in PHONE_WRITES:
        return Reply(
            text="এই কাজের জন্য অনেক তথ্য লাগে। অ্যাপে করুন, অথবা সহায়তা লিখে মাঠকর্মী চান।"
        )
    if tool in ("accept", "reject"):
        offers = actionable_offers(db, actor)
        if not offers:
            return Reply(text="উত্তর দেওয়ার মতো সক্রিয় অফার নেই।")
        params = {
            "offer_id": str(offers[0].id),
            "lot_id": str(offers[0].lot_id),
            "version": offers[0].version,
        }
        return stage(db, actor, call_id, phrase, tool, params)
    note = f"{'কল' if channel == 'call' else 'এসএমএস'} থেকে: {text}"[:500]
    lot = first_lot(db, actor)
    if tool == "inspection" and lot is None:
        return Reply(text=ERRORS["voice_choose_lot"])
    return stage(
        db,
        actor,
        call_id,
        phrase,
        tool,
        {"note": note, "lot_id": str(lot) if lot else None},
    )


# --------------------------------------------------------------------- SMS
def render(db: Session, actor: Profile, alert) -> tuple[str, UUID | None]:
    kind = alert["kind"]
    if alert["resource_type"] == "offer":
        try:
            offer = trade.offer_view(
                trade.scoped_offer(db, actor, alert["resource_id"])
            )
        except HTTPException:
            return "পেঁয়াজফ্লো: একটি অফারে পরিবর্তন হয়েছে। অ্যাপে দেখুন।", None
        deal = (
            f"{offer.lot_label}, {kg(offer.quantity_kg)} কেজি, প্রতি কেজি "
            f"{taka(offer.price_bdt_kg)}, মোট {taka(offer.total_bdt)}। গন্তব্য "
            f"{offer.delivery_district}।"
        )
        waiting = (
            offer.status in trade.ACTIVE_OFFERS
            and offer.proposer_id != actor.membership_id
        )
        if waiting:
            title = "পাল্টা অফার" if offer.status == "countered" else "নতুন অফার"
            who = offer.buyer_name if actor.role == Role.FARMER else offer.seller_name
            return (
                f"পেঁয়াজফ্লো {title}: {who} — {deal} রাজি হলে 1, না হলে 2 লিখে উত্তর দিন।",
                offer.id,
            )
        label = STATUS.get(kind, "অফারে পরিবর্তন")
        return f"পেঁয়াজফ্লো: {label} — {deal}", None
    label = STATUS.get(kind, "আপনার অ্যাকাউন্টে নতুন খবর আছে")
    text = f"পেঁয়াজফ্লো: {label}। রেফ: {reference(alert['resource_id'])}।"
    if kind == "order.confirmed":
        text += " পেমেন্ট প্ল্যাটফর্মের বাইরে হয়; পেঁয়াজফ্লো টাকা পাঠায় না।"
    return text, None


def sync_alerts(db: Session, actor: Profile) -> None:
    """Mirror new in-app alerts as incoming SMS, once each."""
    mirrored = select(messages.c.alert_id).where(
        messages.c.membership_id == actor.membership_id,
        messages.c.alert_id.is_not(None),
    )
    alerts = (
        db.execute(
            select(notifications.notifications)
            .where(
                notifications.notifications.c.recipient_id == actor.membership_id,
                notifications.notifications.c.id.not_in(mirrored),
            )
            .order_by(notifications.notifications.c.created_at)
            .limit(50)
        )
        .mappings()
        .all()
    )
    for alert in alerts:
        body, offer_id = render(db, actor, alert)
        db.execute(
            insert(messages).values(
                membership_id=actor.membership_id,
                direction="in",
                body=body[:700],
                alert_id=alert["id"],
                offer_id=offer_id,
                created_at=alert["created_at"],
            )
        )
    if alerts:
        db.commit()


def thread(db: Session, actor: Profile) -> Thread:
    rows = (
        db.execute(
            select(messages)
            .where(messages.c.membership_id == actor.membership_id)
            .order_by(messages.c.created_at.desc(), messages.c.id.desc())
            .limit(60)
        )
        .mappings()
        .all()
    )
    return Thread(messages=[Message.model_validate(row) for row in reversed(rows)])


def deliver(db: Session, actor: Profile, body: str, offer_id: UUID | None = None):
    db.execute(
        insert(messages).values(
            membership_id=actor.membership_id,
            direction="in",
            body=body[:700],
            offer_id=offer_id,
        )
    )


@router.get("/sms", response_model=Thread)
def sms_inbox(actor: Actor, db: DB):
    voice.gate(actor)
    sync_alerts(db, actor)
    return thread(db, actor)


@router.post("/sms", response_model=Thread)
def sms_reply(body: Text, actor: Actor, db: DB):
    """The phone sends an SMS to PeyajFlow; the reply arrives as SMS."""
    voice.gate(actor)
    enforce(db, "sim-sms", str(actor.membership_id), limit=120, seconds=600)
    sync_alerts(db, actor)
    db.execute(
        insert(messages).values(
            membership_id=actor.membership_id, direction="out", body=body.body
        )
    )
    db.commit()
    latest_offer = db.scalar(
        select(messages.c.offer_id)
        .where(
            messages.c.membership_id == actor.membership_id,
            messages.c.direction == "in",
            messages.c.offer_id.is_not(None),
        )
        .order_by(messages.c.created_at.desc(), messages.c.id.desc())
        .limit(1)
    )
    reply = handle(db, actor, body.body, channel="sms", offer_id=latest_offer)
    deliver(db, actor, f"পেঁয়াজফ্লো: {reply.text}")
    audit(
        db, actor, "simulator.sms", actor.membership_id, awaiting=reply.awaiting or ""
    )
    db.commit()
    return thread(db, actor)


@router.post("/price-alert", response_model=Thread)
def price_alert(actor: Actor, db: DB):
    """The weekly price SMS, composed from the account's real price outlook."""
    voice.gate(actor)
    enforce(db, "sim-alert", str(actor.membership_id), limit=30, seconds=600)
    call_id = channel_call(db, actor)
    parts = []
    lot = first_lot(db, actor)
    for tool, params in (
        ("prices", {}),
        ("advice", {"lot_id": str(lot)} if lot else None),
    ):
        if params is None:
            continue
        try:
            turn = voice.intent(
                call_id,
                voice.Intent(
                    phrase=voice.grammar.CANONICAL[tool], params=params, tool=tool
                ),
                actor,
                db,
            )
            parts.append(turn.entry.readback_bn)
        except HTTPException as error:
            db.rollback()
            parts.append(error_text(error))
    deliver(
        db,
        actor,
        f"পেঁয়াজফ্লো সাপ্তাহিক দর: {' '.join(parts)} বিস্তারিত জানতে {USSD_CODE} ডায়াল করুন।",
    )
    db.commit()
    return thread(db, actor)


@router.post("/test-offer", response_model=Thread)
def test_offer(actor: Actor, db: DB):
    """Demo only: the demo buyer makes an offer on the demo farmer's lot."""
    voice.gate(actor)
    if not actor.is_demo or actor.role != Role.FARMER:
        raise HTTPException(403, "role_forbidden")
    enforce(db, "sim-test-offer", str(actor.membership_id), limit=20, seconds=600)
    from app.seed_showcase import profile

    buyer = profile("buyer")
    listed = [lot for lot in lots.list_lots(actor, db) if lot.listed]
    if not listed:
        raise HTTPException(409, "no_listed_lot")
    lot = listed[0]
    trade.create_offer(
        trade.OfferInput(
            lot_id=lot.id,
            quantity_kg=Decimal(100),
            price_bdt_kg=Decimal("47.50"),
            delivery_district="Dhaka",
            transport="buyer",
            valid_hours=48,
            request_key=uuid4(),
        ),
        buyer,
        db,
    )
    db.commit()
    sync_alerts(db, actor)
    return thread(db, actor)


# -------------------------------------------------------------------- USSD
MENU = "পেঁয়াজফ্লো (সিমুলেশন)\n১ আজকের দর\n২ আমার মজুত\n৩ পরামর্শ\n৪ অফার দেখুন\n৫ অর্ডার\n৬ সহায়তা"
USSD_READS = {"1": "prices", "2": "stock", "3": "advice", "5": "orders"}


def short(text: str, limit: int = 300) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


@router.post("/ussd", response_model=Reply)
def ussd(body: UssdInput, actor: Actor, db: DB):
    """A stateless USSD session: the client sends every input so far,
    joined by '*', as USSD gateways do."""
    voice.gate(actor)
    enforce(db, "sim-ussd", str(actor.membership_id), limit=120, seconds=600)
    path = [part for part in body.text.translate(DIGITS).split("*") if part != ""]
    if not path:
        return Reply(text=MENU)
    choice, rest = path[0], path[1:]
    call_id = channel_call(db, actor)
    if choice in USSD_READS and not rest:
        reply = handle(
            db, actor, voice.grammar.CANONICAL[USSD_READS[choice]], channel="call"
        )
        return Reply(text=short(reply.text), end=True)
    if choice == "4":
        offers = actionable_offers(db, actor)[:5]
        if not offers:
            return Reply(text="উত্তর দেওয়ার মতো সক্রিয় অফার নেই।", end=True)
        if not rest:
            lines = [
                f"{str(i + 1).translate(BANGLA)} {o.lot_label[:14]} {kg(o.quantity_kg)}কেজি "
                f"{taka(o.price_bdt_kg)}"
                for i, o in enumerate(offers)
            ]
            return Reply(text="অফার বেছে নিন:\n" + "\n".join(lines))
        index = int(rest[0]) - 1 if rest[0].isdigit() else -1
        if not 0 <= index < len(offers):
            return Reply(text="ভুল নম্বর।", end=True)
        offer = offers[index]
        if len(rest) == 1:
            return Reply(
                text=(
                    f"{offer.buyer_name}: {kg(offer.quantity_kg)} কেজি × "
                    f"{taka(offer.price_bdt_kg)} = {taka(offer.total_bdt)}\n"
                    "১ গ্রহণ  ২ প্রত্যাখ্যান"
                )
            )
        if rest[1] not in ("1", "2"):
            return Reply(text="ভুল নম্বর।", end=True)
        if len(rest) == 2:
            waiting = pending_action(db, call_id)
            if waiting is not None:
                voice.cancel_action(call_id, waiting["id"], actor, db)
            reply = stage_offer(
                db, actor, call_id, offer, "accept" if rest[1] == "1" else "reject"
            )
            return reply.model_copy(update={"text": short(reply.text)})
        reply = handle(db, actor, rest[2], channel="call")
        return reply.model_copy(
            update={"text": short(reply.text), "end": reply.awaiting is None}
        )
    if choice == "6":
        if not rest:
            waiting = pending_action(db, call_id)
            if waiting is not None:
                voice.cancel_action(call_id, waiting["id"], actor, db)
            reply = handle(db, actor, "সহায়তা", channel="call")
            return reply.model_copy(update={"text": short(reply.text)})
        reply = handle(db, actor, rest[0], channel="call")
        return reply.model_copy(
            update={"text": short(reply.text), "end": reply.awaiting is None}
        )
    return Reply(text="ভুল নম্বর।", end=True)


# ------------------------------------------------------------------- calls
@router.post("/call/start", response_model=Reply)
def call_start(actor: Actor, db: DB):
    voice.gate(actor)
    call_id = channel_call(db, actor)
    waiting = pending_action(db, call_id)
    if waiting is not None:
        voice.cancel_action(call_id, waiting["id"], actor, db)
    audit(db, actor, "simulator.call_started", call_id)
    db.commit()
    return Reply(text=GREETING)


@router.post("/call/turn", response_model=Reply)
def call_turn(body: Text, actor: Actor, db: DB):
    """One spoken or keyed turn on a simulated call."""
    voice.gate(actor)
    enforce(db, "sim-call", str(actor.membership_id), limit=120, seconds=600)
    return handle(db, actor, body.body, channel="call")


# ----------------------------------------------------------- transcription
TRANSCRIBE_MODEL = "gemini-3.5-transcribe"
AUDIO_TYPES = ("audio/webm", "audio/ogg", "audio/mp4", "audio/wav", "audio/mpeg")
MAX_AUDIO_B64 = 1_400_000  # about 1 MB of audio: a minute of compressed speech


class Audio(Input):
    audio: Annotated[str, Field(min_length=16, max_length=MAX_AUDIO_B64)]
    mime: Literal[AUDIO_TYPES]
    # The person agreed that this clip is sent to Google for transcription.
    consent: Literal[True]


class Transcript(BaseModel):
    text: str


def transcription_enabled() -> bool:
    return os.getenv("VOICE_TRANSCRIPTION") == "true" and bool(
        os.getenv("GEMINI_API_KEY")
    )


@router.get("/transcribe", response_model=dict[str, bool])
def transcription_status(actor: Actor):
    voice.gate(actor)
    return {"available": transcription_enabled()}


@router.post("/transcribe", response_model=Transcript)
def transcribe(body: Audio, actor: Actor, db: DB):
    """Bangla speech to text for browsers without built-in speech recognition.
    The clip is sent to Gemini and never stored; the transcript is editable
    and goes through the same grammar and confirmation as typed text."""
    voice.gate(actor)
    if not transcription_enabled():
        raise HTTPException(503, "transcription_unavailable")
    enforce(db, "sim-transcribe", str(actor.membership_id), limit=20, seconds=600)
    if not re.fullmatch(r"[A-Za-z0-9+/]+={0,2}", body.audio):
        raise HTTPException(422, "invalid_input")
    model = os.getenv("GEMINI_TRANSCRIBE_MODEL", TRANSCRIBE_MODEL)
    if not re.fullmatch(r"[a-z0-9.-]{1,64}", model):
        raise HTTPException(503, "transcription_unavailable")
    data = intent_model.post(
        f"{intent_model.GEMINI_ENDPOINT}/{model}:generateContent",
        {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                "Transcribe this speech exactly as spoken. The speaker "
                                "may use Bangla, Banglish or English. Write Bangla in "
                                "Bangla script and keep numbers as spoken. Output only "
                                "the transcript, or nothing if there is no speech."
                            )
                        },
                        {"inlineData": {"mimeType": body.mime, "data": body.audio}},
                    ],
                }
            ],
            "generationConfig": {"temperature": 0, "maxOutputTokens": 300},
        },
        {"x-goog-api-key": os.environ["GEMINI_API_KEY"]},
    )
    try:
        text = data["candidates"][0]["content"]["parts"][0].get("text") or ""
    except (KeyError, IndexError, TypeError):
        raise HTTPException(502, "transcription_failed") from None
    text = " ".join(text.split())[:300]
    audit(db, actor, "simulator.transcribed", actor.membership_id, model=model)
    db.commit()
    if not text:
        raise HTTPException(422, "voice_repeat")
    return Transcript(text=text)
