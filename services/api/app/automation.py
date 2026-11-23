"""Narrow, retry-safe operator jobs. Business approvals are never automated."""

from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import Field
from sqlalchemy import (
    JSON,
    Boolean,
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
from sqlalchemy.dialects.postgresql import insert as upsert

from app import admin, auth, features, forecast, market_data, notifications
from app.auth import Actor, Input, Role, audit, require_role
from app.database import DB, metadata
from app.rate_limits import enforce

router = APIRouter(prefix="/v1/automation", tags=["Automation"])
subscriptions = Table(
    "price_subscriptions",
    metadata,
    Column("membership_id", ForeignKey("memberships.id"), primary_key=True),
    Column("enabled", Boolean, nullable=False),
    Column("series", String(64)),
)
runs = Table(
    "automation_runs",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("membership_id", ForeignKey("memberships.id"), nullable=False),
    Column("job", String(40), nullable=False),
    Column("request_key", Uuid, nullable=False),
    Column("payload_hash", String(64), nullable=False),
    Column("result", JSON, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    UniqueConstraint(
        "membership_id", "job", "request_key", name="uq_automation_request"
    ),
)


class Subscription(Input):
    enabled: bool
    series: Annotated[str | None, Field(pattern="^[0-9a-f]{64}$")] = None


@router.get("/subscription")
def get_subscription(actor: Actor, db: DB):
    row = (
        db.execute(
            select(subscriptions).where(
                subscriptions.c.membership_id == actor.membership_id
            )
        )
        .mappings()
        .one_or_none()
    )
    return dict(row) if row else {"enabled": False, "series": None}


@router.put("/subscription")
def subscribe(body: Subscription, actor: Actor, db: DB):
    # Opt-out remains available even when all scheduled jobs are disabled.
    if body.enabled:
        features.require("AUTOMATION_ENABLED", "automation_disabled")
    if body.enabled and not body.series:
        raise HTTPException(422, "automation_series_required")
    if body.series and body.series not in {
        row["series"] for row in market_data.list_series(actor, db)
    }:
        raise HTTPException(404, "series_not_found")
    db.execute(
        upsert(subscriptions)
        .values(membership_id=actor.membership_id, **body.model_dump())
        .on_conflict_do_update(
            index_elements=[subscriptions.c.membership_id], set_=body.model_dump()
        )
    )
    audit(db, actor, "automation.subscription", actor.membership_id)
    db.commit()
    return body


class JobInput(Input):
    request_key: UUID


class ImportJob(JobInput):
    label: Annotated[str, Field(min_length=1, max_length=100)]
    synthetic: bool
    csv: Annotated[str, Field(min_length=1, max_length=400000)]


def begin_job(db, actor, job, body):
    require_role(actor, Role.ADMIN)
    if not actor.verified:
        raise HTTPException(403, "role_forbidden")
    features.require("AUTOMATION_ENABLED", "automation_disabled")
    enforce(db, "automation-run", str(actor.membership_id), limit=60, seconds=3600)
    # Serialize by owner + job + request key across API workers.
    digest = market_data.digest(str(actor.membership_id), job, str(body.request_key))
    db.execute(select(func.pg_advisory_xact_lock(int(digest[:15], 16))))
    previous = (
        db.execute(
            select(runs).where(
                runs.c.membership_id == actor.membership_id,
                runs.c.job == job,
                runs.c.request_key == body.request_key,
            )
        )
        .mappings()
        .one_or_none()
    )
    payload = market_data.digest(body.model_dump(mode="json"))
    if previous and previous["payload_hash"] != payload:
        raise HTTPException(409, "idempotency_conflict")
    return previous, payload


def finish(db, actor, job, body, payload, result):
    run_id = uuid4()
    db.execute(
        insert(runs).values(
            id=run_id,
            membership_id=actor.membership_id,
            job=job,
            request_key=body.request_key,
            payload_hash=payload,
            result=result,
        )
    )
    audit(db, actor, "automation.completed", run_id, job=job)
    db.commit()
    return result


@router.get("/runs")
def history(actor: Actor, db: DB):
    require_role(actor, Role.ADMIN)
    return list(
        db.execute(
            select(runs.c.id, runs.c.job, runs.c.result, runs.c.created_at)
            .where(runs.c.membership_id == actor.membership_id)
            .order_by(runs.c.created_at.desc())
            .limit(30)
        ).mappings()
    )


@router.post("/jobs/{job}")
def execute(
    job: Literal["weekly-prices", "freshness", "alert-routing"],
    body: JobInput,
    actor: Actor,
    db: DB,
):
    previous, payload = begin_job(db, actor, job, body)
    if previous:
        return previous["result"]
    result = {"job": job, "sent": 0, "channel": "in_app", "issues": 0}
    if job == "weekly-prices":
        # Consent to this specific digest is distinct from generic SMS consent.
        rows = db.execute(
            select(subscriptions.c.membership_id, subscriptions.c.series)
            .select_from(
                subscriptions.join(
                    auth.member_accounts,
                    subscriptions.c.membership_id == auth.memberships.c.id,
                )
            )
            .where(
                subscriptions.c.enabled,
                auth.organizations.c.is_demo == actor.is_demo,
                auth.users.c.verification_status == "verified",
            )
        ).all()
        for member_id, series in rows:
            market = db.execute(
                select(market_data.prices.c.market, market_data.prices.c.district)
                .where(
                    market_data.approved(actor), market_data.prices.c.series == series
                )
                .limit(1)
            ).first()
            if market is None:
                result["issues"] += 1
                continue
            # Forecast reads retain publication dates and the correct demo cohort.
            try:
                outlook = forecast.market_forecast(db, actor, series, 7)
            except HTTPException:
                result["issues"] += 1
                continue
            notice = (
                ("সিমুলেটেড সাপ্তাহিক দর: " if actor.is_demo else "সাপ্তাহিক দর: ")
                + (f"{market.market}, {market.district}। ")
                + (
                    f"৭ দিনে সম্ভাব্য দর {outlook.low_bdt_kg}–{outlook.high_bdt_kg} টাকা/কেজি।"
                    if outlook.low_bdt_kg is not None
                    else "যথেষ্ট সাম্প্রতিক প্রমাণ নেই; পূর্বাভাস দেওয়া হয়নি।"
                )
            )
            # In-app publication uses the existing delivery pipeline, which alone
            # enforces provider verification, consent, quiet hours and STOP.
            notifications.publish(
                db,
                [member_id],
                "market.weekly",
                "market",
                UUID(series[:32]),
                version=str(body.request_key),
                summary=notice + (" কাল্পনিক বাজারদর।" if outlook.synthetic else ""),
            )
            result["sent"] += 1
        result["channel"] = "simulator_and_in_app"
    else:
        if job == "freshness":
            result["issues"] = sum(
                row.status == "stale" for row in admin.quality(actor, db)
            )
        else:
            overview = admin.overview(actor, db)
            result["issues"] = overview.open_disputes + overview.attention_sms
            # Settlement decisions already publish operator/party alerts; this
            # routes the unresolved workload, without copying payment references.
            from app.settlement import payments as reports

            result["issues"] += (
                db.scalar(
                    select(func.count())
                    .select_from(
                        reports.join(
                            auth.memberships,
                            reports.c.buyer_id == auth.memberships.c.id,
                        ).join(auth.organizations)
                    )
                    .where(
                        auth.organizations.c.is_demo == actor.is_demo,
                        reports.c.status == "rejected",
                    )
                )
                or 0
            )
        if result["issues"]:
            recipients = db.scalars(
                select(auth.memberships.c.id)
                .select_from(auth.member_accounts)
                .where(
                    auth.memberships.c.role == Role.ADMIN,
                    auth.organizations.c.is_demo == actor.is_demo,
                    auth.users.c.verified,
                )
            ).all()
            notifications.publish(
                db,
                recipients,
                "automation.attention",
                "automation",
                actor.membership_id,
                version=f"{job}:{body.request_key}",
            )
            result["sent"] = len(recipients)
    return finish(db, actor, job, body, payload, result)


@router.post("/imports", status_code=201)
def stage_import(body: ImportJob, actor: Actor, db: DB):
    previous, payload = begin_job(db, actor, "imports", body)
    if previous:
        return previous["result"]
    # Stage and the replay receipt commit atomically under the same lock.
    batch = market_data.stage_csv(
        market_data.ImportInput(
            label=body.label, synthetic=body.synthetic, csv=body.csv
        ),
        actor,
        db,
        commit=False,
    )
    return finish(
        db,
        actor,
        "imports",
        body,
        payload,
        {"batch_id": str(batch["id"]), "status": batch["status"]},
    )
