from datetime import date, timedelta
from decimal import Decimal
from math import expm1, log
from statistics import linear_regression
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import audit_log
from app.lots import lot_events

DHAKA = ZoneInfo("Asia/Dhaka")


class LossEstimate(BaseModel):
    method: str = "verified_weight_trend"
    readings: int
    first_on: date
    last_on: date
    low_pct: Decimal
    middle_pct: Decimal
    high_pct: Decimal


def estimate_loss(
    weights: dict[date, Decimal], as_of: date, horizon: int
) -> LossEstimate | None:
    points = sorted(
        (day, weight)
        for day, weight in weights.items()
        if as_of - timedelta(days=90) <= day <= as_of
    )
    if len(points) < 3:
        return None
    first, last = points[0][0], points[-1][0]
    if (as_of - last).days > 7 or (last - first).days < max(14, horizon):
        return None
    weight_values = [weight for _, weight in points]
    if any(weight <= 0 for weight in weight_values) or any(
        after > before for before, after in zip(weight_values, weight_values[1:])
    ):
        return None
    days = [(day - first).days for day, _ in points]
    values = [log(float(weight)) for weight in weight_values]
    slope = linear_regression(days, values).slope
    rates = [
        (after - before) / (end - start)
        for before, after, start, end in zip(values, values[1:], days, days[1:])
    ]

    def loss(rate: float) -> Decimal:
        return Decimal(str(100 * -expm1(min(0, rate) * horizon))).quantize(
            Decimal(".01")
        )

    return LossEstimate(
        readings=len(points),
        first_on=first,
        last_on=last,
        low_pct=loss(max(slope, *rates)),
        middle_pct=loss(slope),
        high_pct=loss(min(slope, *rates)),
    )


def comparable_weights(
    db: Session, lot_id: UUID, stored_on: date, as_of: date
) -> dict[date, Decimal]:
    # Scope is checked by the caller. Restart the trend after stock additions,
    # corrections or dispatch so those movements cannot look like spoilage.
    boundary = db.scalar(
        select(func.max(lot_events.c.recorded_at)).where(
            lot_events.c.lot_id == lot_id,
            lot_events.c.delta_kg != 0,
            lot_events.c.event_type != "LOSS_REPORTED",
        )
    )
    query = (
        select(audit_log.c.recorded_at, audit_log.c.context)
        .where(
            audit_log.c.resource_id == lot_id,
            audit_log.c.action == "lot.verified",
            audit_log.c.recorded_at >= func.now() - timedelta(days=91),
        )
        .order_by(audit_log.c.recorded_at.desc(), audit_log.c.id)
        .limit(250)
    )
    if boundary is not None:
        # With transaction timestamps a verification can tie a stock change.
        query = query.where(audit_log.c.recorded_at > boundary)
    weights: dict[date, Decimal] = {}
    for recorded_at, context in db.execute(query):
        day = recorded_at.astimezone(DHAKA).date()
        if day >= stored_on:
            weights.setdefault(day, Decimal(context["verified_kg"]))
    return weights


def lot_loss(
    db: Session, lot_id: UUID, stored_on: date, as_of: date, horizon: int
) -> LossEstimate | None:
    return estimate_loss(
        comparable_weights(db, lot_id, stored_on, as_of), as_of, horizon
    )
