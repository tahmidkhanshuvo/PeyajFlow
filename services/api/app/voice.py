import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Response
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    SecretStr,
    StringConstraints,
    ValidationError,
)
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Uuid,
    func,
    insert,
    or_,
    select,
    update,
)
from sqlalchemy.engine import RowMapping
from sqlalchemy.orm import Session

from app import advice, credentials, logistics, lots, market_data, trade
from app import intent as grammar
from app.auth import (
    Actor,
    Input,
    Profile,
    Role,
    ShortText,
    audit,
    require_role,
)
from app.database import DB, metadata
from app.rate_limits import enforce

router = APIRouter(prefix="/v1/voice", tags=["Bangla call simulator"])
DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

calls = Table(
    "call_sessions",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("actor_id", ForeignKey("memberships.id"), nullable=False, index=True),
    Column("status", String(12), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)
actions = Table(
    "assistant_actions",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("call_id", ForeignKey("call_sessions.id"), nullable=False, index=True),
    Column("tool", String(32), nullable=False),
    Column("state", String(12), nullable=False),
    Column("readback_bn", String(2000), nullable=False),
    Column("arguments", JSON, nullable=False, default=dict),
    Column("result", JSON),
    Column("code_hash", String(64)),
    Column("attempts", Integer, nullable=False, default=0),
    Column("expires_at", DateTime(timezone=True)),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)
# A personal PIN confirms changes for real accounts. Unlike the per-action
# code shown to demo accounts, it is never displayed, so a confirmation
# proves knowledge of a secret the account holder chose.
voice_pins = Table(
    "voice_pins",
    metadata,
    Column("membership_id", ForeignKey("memberships.id"), primary_key=True),
    Column("pin_digest", String(97), nullable=False),
    Column("failures", Integer, nullable=False, default=0),
    Column("locked_until", DateTime(timezone=True)),
    Column(
        "updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    CheckConstraint("failures >= 0", name="voice_pin_failures"),
)
PIN_FAILURES = 5
PIN_LOCK = timedelta(minutes=15)
tasks = Table(
    "assistant_tasks",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("actor_id", ForeignKey("memberships.id"), nullable=False),
    Column("lot_id", ForeignKey("lots.id")),
    Column("is_demo", Boolean, nullable=False),
    Column("kind", String(20), nullable=False),
    Column("note", String(200), nullable=False),
    Column("status", String(12), nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)


Tool = Literal[grammar.TOOLS]


class Intent(Input):
    phrase: ShortText
    params: dict = Field(default_factory=dict, max_length=20)
    # The command the user picked in the form. When present it must agree with
    # the phrase, so form fields and spoken words cannot describe two actions.
    tool: Tool | None = None


class ResolveInput(Input):
    phrases: Annotated[list[ShortText], Field(min_length=1, max_length=3)]


class Resolution(BaseModel):
    phrase: str
    status: Literal["resolved", "ambiguous", "negated", "unknown"]
    tool: str | None
    quantity: Decimal | None
    unit: Literal["kg", "maund"] | None
    match: Literal["exact", "pattern"] | None
    candidates: list[str]
    error: str | None
    loss: bool = False


class Lookup(Input):
    lot_id: UUID | None = None
    series: Annotated[str, Field(pattern="^[0-9a-f]{64}$")] | None = None


class OfferAction(Input):
    offer_id: UUID
    lot_id: UUID
    version: Annotated[int, Field(ge=1)]
    quantity_kg: lots.PositiveKg | None = None
    price_bdt_kg: lots.BDT | None = None


class MovementAction(lots.Movement):
    lot_id: UUID


class TaskInput(Input):
    lot_id: UUID | None = None
    note: Annotated[str, Field(min_length=1, max_length=200)]


class AssistanceInput(TaskInput):
    kind: Literal["inspection", "support"]


class Confirm(Input):
    action_id: UUID
    digits: Annotated[str, Field(min_length=4, max_length=6)]


class PinInput(Input):
    # Passphrases may begin or end with spaces, as at sign-in.
    model_config = ConfigDict(str_strip_whitespace=False)

    pin: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=4, max_length=6)
    ]
    password: Annotated[SecretStr, Field(min_length=1, max_length=256)]


class PinStatus(BaseModel):
    required: bool
    set: bool
    locked_until: datetime | None = None


class Entry(BaseModel):
    id: UUID
    tool: str
    state: str
    readback_bn: str
    result: dict | None = None
    expires_at: datetime | None


class Turn(BaseModel):
    entry: Entry
    demo_code: str | None = None


class Call(BaseModel):
    id: UUID
    status: str
    expires_at: datetime
    entries: list[Entry]
    mode: Literal["simulation"] = "simulation"


class Task(BaseModel):
    id: UUID
    kind: str
    lot_id: UUID | None
    note: str
    status: str
    created_at: datetime
    can_resolve: bool


READS = set(grammar.READS)
RESPONSES = {"accept", "reject", "counter"}
ERRORS = {
    "negated": "voice_negated",
    "ambiguous": "voice_ambiguous",
    "unit_missing": "voice_say_quantity",
    "number_words": "voice_say_quantity",
    "invalid_quantity": "voice_say_quantity",
    "unsupported_product": "voice_onion_only",
    "unsupported_action": "voice_unsupported",
}


def error_code(result: grammar.Interpretation) -> str | None:
    if result.status == "resolved":
        return None
    if result.status == "ambiguous":
        return "voice_ambiguous"
    return ERRORS.get(result.reason or "", "voice_repeat")


def resolve(phrase: str) -> tuple[str, tuple[Decimal, str] | None]:
    return accepted(grammar.interpret(phrase))


def accepted(
    result: grammar.Interpretation,
) -> tuple[str, tuple[Decimal, str] | None]:
    code = error_code(result)
    if code or result.tool is None:
        raise HTTPException(422, code or "voice_repeat")
    spoken = (
        (result.quantity, result.unit)
        if result.quantity is not None and result.unit is not None
        else None
    )
    return result.tool, spoken


def lot_conversion(db: Session, lot_id: UUID) -> Decimal | None:
    return db.scalar(
        select(lots.lot_events.c.kg_per_maund)
        .where(
            lots.lot_events.c.lot_id == lot_id,
            lots.lot_events.c.kg_per_maund.is_not(None),
        )
        .order_by(lots.lot_events.c.recorded_at.desc(), lots.lot_events.c.id)
        .limit(1)
    )


def check_spoken(
    spoken: tuple[Decimal, str] | None, kg: Decimal, conversion: Decimal | None
) -> None:
    """Reject a spoken quantity that differs from the quantity in the form."""
    if spoken is None:
        return
    amount, unit = spoken
    said = lots.kilograms(amount, unit, conversion if unit == "maund" else None)
    if said != abs(kg):
        raise HTTPException(409, "voice_quantity_mismatch")


def gate(actor: Profile) -> None:
    if actor.is_demo:
        return
    require_role(actor, Role.FARMER, Role.BUYER)
    if not actor.verified:
        raise HTTPException(403, "role_forbidden")


def call_for(db: Session, actor: Profile, call_id: UUID, *, lock=False):
    gate(actor)
    stmt = select(calls).where(
        calls.c.id == call_id, calls.c.actor_id == actor.membership_id
    )
    row = db.execute(stmt.with_for_update() if lock else stmt).mappings().one_or_none()
    if row is None:
        raise HTTPException(404, "not_found")
    return row


def active(call) -> bool:
    return call["status"] == "active" and call["expires_at"] > trade.now()


def entry_view(row) -> Entry:
    state = row["state"]
    if state == "pending" and row["expires_at"] <= trade.now():
        state = "expired"
    return Entry.model_validate({**row, "state": state})


def code_hash(action_id: UUID, code: str) -> str:
    return hashlib.sha256(f"{action_id}:{code}".encode()).hexdigest()


def weak_pin(pin: str) -> bool:
    """Refuse PINs that are easy to guess: one digit, a run or a repeat."""
    if len(set(pin)) == 1:
        return True
    steps = {int(b) - int(a) for a, b in zip(pin, pin[1:], strict=False)}
    if steps in ({1}, {-1}):
        return True
    return pin == (pin[:2] * 3)[: len(pin)] or pin == (pin[:3] * 2)[: len(pin)]


def kdf_matches(secret: str, digest: str) -> bool:
    salt, expected = digest.split(":")
    if not credentials.KDF_SLOTS.acquire(blocking=False):
        raise HTTPException(429, "rate_limited", headers={"Retry-After": "2"})
    try:
        actual = credentials.derive(secret, bytes.fromhex(salt)).hex()
    finally:
        credentials.KDF_SLOTS.release()
    return hmac.compare_digest(actual, expected)


def pin_row(db: Session, actor: Profile, *, lock=False):
    stmt = select(voice_pins).where(voice_pins.c.membership_id == actor.membership_id)
    return db.execute(stmt.with_for_update() if lock else stmt).mappings().one_or_none()


def require_pin(db: Session, actor: Profile) -> None:
    """Real accounts confirm with their own PIN, so they must have one."""
    if actor.is_demo:
        return
    row = pin_row(db, actor)
    if row is None:
        raise HTTPException(409, "voice_pin_required")
    if row["locked_until"] and row["locked_until"] > trade.now():
        raise HTTPException(409, "voice_pin_locked")


@router.get("/pin", response_model=PinStatus)
def pin_status(actor: Actor, db: DB):
    gate(actor)
    if actor.is_demo:
        return PinStatus(required=False, set=False)
    row = pin_row(db, actor)
    locked = row["locked_until"] if row else None
    return PinStatus(
        required=True,
        set=row is not None,
        locked_until=locked if locked and locked > trade.now() else None,
    )


@router.put("/pin", status_code=204)
def set_pin(body: PinInput, actor: Actor, db: DB):
    """Set or change the voice PIN after re-entering the account passphrase."""
    gate(actor)
    if actor.is_demo:
        raise HTTPException(409, "voice_pin_demo")
    pin = body.pin.translate(DIGITS)
    if not re.fullmatch("[0-9]{4,6}", pin):
        raise HTTPException(422, "voice_pin_invalid")
    if weak_pin(pin):
        raise HTTPException(422, "voice_pin_weak")
    # Limits passphrase guessing; format mistakes above are not counted.
    enforce(db, "voice-pin-set", str(actor.membership_id), limit=5, seconds=900)
    digest = db.scalar(
        select(credentials.credentials.c.password_digest).where(
            credentials.credentials.c.membership_id == actor.membership_id
        )
    )
    if digest is None:
        raise HTTPException(403, "role_forbidden")
    if not kdf_matches(body.password.get_secret_value(), digest):
        raise HTTPException(401, "credentials_invalid")
    salt = secrets.token_bytes(16)
    with credentials.KDF_SLOTS:
        pin_digest = f"{salt.hex()}:{credentials.derive(pin, salt).hex()}"
    values = {"pin_digest": pin_digest, "failures": 0, "locked_until": None}
    if pin_row(db, actor, lock=True) is None:
        db.execute(
            insert(voice_pins).values(membership_id=actor.membership_id, **values)
        )
    else:
        db.execute(
            update(voice_pins)
            .where(voice_pins.c.membership_id == actor.membership_id)
            .values(**values, updated_at=func.now())
        )
    audit(db, actor, "voice.pin_set", actor.membership_id)
    db.commit()
    return Response(status_code=204)


def read_tool(db: Session, actor: Profile, tool: str, body: Lookup) -> str:
    if tool == "prices":
        series = body.series
        if series is None:
            available = db.scalars(
                select(market_data.prices.c.series)
                .where(market_data.approved(actor))
                .distinct()
                .limit(2)
            ).all()
            if len(available) > 1:
                raise HTTPException(422, "voice_choose_series")
            series = available[0] if available else None
        rows = market_data.list_prices(actor, db, series, 1)
        if not rows:
            return "অনুমোদিত বাজারদর পাওয়া যায়নি।"
        row = rows[0]
        kind = {"farmgate": "খামারদর", "wholesale": "পাইকারি", "retail": "খুচরা"}[
            row.price_type
        ]
        label = ("কাল্পনিক নমুনা। " if row.synthetic else "") + (
            "পুরোনো দর। " if row.stale else ""
        )
        return f"{label}{row.market}, {kind}, {row.observed_on}: প্রতি কেজি {row.low_bdt_kg:.2f} থেকে {row.high_bdt_kg:.2f} টাকা।"
    if tool == "stock":
        rows = (
            [lots.view(lots.get_lot(db, actor, body.lot_id))]
            if body.lot_id
            else lots.list_lots(actor, db)[:5]
        )
        return (
            " ".join(f"{row.label}: খালি {row.sellable_kg:.3f} কেজি।" for row in rows)
            or "মজুত পাওয়া যায়নি।"
        )
    if tool == "advice":
        if body.lot_id is None:
            raise HTTPException(422, "voice_choose_lot")
        result = advice.evaluate(
            db,
            actor,
            body.lot_id,
            advice.AdviceInput(series=body.series, use_loss_model=True),
        )
        labels = {
            "SELL": "বিক্রি",
            "HOLD": "অপেক্ষা",
            "SELL_PART": "আংশিক বিক্রি",
            "INSUFFICIENT_DATA": "তথ্য অপর্যাপ্ত",
        }
        reasons = {
            "missing_current_price": "এখনকার দর পাওয়া যায়নি।",
            "missing_future_range": "ভবিষ্যৎ দরের পরিসর পাওয়া যায়নি।",
            "synthetic_series": "এটি কাল্পনিক দরধারা।",
            "review_storage_condition": "সংরক্ষণের অবস্থা যাচাই করুন।",
        }
        notes = " ".join(reasons[key] for key in result.reasons if key in reasons)
        if result.sell_now_net_bdt is not None and result.hold_low_bdt is not None:
            basis = (
                f"খরচ শূন্য এবং যাচাই করা ওজনের প্রবণতা থেকে আনুমানিক "
                f"{result.loss_pct:.2f}% ওজন ক্ষতি ধরে তুলনা"
                if result.loss_source == "experimental_model"
                else "খরচ ও ওজন ক্ষতি শূন্য ধরে তুলনা; ওজনের যথেষ্ট যাচাই নেই"
            )
            notes += (
                f" {basis}: এখন {result.sell_now_net_bdt:.2f} টাকা, "
                f"অপেক্ষায় {result.hold_low_bdt:.2f} থেকে {result.hold_high_bdt:.2f} টাকা।"
            )
        return f"পরামর্শ: {labels[result.recommendation]}। {notes} খরচ ও ক্ষতি ওয়ার্কস্পেসে লিখে তুলনা করুন।"
    if tool == "offers":
        rows = [
            item
            for item in trade.list_offers(actor, db)
            if body.lot_id is None or item.lot_id == body.lot_id
        ]
        if body.lot_id is not None and actor.role == Role.FARMER:
            lots.get_lot(db, actor, body.lot_id)
        return (
            " ".join(
                f"{row.lot_label}: {row.quantity_kg:.3f} কেজি, প্রতি কেজি {row.price_bdt_kg:.2f} টাকা।"
                for row in rows[:5]
                if row.status in trade.ACTIVE_OFFERS
            )
            or "সক্রিয় অফার পাওয়া যায়নি।"
        )
    rows = [
        item
        for item in trade.list_orders(actor, db)
        if body.lot_id is None or item.offer.lot_id == body.lot_id
    ]
    labels = {
        "confirmed": "নিশ্চিত",
        "dispatched": "পাঠানো হয়েছে",
        "delivered": "পৌঁছেছে",
        "cancelled": "বাতিল",
        "expired": "মেয়াদ শেষ",
        "disputed": "বিরোধ আছে",
    }
    return (
        " ".join(
            f"{row.offer.lot_label}: {labels.get(row.status, row.status)}।"
            for row in rows[:5]
        )
        or "অর্ডার পাওয়া যায়নি।"
    )


def prepare(
    db: Session,
    actor: Profile,
    tool: str,
    params: dict,
    action_id: UUID,
    spoken: tuple[Decimal, str] | None = None,
    loss: bool = False,
) -> tuple[dict, str]:
    if tool in RESPONSES:
        require_role(actor, Role.FARMER, Role.BUYER)
        body = OfferAction.model_validate(params)
        offer = trade.scoped_offer(db, actor, body.offer_id)
        if offer["lot_id"] != body.lot_id:
            raise HTTPException(409, "voice_wrong_lot")
        if (
            offer["status"] not in trade.ACTIVE_OFFERS
            or trade.offer_expired(offer)
            or body.version != offer["version"]
            or offer["proposer_id"] == actor.membership_id
        ):
            raise HTTPException(409, "invalid_transition")
        response = trade.OfferReply(
            action=tool,
            version=body.version,
            request_key=action_id,
            confirm=True,
            quantity_kg=body.quantity_kg,
            price_bdt_kg=body.price_bdt_kg,
        )
        quantity, price = (
            body.quantity_kg or offer["quantity_kg"],
            body.price_bdt_kg or offer["price_bdt_kg"],
        )
        conversion = lot_conversion(db, body.lot_id)
        check_spoken(spoken, quantity, conversion)
        maunds = (
            f" (প্রায় {quantity / conversion:.3f} মণ, প্রতি মণে {conversion:.3f} কেজি)"
            if conversion
            else ""
        )
        if tool != "reject":
            trade.check_lot(offer, trade.lock_lot(db, body.lot_id), quantity)
        transport = "ক্রেতা" if offer["transport"] == "buyer" else "বিক্রেতা"
        action = {"accept": "গ্রহণ", "counter": "পাল্টা অফার", "reject": "প্রত্যাখ্যান"}[tool]
        readback = (
            f"{action}: {offer['lot_label']}, গ্রেড {offer['grade']}। ক্রেতা {offer['buyer_name']}, "
            f"বিক্রেতা {offer['seller_name']}। {quantity:.3f} কেজি{maunds}, প্রতি কেজি {price:.2f} টাকা, "
            f"পণ্যের মোট {advice.bdt(quantity * price):.2f} টাকা। গন্তব্য {offer['delivery_district']}। "
            f"পরিবহনের দায়িত্ব {transport}। সরবরাহের সময় "
            f"{offer['delivery_from'] or 'আলোচনা সাপেক্ষ'}"
            f"{' থেকে ' + str(offer['delivery_to']) if offer['delivery_to'] and offer['delivery_to'] != offer['delivery_from'] else ''}। "
            "পরিবহন ও অন্যান্য খরচ আলাদাভাবে যাচাই করুন।"
        )
        return {
            "offer_id": str(body.offer_id),
            "reply": response.model_dump(mode="json"),
        }, readback
    if tool == "movement":
        require_role(actor, Role.FARMER, Role.AGENT)
        movement = MovementAction.model_validate({**params, "request_key": action_id})
        if loss and movement.event_type != "LOSS_REPORTED":
            # "৫ কেজি পচে গেছে" must never be staged as stock being added.
            raise HTTPException(422, "voice_loss_mismatch")
        lot = lots.get_lot(db, actor, movement.lot_id)
        kg = lots.kilograms(movement.quantity, movement.unit, movement.kg_per_maund)
        check_spoken(
            spoken,
            kg,
            movement.kg_per_maund or lot_conversion(db, movement.lot_id),
        )
        if (
            not kg
            or (movement.event_type == "LOSS_REPORTED" and kg >= 0)
            or not lot["reserved_kg"] <= lot["available_kg"] + kg <= lots.MAX_KG
        ):
            raise HTTPException(422, "invalid_quantity")
        return movement.model_dump(
            mode="json"
        ), f"{lot['label']} মজুতের পরিবর্তন {kg:.3f} কেজি।"
    if tool == "register":
        require_role(actor, Role.FARMER)
        registration = lots.LotCreate.model_validate(
            {**params, "request_key": action_id}
        )
        kg = lots.kilograms(
            registration.quantity, registration.unit, registration.kg_per_maund
        )
        check_spoken(spoken, kg, registration.kg_per_maund)
        return (
            registration.model_dump(mode="json"),
            f"{registration.label}, {registration.district}, {registration.variety}, {kg:.3f} কেজি নিবন্ধন।",
        )
    if tool == "send_offer":
        require_role(actor, Role.BUYER)
        offer = trade.OfferInput.model_validate({**params, "request_key": action_id})
        candidate = (
            db.execute(
                select(lots.lots).where(
                    lots.lots.c.id == offer.lot_id,
                    trade.listed_lot_filter(actor),
                )
            )
            .mappings()
            .one_or_none()
        )
        if candidate is None:
            raise HTTPException(404, "not_found")
        trade.check_lot(candidate, candidate, offer.quantity_kg)
        check_spoken(spoken, offer.quantity_kg, lot_conversion(db, offer.lot_id))
        gross = advice.bdt(offer.quantity_kg * offer.price_bdt_kg)
        return offer.model_dump(mode="json"), (
            f"{candidate['variety']}, {candidate['district']} মজুতের জন্য {offer.quantity_kg:.3f} কেজি, "
            f"প্রতি কেজি {offer.price_bdt_kg:.2f} টাকা, মোট {gross:.2f} টাকা। "
            f"গন্তব্য {offer.delivery_district}। পরিবহনের দায়িত্ব {'ক্রেতা' if offer.transport == 'buyer' else 'বিক্রেতা'}।"
        )
    if tool == "transport":
        body = logistics.RequestInput.model_validate(
            {**params, "request_key": action_id}
        )
        order, offer = trade.order_rows(db, actor, body.order_id)
        logistics.require_responsible(actor, offer)
        if not logistics.confirmed(order):
            raise HTTPException(409, "invalid_transition")
        logistics.eligible_pickup(body.pickup_on, order, offer)
        return (
            body.model_dump(mode="json"),
            f"{offer['lot_label']}, {offer['quantity_kg']:.3f} কেজি, {offer['delivery_district']}, সংগ্রহ {body.pickup_on}। পরিবহনের দর চাই।",
        )
    body = TaskInput.model_validate(params)
    if tool == "inspection" and body.lot_id is None:
        raise HTTPException(422, "voice_choose_lot")
    if body.lot_id:
        lot = lots.get_lot(db, actor, body.lot_id)
        label = f"{lot['label']}। "
    else:
        label = ""
    return body.model_dump(mode="json"), label + (
        "পরিদর্শনের অনুরোধ নথিভুক্ত হবে।"
        if tool == "inspection"
        else "সহায়তার অনুরোধ নথিভুক্ত হবে।"
    )


def execute(db: Session, actor: Profile, tool: str, args: dict) -> dict:
    if tool in RESPONSES:
        result = trade.respond_to_offer(
            UUID(args["offer_id"]),
            trade.OfferReply.model_validate(args["reply"]),
            actor,
            db,
        )
        return result.model_dump(mode="json")
    if tool == "movement":
        body = MovementAction.model_validate(args)
        result = lots.apply_movement(
            body.lot_id,
            lots.Movement.model_validate(body.model_dump(exclude={"lot_id"})),
            actor,
            db,
        )
        return {"lot_id": str(result.id), "status": "recorded"}
    if tool == "register":
        result = lots.register_lot(lots.LotCreate.model_validate(args), actor, db)
        return {"lot_id": str(result.id), "status": "registered"}
    if tool == "send_offer":
        result = trade.send_offer(trade.OfferInput.model_validate(args), actor, db)
        return {"offer_id": str(result.id), "status": result.status}
    if tool == "transport":
        body = logistics.RequestInput.model_validate(args)
        result = logistics.request_transport(body, actor, db)
        return {
            "id": str(result.id),
            "order_id": str(body.order_id),
            "status": result.status,
        }
    body = TaskInput.model_validate(args)
    task_id = queue_task(db, actor, tool, body)
    return {"task_id": str(task_id), "status": "queued"}


def queue_task(db: Session, actor: Profile, kind: str, body: TaskInput) -> UUID:
    if kind == "inspection" and body.lot_id is None:
        raise HTTPException(422, "voice_choose_lot")
    if body.lot_id:
        lots.get_lot(db, actor, body.lot_id)
    task_id = db.scalar(
        insert(tasks)
        .values(
            lot_id=body.lot_id,
            note=body.note,
            actor_id=actor.membership_id,
            is_demo=actor.is_demo,
            kind=kind,
            status="open",
        )
        .returning(tasks.c.id)
    )
    return task_id


@router.post("/resolve", response_model=list[Resolution])
def resolve_phrases(body: ResolveInput, actor: Actor):
    """Interpret transcripts without staging anything, so the form can show
    what was understood before the user sends it."""
    gate(actor)
    results = []
    for phrase in body.phrases:
        result = grammar.interpret(phrase)
        results.append(
            Resolution(
                phrase=phrase,
                status=result.status,
                tool=result.tool,
                quantity=result.quantity,
                unit=result.unit,
                match=result.match,
                candidates=list(result.candidates),
                error=error_code(result),
                loss=result.loss,
            )
        )
    return results


@router.post("/calls", response_model=Call, status_code=201)
def start_call(actor: Actor, db: DB):
    gate(actor)
    row = (
        db.execute(
            insert(calls)
            .values(
                actor_id=actor.membership_id,
                status="active",
                expires_at=trade.now() + timedelta(minutes=10),
            )
            .returning(calls)
        )
        .mappings()
        .one()
    )
    audit(db, actor, "voice.started", row["id"])
    db.commit()
    return Call(**row, entries=[])


@router.get("/calls/{call_id}", response_model=Call)
def call_history(call_id: UUID, actor: Actor, db: DB):
    call = call_for(db, actor, call_id)
    rows = list(
        db.execute(
            select(actions)
            .where(actions.c.call_id == call_id)
            .order_by(actions.c.created_at.desc(), actions.c.id)
            .limit(60)
        ).mappings()
    )
    status = (
        "active"
        if active(call)
        else ("ended" if call["status"] == "ended" else "expired")
    )
    return Call(
        id=call_id,
        status=status,
        expires_at=call["expires_at"],
        entries=[entry_view(row) for row in reversed(rows)],
    )


@router.post("/calls/{call_id}/intent", response_model=Turn)
def intent(call_id: UUID, body: Intent, actor: Actor, db: DB):
    call = call_for(db, actor, call_id, lock=True)
    if not active(call):
        raise HTTPException(409, "voice_call_expired")
    result = grammar.interpret(body.phrase)
    tool, spoken = accepted(result)
    if body.tool is not None and body.tool != tool:
        raise HTTPException(422, "voice_tool_mismatch")
    if (
        db.scalar(
            select(func.count())
            .select_from(actions)
            .where(actions.c.call_id == call_id)
        )
        >= 60
    ):
        raise HTTPException(409, "voice_call_limit")
    action_id = uuid4()
    code, deadline, digest = None, None, None
    try:
        if tool in READS:
            state = "answered"
            args = {}
            readback = read_tool(db, actor, tool, Lookup.model_validate(body.params))
        else:
            if db.scalar(
                select(actions.c.id).where(
                    actions.c.call_id == call_id,
                    actions.c.state == "pending",
                    actions.c.expires_at > trade.now(),
                )
            ):
                raise HTTPException(409, "voice_pending")
            require_pin(db, actor)
            state = "pending"
            args, readback = prepare(
                db, actor, tool, body.params, action_id, spoken, result.loss
            )
            deadline = min(call["expires_at"], trade.now() + timedelta(minutes=2))
            if actor.is_demo:
                # Demo and showcase accounts see a one-time code instead.
                code = f"{secrets.randbelow(10000):04d}"
                digest = code_hash(action_id, code)
    except ValidationError as error:
        raise HTTPException(422, "invalid_input") from error
    row = (
        db.execute(
            insert(actions)
            .values(
                id=action_id,
                call_id=call_id,
                tool=tool,
                state=state,
                readback_bn=readback[:2000],
                arguments=args,
                code_hash=digest,
                expires_at=deadline,
            )
            .returning(actions)
        )
        .mappings()
        .one()
    )
    audit(db, actor, "voice.intent", action_id, tool=tool, match=result.match)
    db.commit()
    return Turn(entry=entry_view(row), demo_code=code)


@router.post("/calls/{call_id}/confirm", response_model=Entry)
def confirm(call_id: UUID, body: Confirm, actor: Actor, db: DB):
    call = call_for(db, actor, call_id, lock=True)
    row = (
        db.execute(
            select(actions)
            .where(actions.c.call_id == call_id, actions.c.id == body.action_id)
            .with_for_update()
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise HTTPException(404, "not_found")
    digits = body.digits.translate(DIGITS)
    pin = None if actor.is_demo else pin_row(db, actor, lock=True)
    if row["state"] == "committed":
        # A retried confirmation returns the result, never a second change.
        if actor.is_demo:
            replay = bool(
                re.fullmatch("[0-9]{4}", digits)
                and row["code_hash"]
                and hmac.compare_digest(
                    row["code_hash"], code_hash(body.action_id, digits)
                )
            )
        else:
            replay = bool(
                pin
                and re.fullmatch("[0-9]{4,6}", digits)
                and kdf_matches(digits, pin["pin_digest"])
            )
        if replay:
            return entry_view(row)
    if (
        not active(call)
        or row["state"] != "pending"
        or row["expires_at"] <= trade.now()
    ):
        raise HTTPException(409, "voice_confirmation_expired")
    if actor.is_demo:
        valid = bool(
            re.fullmatch("[0-9]{4}", digits)
            and row["code_hash"]
            and hmac.compare_digest(row["code_hash"], code_hash(body.action_id, digits))
        )
    else:
        if pin is None:
            raise HTTPException(409, "voice_pin_required")
        if pin["locked_until"] and pin["locked_until"] > trade.now():
            raise HTTPException(409, "voice_pin_locked")
        valid = bool(
            re.fullmatch("[0-9]{4,6}", digits)
            and kdf_matches(digits, pin["pin_digest"])
        )
        failures = 0 if valid else pin["failures"] + 1
        locked = failures >= PIN_FAILURES
        db.execute(
            update(voice_pins)
            .where(voice_pins.c.membership_id == actor.membership_id)
            .values(
                failures=0 if locked else failures,
                locked_until=trade.now() + PIN_LOCK if locked else pin["locked_until"],
            )
        )
        if locked:
            # Too many wrong PINs across actions: cancel and lock the PIN.
            db.execute(
                update(actions)
                .where(actions.c.id == body.action_id)
                .values(attempts=row["attempts"] + 1, state="cancelled")
            )
            audit(db, actor, "voice.pin_locked", actor.membership_id)
            db.commit()
            raise HTTPException(409, "voice_pin_locked")
    if not valid:
        attempts = row["attempts"] + 1
        db.execute(
            update(actions)
            .where(actions.c.id == body.action_id)
            .values(
                attempts=attempts,
                state="cancelled" if attempts >= 3 else "pending",
            )
        )
        audit(db, actor, "voice.keypad_rejected", body.action_id)
        db.commit()
        raise HTTPException(
            422,
            "voice_confirmation_cancelled"
            if attempts >= 3
            else "voice_wrong_digits_last"
            if attempts == 2
            else "voice_wrong_digits",
        )
    try:
        with db.begin_nested():
            result = execute(db, actor, row["tool"], row["arguments"])
        state = "committed"
    except HTTPException as error:
        state, result = "failed", {"error": str(error.detail)}
    updated = (
        db.execute(
            update(actions)
            .where(actions.c.id == body.action_id)
            .values(
                state=state,
                result=result,
            )
            .returning(actions)
        )
        .mappings()
        .one()
    )
    audit(db, actor, f"voice.{state}", body.action_id, tool=row["tool"])
    db.commit()
    return entry_view(updated)


@router.post("/calls/{call_id}/actions/{action_id}/cancel", response_model=Entry)
def cancel_action(call_id: UUID, action_id: UUID, actor: Actor, db: DB):
    """Withdraw a pending change, for example after its code was lost."""
    call_for(db, actor, call_id, lock=True)
    row = (
        db.execute(
            select(actions)
            .where(actions.c.call_id == call_id, actions.c.id == action_id)
            .with_for_update()
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise HTTPException(404, "not_found")
    if row["state"] in {"committed", "failed"}:
        raise HTTPException(409, "invalid_transition")
    if row["state"] != "pending":
        return entry_view(row)
    updated = (
        db.execute(
            update(actions)
            .where(actions.c.id == action_id)
            .values(state="cancelled")
            .returning(actions)
        )
        .mappings()
        .one()
    )
    audit(db, actor, "voice.cancelled", action_id, tool=row["tool"])
    db.commit()
    return entry_view(updated)


@router.delete("/calls/{call_id}", status_code=204)
def end_call(call_id: UUID, actor: Actor, db: DB):
    call = call_for(db, actor, call_id, lock=True)
    if call["status"] != "ended":
        db.execute(update(calls).where(calls.c.id == call_id).values(status="ended"))
        db.execute(
            update(actions)
            .where(actions.c.call_id == call_id, actions.c.state == "pending")
            .values(state="cancelled")
        )
        audit(db, actor, "voice.ended", call_id)
        db.commit()


def task_scope(actor: Profile):
    scope = tasks.c.is_demo == actor.is_demo
    own = tasks.c.actor_id == actor.membership_id
    if actor.role == Role.ADMIN:
        return scope
    if actor.role == Role.AGENT:
        return scope & or_(
            own,
            tasks.c.lot_id.in_(select(lots.lots.c.id).where(lots.scoped_lots(actor))),
        )
    return scope & own


def task_view(row: RowMapping, actor: Profile) -> Task:
    can_resolve = actor.role == Role.ADMIN or (
        actor.role == Role.AGENT
        and row["lot_id"] is not None
        and row["actor_id"] != actor.membership_id
    )
    return Task.model_validate(
        {**row, "can_resolve": can_resolve and row["status"] == "open"}
    )


@router.get("/tasks", response_model=list[Task])
def list_tasks(actor: Actor, db: DB):
    rows = db.execute(
        select(tasks)
        .where(task_scope(actor))
        .order_by(tasks.c.created_at.desc(), tasks.c.id)
        .limit(50)
    ).mappings()
    return [task_view(row, actor) for row in rows]


@router.post("/tasks", response_model=Task, status_code=201)
def request_assistance(body: AssistanceInput, actor: Actor, db: DB):
    require_role(actor, Role.FARMER, Role.BUYER, Role.AGENT)
    task_id = queue_task(db, actor, body.kind, body)
    audit(db, actor, "assistance.requested", task_id)
    row = db.execute(select(tasks).where(tasks.c.id == task_id)).mappings().one()
    db.commit()
    return task_view(row, actor)


@router.post("/tasks/{task_id}/resolve", response_model=Task)
def resolve_task(task_id: UUID, actor: Actor, db: DB):
    require_role(actor, Role.AGENT, Role.ADMIN)
    scope = task_scope(actor)
    if actor.role == Role.AGENT:
        scope &= tasks.c.lot_id.is_not(None) & (tasks.c.actor_id != actor.membership_id)
    row = (
        db.execute(
            update(tasks)
            .where(tasks.c.id == task_id, scope, tasks.c.status == "open")
            .values(status="resolved")
            .returning(tasks)
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        row = (
            db.execute(select(tasks).where(tasks.c.id == task_id, scope))
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise HTTPException(404, "not_found")
        return task_view(row, actor)
    audit(db, actor, "assistance.resolved", task_id)
    db.commit()
    return task_view(row, actor)
