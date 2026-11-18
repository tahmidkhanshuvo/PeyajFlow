import logging
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    UniqueConstraint,
    Uuid,
    false,
    func,
    insert,
    or_,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import RowMapping
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import (
    Actor,
    Input,
    Profile,
    Role,
    ShortText,
    audit,
    memberships,
    require_role,
    users,
)
from app.database import DB, metadata
from app.demand import GRADE_RANK, demand_for, listed_lot_filter
from app.lots import BDT, Grade, PositiveKg, lots, payload_hash, record_event, today
from app.notifications import publish

router = APIRouter(prefix="/v1", tags=["Offers and orders"])
ACTIVE_OFFERS = ("sent", "countered")
RESERVATION_DURATION = timedelta(hours=48)
logger = logging.getLogger(__name__)

offers = Table(
    "offers",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("lot_id", ForeignKey("lots.id"), nullable=False),
    Column(
        "buyer_membership_id", ForeignKey("memberships.id"), nullable=False, index=True
    ),
    Column(
        "seller_membership_id", ForeignKey("memberships.id"), nullable=False, index=True
    ),
    Column("proposer_id", ForeignKey("memberships.id"), nullable=False),
    Column("buyer_name", String(100), nullable=False),
    Column("buyer_verified", Boolean, nullable=False, server_default=false()),
    Column("seller_name", String(100), nullable=False),
    Column("lot_label", String(100), nullable=False),
    Column("variety", String(100), nullable=False),
    Column("grade", String(10), nullable=False),
    Column("buyer_request_id", ForeignKey("buyer_requests.id")),
    Column("is_demo", Boolean, nullable=False),
    Column("quantity_kg", Numeric(12, 3), nullable=False),
    Column("price_bdt_kg", Numeric(10, 2), nullable=False),
    Column("delivery_district", String(100), nullable=False),
    Column("delivery_from", Date),
    Column("delivery_to", Date),
    Column("transport", String(12), nullable=False),
    Column("status", String(12), nullable=False),
    Column("version", Integer, nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("create_key", Uuid, nullable=False),
    Column("create_hash", String(64), nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    UniqueConstraint("buyer_membership_id", "create_key", name="uq_offer_buyer_create"),
    CheckConstraint(
        "quantity_kg > 0 and price_bdt_kg > 0 and version > 0",
        name="positive_offer_terms",
    ),
    CheckConstraint(
        "(delivery_from is null and delivery_to is null) or "
        "(delivery_from is not null and delivery_to is not null and delivery_from <= delivery_to)",
        name="offer_delivery_window",
    ),
)
orders = Table(
    "orders",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("offer_id", ForeignKey("offers.id"), unique=True, nullable=False),
    Column("status", String(12), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)
trade_actions = Table(
    "trade_actions",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("resource_id", Uuid, nullable=False),
    Column("resource_type", String(5), nullable=False),
    Column("actor_id", ForeignKey("memberships.id")),
    Column("request_key", Uuid, nullable=False),
    Column("request_hash", String(64), nullable=False),
    Column("action", String(16), nullable=False),
    Column("result", JSON, nullable=False),
    Column(
        "recorded_at",
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    ),
    UniqueConstraint(
        "resource_type", "resource_id", "request_key", name="uq_trade_request"
    ),
)


class OfferInput(Input):
    lot_id: UUID
    buyer_request_id: UUID | None = None
    quantity_kg: PositiveKg
    price_bdt_kg: BDT
    delivery_district: ShortText
    delivery_on: date | None = None
    transport: Literal["buyer", "seller"]
    valid_hours: Annotated[int, Field(ge=1, le=168)] = 24
    request_key: UUID

    @model_validator(mode="after")
    def delivery_date(self):
        if self.delivery_on and (self.buyer_request_id or self.delivery_on < today()):
            raise ValueError(
                "Use the linked demand window or provide a date today or later"
            )
        return self


class OfferReply(Input):
    action: Literal["accept", "reject", "counter", "withdraw"]
    version: Annotated[int, Field(ge=1)]
    request_key: UUID
    confirm: bool = False
    quantity_kg: PositiveKg | None = None
    price_bdt_kg: BDT | None = None

    @model_validator(mode="after")
    def valid_counter(self):
        if self.action == "counter":
            if self.quantity_kg is None or self.price_bdt_kg is None:
                raise ValueError("A counter requires quantity and price")
        elif self.quantity_kg is not None or self.price_bdt_kg is not None:
            raise ValueError("Only a counter may change terms")
        return self


class OrderReply(Input):
    action: Literal["dispatch", "receive", "cancel", "dispute"]
    request_key: UUID
    confirm: bool = False


class OfferView(BaseModel):
    id: UUID
    lot_id: UUID
    lot_label: str
    buyer_name: str
    buyer_verified: bool
    seller_name: str
    proposer_id: UUID
    variety: str
    grade: Grade
    quantity_kg: Decimal
    price_bdt_kg: Decimal
    total_bdt: Decimal
    delivery_district: str
    delivery_from: date | None
    delivery_to: date | None
    transport: Literal["buyer", "seller"]
    status: str
    version: int
    expires_at: datetime


class OrderView(BaseModel):
    id: UUID
    offer: OfferView
    status: str
    expires_at: datetime
    created_at: datetime


class Activity(BaseModel):
    action: str
    recorded_at: datetime
    by_system: bool


class OfferActivity(BaseModel):
    action: str
    recorded_at: datetime
    version: int
    by: str
    quantity_kg: Decimal | None = None
    price_bdt_kg: Decimal | None = None


class OfferDetail(OfferView):
    activity: list[OfferActivity]


class OrderDetail(OrderView):
    activity: list[Activity]


class Receipt(BaseModel):
    id: UUID
    status: str
    version: int | None = None
    order_id: UUID | None = None


def now() -> datetime:
    return datetime.now(UTC)


def offer_expired(row: RowMapping) -> bool:
    return row["expires_at"] <= now() or (
        row["delivery_to"] is not None and row["delivery_to"] < today()
    )


def order_total(quantity: Decimal, price: Decimal) -> Decimal:
    return (quantity * price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def offer_view(row: RowMapping) -> OfferView:
    status = row["status"]
    if status in ACTIVE_OFFERS and offer_expired(row):
        status = "expired"
    total = order_total(row["quantity_kg"], row["price_bdt_kg"])
    return OfferView.model_validate({**row, "status": status, "total_bdt": total})


def trade_scope(actor: Profile):
    cohort = offers.c.is_demo == actor.is_demo
    if actor.role == Role.ADMIN:
        return cohort
    require_role(actor, Role.FARMER, Role.BUYER)
    return cohort & or_(
        offers.c.buyer_membership_id == actor.membership_id,
        offers.c.seller_membership_id == actor.membership_id,
    )


def scoped_offer(
    db: Session, actor: Profile, offer_id: UUID, *, lock: bool = False
) -> RowMapping:
    stmt = select(offers).where(offers.c.id == offer_id, trade_scope(actor))
    row = db.execute(stmt.with_for_update() if lock else stmt).mappings().one_or_none()
    if row is None:
        raise HTTPException(404, "not_found")
    return row


def order_rows(db: Session, actor: Profile, order_id: UUID, *, lock: bool = False):
    stmt = (
        select(orders)
        .select_from(orders.join(offers))
        .where(orders.c.id == order_id, trade_scope(actor))
    )
    row = (
        db.execute(stmt.with_for_update(of=orders) if lock else stmt)
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise HTTPException(404, "not_found")
    return row, scoped_offer(db, actor, row["offer_id"])


def order_view(order: RowMapping, offer: RowMapping) -> OrderView:
    return OrderView.model_validate({**order, "offer": offer_view(offer)})


def replay(
    db: Session,
    kind: str,
    resource_id: UUID,
    actor: Profile,
    body: OfferReply | OrderReply,
):
    prior = (
        db.execute(
            select(trade_actions).where(
                trade_actions.c.resource_type == kind,
                trade_actions.c.resource_id == resource_id,
                trade_actions.c.request_key == body.request_key,
            )
        )
        .mappings()
        .one_or_none()
    )
    if prior is None:
        return None
    if prior["actor_id"] != actor.membership_id or prior[
        "request_hash"
    ] != payload_hash(body):
        raise HTTPException(409, "idempotency_conflict")
    return Receipt.model_validate(prior["result"])


def journal(
    db: Session,
    kind: str,
    result: Receipt,
    action: str,
    actor: Profile | None = None,
    body: OfferReply | OrderReply | None = None,
    *,
    terms: OfferView | None = None,
):
    snapshot = result.model_dump(mode="json")
    if terms is not None:
        snapshot["terms"] = {
            "quantity_kg": str(terms.quantity_kg),
            "price_bdt_kg": str(terms.price_bdt_kg),
        }
    db.execute(
        insert(trade_actions).values(
            resource_type=kind,
            resource_id=result.id,
            actor_id=actor.membership_id if actor else None,
            request_key=body.request_key if body else uuid4(),
            request_hash=payload_hash(body) if body else "",
            action=action,
            result=snapshot,
        )
    )
    if actor is not None:
        audit(db, actor, f"{kind}.{action}", result.id)


def lock_lot(db: Session, lot_id: UUID) -> RowMapping:
    return (
        db.execute(select(lots).where(lots.c.id == lot_id).with_for_update())
        .mappings()
        .one()
    )


def check_lot(offer: RowMapping, lot: RowMapping, quantity: Decimal):
    if not lot["listed"] or (offer["grade"], offer["variety"]) != (
        lot["grade"],
        lot["variety"],
    ):
        raise HTTPException(409, "invalid_transition")
    limit = (
        lot["verified_kg"] if lot["verified_kg"] is not None else lot["available_kg"]
    )
    if quantity > limit - lot["reserved_kg"]:
        raise HTTPException(409, "insufficient_stock")


@router.get("/offers", response_model=list[OfferView])
def list_offers(actor: Actor, db: DB, offset: Annotated[int, Query(ge=0)] = 0):
    rows = db.execute(
        select(offers)
        .where(trade_scope(actor))
        .order_by(
            offers.c.created_at.desc(),
            offers.c.id,
        )
        .offset(offset)
        .limit(50)
    ).mappings()
    return [offer_view(row) for row in rows]


@router.get("/offers/{offer_id}", response_model=OfferDetail)
def read_offer(offer_id: UUID, actor: Actor, db: DB):
    offer = scoped_offer(db, actor, offer_id)
    events = db.execute(
        select(trade_actions)
        .where(
            trade_actions.c.resource_type == "offer",
            trade_actions.c.resource_id == offer_id,
        )
        .order_by(trade_actions.c.recorded_at, trade_actions.c.id)
    ).mappings()
    activity = [
        OfferActivity(
            action=entry["action"],
            recorded_at=entry["recorded_at"],
            version=entry["result"]["version"],
            by=offer["buyer_name"]
            if entry["actor_id"] == offer["buyer_membership_id"]
            else offer["seller_name"],
            **entry["result"].get("terms", {}),
        )
        for entry in events
    ]
    return OfferDetail(**offer_view(offer).model_dump(), activity=activity)


def send_offer(body: OfferInput, actor: Profile, db: Session):
    require_role(actor, Role.BUYER)
    digest = payload_hash(body)
    existing = select(offers).where(
        offers.c.buyer_membership_id == actor.membership_id,
        offers.c.create_key == body.request_key,
    )
    previous = db.execute(existing).mappings().one_or_none()
    if previous:
        if previous["create_hash"] != digest:
            raise HTTPException(409, "idempotency_conflict")
        return offer_view(previous)
    delivery_from = delivery_to = body.delivery_on
    demand = None
    if body.buyer_request_id:
        demand = demand_for(db, actor, body.buyer_request_id, lock=True)
        if (
            demand["status"] != "open"
            or demand["delivery_to"] < today()
            or demand["delivery_district"] != body.delivery_district
            or demand["transport"] != body.transport
            or body.quantity_kg > demand["quantity_kg"]
            or (
                demand["price_ceiling_bdt_kg"] is not None
                and body.price_bdt_kg > demand["price_ceiling_bdt_kg"]
            )
        ):
            raise HTTPException(422, "demand_terms_mismatch")
        delivery_from, delivery_to = demand["delivery_from"], demand["delivery_to"]
    lot = (
        db.execute(
            select(lots)
            .where(
                lots.c.id == body.lot_id,
                listed_lot_filter(actor),
            )
            .with_for_update()
        )
        .mappings()
        .one_or_none()
    )
    if lot is None:
        raise HTTPException(404, "not_found")
    check_lot(lot, lot, body.quantity_kg)
    if demand is not None and (
        demand["variety"].casefold() != lot["variety"].casefold()
        or GRADE_RANK[Grade(lot["grade"])] < GRADE_RANK[Grade(demand["minimum_grade"])]
    ):
        raise HTTPException(422, "demand_terms_mismatch")
    seller = db.scalar(
        select(users.c.name)
        .select_from(memberships.join(users, memberships.c.user_id == users.c.id))
        .where(memberships.c.id == lot["owner_membership_id"])
    )
    row = (
        db.execute(
            pg_insert(offers)
            .values(
                **body.model_dump(
                    exclude={"request_key", "valid_hours", "delivery_on"}
                ),
                buyer_membership_id=actor.membership_id,
                seller_membership_id=lot["owner_membership_id"],
                proposer_id=actor.membership_id,
                buyer_name=actor.name,
                buyer_verified=actor.verified,
                seller_name=seller,
                lot_label=lot["label"],
                variety=lot["variety"],
                grade=lot["grade"],
                is_demo=actor.is_demo,
                status="sent",
                delivery_from=delivery_from,
                delivery_to=delivery_to,
                version=1,
                expires_at=now() + timedelta(hours=body.valid_hours),
                create_key=body.request_key,
                create_hash=digest,
            )
            .on_conflict_do_nothing(constraint="uq_offer_buyer_create")
            .returning(offers)
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        row = db.execute(existing).mappings().one()
        if row["create_hash"] != digest:
            raise HTTPException(409, "idempotency_conflict")
        return offer_view(row)
    result = offer_view(row)
    journal(
        db,
        "offer",
        Receipt(id=row["id"], status="sent", version=1),
        "sent",
        actor,
        terms=result,
    )
    publish(db, [row["seller_membership_id"]], "offer.sent", "offer", row["id"], "1")
    return result


@router.post("/offers", response_model=OfferView, status_code=201)
def create_offer(body: OfferInput, actor: Actor, db: DB):
    result = send_offer(body, actor, db)
    db.commit()
    return result


def accept_offer(
    db: Session, actor: Profile, offer: RowMapping, lot: RowMapping
) -> UUID:
    order_id = uuid4()
    quantity = offer["quantity_kg"]
    db.execute(
        insert(orders).values(
            id=order_id,
            offer_id=offer["id"],
            status="confirmed",
            expires_at=now() + RESERVATION_DURATION,
        )
    )
    db.execute(
        update(lots)
        .where(lots.c.id == lot["id"])
        .values(reserved_kg=lot["reserved_kg"] + quantity)
    )
    record_event(
        db,
        actor,
        lot["id"],
        "RESERVED",
        "offer_accepted",
        reserved_delta=quantity,
        order_id=order_id,
    )
    journal(db, "order", Receipt(id=order_id, status="confirmed"), "confirmed", actor)
    publish(db, participants(offer), "order.confirmed", "order", order_id)
    return order_id


def respond_to_offer(offer_id: UUID, body: OfferReply, actor: Profile, db: Session):
    require_role(actor, Role.FARMER, Role.BUYER)
    offer = scoped_offer(db, actor, offer_id, lock=True)
    receipt = replay(db, "offer", offer_id, actor, body)
    if receipt:
        return receipt
    is_proposer = offer["proposer_id"] == actor.membership_id
    if (
        offer["status"] not in ACTIVE_OFFERS
        or offer["version"] != body.version
        or is_proposer != (body.action == "withdraw")
    ):
        raise HTTPException(409, "invalid_transition")
    if offer_expired(offer):
        raise HTTPException(409, "offer_expired")
    if body.action == "accept" and not body.confirm:
        raise HTTPException(422, "confirmation_required")
    status = {
        "accept": "accepted",
        "reject": "rejected",
        "counter": "countered",
        "withdraw": "withdrawn",
    }[body.action]
    changes = {"status": status, "version": body.version + 1}
    order_id = None
    if body.action in {"accept", "counter"}:
        lot = lock_lot(db, offer["lot_id"])
        if offer_expired(offer):
            raise HTTPException(409, "offer_expired")
        check_lot(
            offer,
            lot,
            body.quantity_kg if body.action == "counter" else offer["quantity_kg"],
        )
        if body.action == "counter":
            changes.update(
                quantity_kg=body.quantity_kg,
                price_bdt_kg=body.price_bdt_kg,
                proposer_id=actor.membership_id,
            )
        else:
            order_id = accept_offer(db, actor, offer, lot)
    updated = (
        db.execute(
            update(offers)
            .where(offers.c.id == offer_id)
            .values(**changes)
            .returning(offers)
        )
        .mappings()
        .one()
    )
    result = Receipt(
        id=offer_id, status=status, version=body.version + 1, order_id=order_id
    )
    journal(db, "offer", result, status, actor, body, terms=offer_view(updated))
    if status != "accepted":
        publish(
            db,
            participants(offer) - {actor.membership_id},
            f"offer.{status}",
            "offer",
            offer_id,
            str(result.version),
        )
    return result


@router.post("/offers/{offer_id}/respond", response_model=Receipt)
def respond(offer_id: UUID, body: OfferReply, actor: Actor, db: DB):
    result = respond_to_offer(offer_id, body, actor, db)
    db.commit()
    return result


@router.get("/orders", response_model=list[OrderView])
def list_orders(actor: Actor, db: DB, offset: Annotated[int, Query(ge=0)] = 0):
    rows = (
        db.execute(
            select(orders)
            .select_from(orders.join(offers))
            .where(trade_scope(actor))
            .order_by(orders.c.created_at.desc(), orders.c.id)
            .offset(offset)
            .limit(50)
        )
        .mappings()
        .all()
    )
    offer_map = {
        row["id"]: row
        for row in db.execute(
            select(offers).where(offers.c.id.in_([row["offer_id"] for row in rows]))
        ).mappings()
    }
    return [order_view(row, offer_map[row["offer_id"]]) for row in rows]


@router.get("/orders/{order_id}", response_model=OrderDetail)
def read_order(order_id: UUID, actor: Actor, db: DB):
    row, offer = order_rows(db, actor, order_id)
    actions = db.execute(
        select(
            trade_actions.c.action,
            trade_actions.c.recorded_at,
            trade_actions.c.actor_id.is_(None).label("by_system"),
        )
        .where(
            trade_actions.c.resource_type == "order",
            trade_actions.c.resource_id == order_id,
        )
        .order_by(trade_actions.c.recorded_at, trade_actions.c.id)
    ).mappings()
    return OrderDetail(
        **order_view(row, offer).model_dump(),
        activity=[Activity.model_validate(item) for item in actions],
    )


def release_or_dispatch(
    db: Session,
    order: RowMapping,
    offer: RowMapping,
    status: str,
    actor: Profile | None,
):
    lot = lock_lot(db, offer["lot_id"])
    quantity = offer["quantity_kg"]
    changes = {"reserved_kg": lot["reserved_kg"] - quantity}
    delta = Decimal(0)
    kind = "RESERVATION_RELEASED"
    if status == "dispatched":
        kind = "DISPATCHED"
        delta = -quantity
        changes["available_kg"] = lot["available_kg"] - quantity
        if lot["verified_kg"] is not None:
            changes["verified_kg"] = lot["verified_kg"] - quantity
    db.execute(update(lots).where(lots.c.id == lot["id"]).values(**changes))
    record_event(
        db,
        actor,
        lot["id"],
        kind,
        status,
        delta=delta,
        reserved_delta=-quantity,
        order_id=order["id"],
    )


def expire_order(db: Session, order: RowMapping, offer: RowMapping):
    release_or_dispatch(db, order, offer, "expired", None)
    db.execute(
        update(orders).where(orders.c.id == order["id"]).values(status="expired")
    )
    result = Receipt(id=order["id"], status="expired")
    journal(db, "order", result, "expired")
    publish(db, participants(offer), "order.expired", "order", order["id"])
    return result


def participants(offer: RowMapping) -> set[UUID]:
    return {offer["buyer_membership_id"], offer["seller_membership_id"]}


@router.post("/orders/{order_id}/transition", response_model=Receipt)
def transition(order_id: UUID, body: OrderReply, actor: Actor, db: DB):
    require_role(actor, Role.FARMER, Role.BUYER)
    order, offer = order_rows(db, actor, order_id, lock=True)
    receipt = replay(db, "order", order_id, actor, body)
    if receipt:
        return receipt
    if order["status"] == "confirmed" and order["expires_at"] <= now():
        result = expire_order(db, order, offer)
        db.commit()
        return result
    if not body.confirm:
        raise HTTPException(422, "confirmation_required")
    expected, result_status, required_role = {
        "dispatch": ({"confirmed"}, "dispatched", Role.FARMER),
        "receive": ({"dispatched"}, "delivered", Role.BUYER),
        "cancel": ({"confirmed"}, "cancelled", None),
        "dispute": ({"dispatched", "delivered"}, "disputed", None),
    }[body.action]
    if required_role and actor.role != required_role:
        raise HTTPException(403, "role_forbidden")
    if order["status"] not in expected:
        raise HTTPException(409, "invalid_transition")
    if result_status in {"dispatched", "cancelled"}:
        release_or_dispatch(db, order, offer, result_status, actor)
    if result_status == "delivered":
        record_event(
            db, actor, offer["lot_id"], "DELIVERED", "buyer_received", order_id=order_id
        )
    db.execute(
        update(orders).where(orders.c.id == order_id).values(status=result_status)
    )
    result = Receipt(id=order_id, status=result_status)
    journal(db, "order", result, result_status, actor, body)
    publish(
        db,
        participants(offer),
        f"order.{result_status}",
        "order",
        order_id,
        str(body.request_key),
    )
    db.commit()
    return result


def sweep_expired(engine):
    try:
        with Session(engine) as db:
            ids = db.scalars(
                select(orders.c.id)
                .where(
                    orders.c.status == "confirmed",
                    orders.c.expires_at <= func.now(),
                )
                .order_by(orders.c.expires_at, orders.c.id)
                .limit(100)
            ).all()
        for order_id in ids:
            with Session(engine) as db, db.begin():
                order = (
                    db.execute(
                        select(orders)
                        .where(
                            orders.c.id == order_id,
                            orders.c.status == "confirmed",
                            orders.c.expires_at <= func.now(),
                        )
                        .with_for_update(skip_locked=True)
                    )
                    .mappings()
                    .one_or_none()
                )
                if order is not None:
                    offer = (
                        db.execute(
                            select(offers).where(offers.c.id == order["offer_id"])
                        )
                        .mappings()
                        .one()
                    )
                    expire_order(db, order, offer)
    except SQLAlchemyError:
        logger.warning("Order expiry sweep could not query the database")
