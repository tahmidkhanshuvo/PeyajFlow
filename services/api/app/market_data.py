import csv
import hashlib
import json
from datetime import date, datetime
from decimal import Decimal
from io import StringIO
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, HttpUrl, ValidationError, model_validator
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Uuid,
    func,
    insert,
    select,
    text,
    update,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.auth import Actor, Input, Profile, Role, ShortText, audit, require_role
from app.database import DB, metadata
from app.lots import BDT, Grade, PositiveKg, today

router = APIRouter(prefix="/v1", tags=["Market data"])
PriceType = Literal["farmgate", "wholesale", "retail"]
FRESH_DAYS = 7
CSV_FIELDS = (
    "observed_on",
    "published_on",
    "district",
    "market",
    "price_type",
    "grade",
    "unit",
    "kg_per_maund",
    "low",
    "high",
    "source_url",
    "source_record",
)
ACTIVE = "status <> 'rejected'"

imports = Table(
    "market_imports",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("actor_id", ForeignKey("memberships.id"), nullable=False),
    Column("reviewer_id", ForeignKey("memberships.id")),
    Column("is_demo", Boolean, nullable=False),
    Column("synthetic", Boolean, nullable=False),
    Column("label", String(100), nullable=False),
    Column("status", String(12), nullable=False),
    Column("accepted_rows", Integer, nullable=False),
    Column("duplicates", Integer, nullable=False),
    Column("errors", JSON, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    Column("reviewed_at", DateTime(timezone=True)),
)
prices = Table(
    "market_prices",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("batch_id", ForeignKey("market_imports.id"), nullable=False, index=True),
    Column("series", String(64), nullable=False),
    Column("natural_key", String(64), nullable=False),
    Column("is_demo", Boolean, nullable=False),
    Column("synthetic", Boolean, nullable=False),
    Column("observed_on", Date, nullable=False),
    Column("published_on", Date, nullable=False),
    Column("district", String(100), nullable=False),
    Column("market", String(100), nullable=False),
    Column("price_type", String(12), nullable=False),
    Column("grade", String(10), nullable=False),
    Column("unit", String(10), nullable=False),
    Column("kg_per_maund", Numeric(12, 3)),
    Column("low", Numeric(10, 2), nullable=False),
    Column("high", Numeric(10, 2), nullable=False),
    Column("low_bdt_kg", Numeric(16, 6), nullable=False),
    Column("high_bdt_kg", Numeric(16, 6), nullable=False),
    Column("source_url", String(2083), nullable=False),
    Column("source_record", String(100), nullable=False),
    Column("status", String(12), nullable=False),
    CheckConstraint(
        "observed_on <= published_on and low > 0 and high >= low",
        name="market_price_valid",
    ),
)
Index(
    "uq_active_market_price",
    prices.c.is_demo,
    prices.c.natural_key,
    unique=True,
    postgresql_where=text(ACTIVE),
)
Index("ix_market_series_date", prices.c.is_demo, prices.c.series, prices.c.observed_on)


class Observation(Input):
    observed_on: date
    published_on: date
    district: ShortText
    market: ShortText
    price_type: PriceType
    grade: Grade
    unit: Literal["kg", "maund"]
    kg_per_maund: PositiveKg | None
    low: BDT
    high: BDT
    source_url: HttpUrl
    source_record: ShortText

    @model_validator(mode="after")
    def valid(self):
        if not self.observed_on <= self.published_on <= today() or self.low > self.high:
            raise ValueError("Check the dates and low/high price order")
        if (self.unit == "maund") != (self.kg_per_maund is not None):
            raise ValueError("Supply the recorded kg per maund only for maund prices")
        if self.kg_per_maund is not None and not Decimal(
            1
        ) <= self.kg_per_maund <= Decimal(100):
            raise ValueError(
                "The reported maund conversion must be between 1 and 100 kg"
            )
        if self.source_url.username or self.source_url.password:
            raise ValueError("Use a source URL without credentials")
        return self


class ImportInput(Input):
    label: ShortText
    synthetic: bool
    csv: Annotated[str, Field(min_length=1, max_length=400_000)]


class ReviewImport(Input):
    decision: Literal["approved", "rejected"]


class RowIssue(BaseModel):
    line: int
    message: str


class Batch(BaseModel):
    id: UUID
    label: str
    status: str
    synthetic: bool
    accepted_rows: int
    duplicates: int
    errors: list[RowIssue]
    created_at: datetime
    reviewed_at: datetime | None


class PriceRow(Observation):
    id: UUID
    series: str
    synthetic: bool
    low_bdt_kg: Decimal
    high_bdt_kg: Decimal
    stale: bool


class Series(BaseModel):
    series: str
    district: str
    market: str
    price_type: PriceType
    grade: Grade
    synthetic: bool
    latest_on: date


def digest(*values):
    return hashlib.sha256(
        json.dumps(values, ensure_ascii=False, default=str).encode()
    ).hexdigest()


def parse_csv(value: str) -> tuple[list[tuple[int, Observation]], list[RowIssue]]:
    reader = csv.DictReader(StringIO(value.lstrip("\ufeff")), strict=True)
    rows, issues = [], []
    try:
        if tuple(reader.fieldnames or ()) != CSV_FIELDS:
            raise HTTPException(422, "market_csv_header")
        for count, row in enumerate(reader, 1):
            if count > 1000:
                raise HTTPException(422, "market_csv_limit")
            line = reader.line_num
            if None in row or any(value is None for value in row.values()):
                issues.append(
                    RowIssue(line=line, message="Unexpected number of columns")
                )
                continue
            row["kg_per_maund"] = row["kg_per_maund"] or None
            try:
                rows.append((line, Observation.model_validate(row)))
            except ValidationError as error:
                issue = error.errors(include_input=False, include_url=False)[0]
                location = ".".join(map(str, issue["loc"]))
                issues.append(
                    RowIssue(
                        line=line,
                        message=f"{location}: {issue['msg']}"
                        if location
                        else issue["msg"],
                    )
                )
    except csv.Error as error:
        raise HTTPException(422, "market_csv_malformed") from error
    return rows, issues


def approved(actor: Profile):
    return (prices.c.is_demo == actor.is_demo) & (prices.c.status == "approved")


def price_view(row) -> PriceRow:
    values = {name: row[name] for name in PriceRow.model_fields if name != "stale"}
    # Read historic rows without applying today's import-time validation a second time.
    return PriceRow.model_validate(
        {
            **values,
            "stale": (today() - row["observed_on"]).days > FRESH_DAYS,
        }
    )


def batch_for(db: Session, actor: Profile, batch_id: UUID, *, lock=False):
    require_role(actor, Role.ADMIN)
    stmt = select(imports).where(
        imports.c.id == batch_id, imports.c.is_demo == actor.is_demo
    )
    row = db.execute(stmt.with_for_update() if lock else stmt).mappings().one_or_none()
    if row is None:
        raise HTTPException(404, "not_found")
    return row


@router.get("/admin/data-imports", response_model=list[Batch])
def import_history(actor: Actor, db: DB, offset: Annotated[int, Query(ge=0)] = 0):
    require_role(actor, Role.ADMIN)
    return list(
        db.execute(
            select(imports)
            .where(imports.c.is_demo == actor.is_demo)
            .order_by(imports.c.created_at.desc(), imports.c.id)
            .offset(offset)
            .limit(30)
        ).mappings()
    )


@router.post("/admin/data-imports", response_model=Batch, status_code=201)
def import_csv(body: ImportInput, actor: Actor, db: DB):
    return stage_csv(body, actor, db, commit=True)


def stage_csv(body: ImportInput, actor: Profile, db: Session, *, commit: bool):
    require_role(actor, Role.ADMIN)
    rows, issues = parse_csv(body.csv)
    batch_id = uuid4()
    db.execute(
        insert(imports).values(
            id=batch_id,
            actor_id=actor.membership_id,
            label=body.label,
            synthetic=body.synthetic,
            is_demo=actor.is_demo,
            status="pending",
            accepted_rows=0,
            duplicates=0,
            errors=[],
        )
    )
    accepted_count = duplicates = 0
    for line, entry in rows:
        fields = entry.model_dump()
        fields["source_url"] = str(entry.source_url)
        series = digest(
            entry.district.casefold(),
            entry.market.casefold(),
            entry.price_type,
            entry.grade,
            body.synthetic,
        )
        key = digest(series, entry.observed_on, fields["source_url"])
        divisor = entry.kg_per_maund or Decimal(1)
        inserted = db.scalar(
            pg_insert(prices)
            .values(
                **fields,
                batch_id=batch_id,
                series=series,
                natural_key=key,
                synthetic=body.synthetic,
                is_demo=actor.is_demo,
                status="pending",
                low_bdt_kg=entry.low / divisor,
                high_bdt_kg=entry.high / divisor,
            )
            .on_conflict_do_nothing(
                index_elements=[prices.c.is_demo, prices.c.natural_key],
                index_where=text(ACTIVE),
            )
            .returning(prices.c.id)
        )
        if inserted:
            accepted_count += 1
        else:
            duplicates += 1
            issues.append(
                RowIssue(line=line, message="Duplicate market, date and source URL")
            )
    status = "pending" if accepted_count else "rejected"
    row = (
        db.execute(
            update(imports)
            .where(imports.c.id == batch_id)
            .values(
                status=status,
                accepted_rows=accepted_count,
                duplicates=duplicates,
                errors=[
                    issue.model_dump()
                    for issue in sorted(issues, key=lambda issue: issue.line)
                ],
            )
            .returning(imports)
        )
        .mappings()
        .one()
    )
    audit(db, actor, "market.imported", batch_id, synthetic=str(body.synthetic))
    if commit:
        db.commit()
    return row


class BatchDetail(Batch):
    observations: list[PriceRow]


@router.get("/admin/data-imports/{batch_id}", response_model=BatchDetail)
def review_preview(batch_id: UUID, actor: Actor, db: DB):
    row = batch_for(db, actor, batch_id)
    observations = db.execute(
        select(prices)
        .where(prices.c.batch_id == batch_id)
        .order_by(prices.c.observed_on.desc(), prices.c.id)
    ).mappings()
    return BatchDetail(
        **Batch.model_validate(row).model_dump(),
        observations=[price_view(item) for item in observations],
    )


@router.post("/admin/data-imports/{batch_id}/review", response_model=Batch)
def review_batch(batch_id: UUID, body: ReviewImport, actor: Actor, db: DB):
    existing = batch_for(db, actor, batch_id, lock=True)
    if existing["status"] == body.decision:
        return existing
    if existing["status"] != "pending":
        raise HTTPException(409, "invalid_transition")
    row = (
        db.execute(
            update(imports)
            .where(imports.c.id == batch_id)
            .values(
                status=body.decision,
                reviewer_id=actor.membership_id,
                reviewed_at=func.now(),
            )
            .returning(imports)
        )
        .mappings()
        .one()
    )
    db.execute(
        update(prices).where(prices.c.batch_id == batch_id).values(status=body.decision)
    )
    audit(db, actor, "market.reviewed", batch_id, decision=body.decision)
    db.commit()
    return row


@router.get("/market/series", response_model=list[Series])
def list_series(actor: Actor, db: DB):
    keys = [
        prices.c.series,
        prices.c.district,
        prices.c.market,
        prices.c.price_type,
        prices.c.grade,
        prices.c.synthetic,
    ]
    return list(
        db.execute(
            select(
                prices.c.series,
                func.min(prices.c.district).label("district"),
                func.min(prices.c.market).label("market"),
                *keys[3:],
                func.max(prices.c.observed_on).label("latest_on"),
            )
            .where(approved(actor))
            .group_by(prices.c.series, *keys[3:])
            .order_by(func.max(prices.c.observed_on).desc(), prices.c.series)
            .limit(200)
        ).mappings()
    )


@router.get("/market/prices", response_model=list[PriceRow])
def list_prices(
    actor: Actor,
    db: DB,
    series: Annotated[str | None, Query(pattern="^[0-9a-f]{64}$")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
):
    stmt = select(prices).where(approved(actor))
    if series:
        stmt = stmt.where(prices.c.series == series)
    return [
        price_view(row)
        for row in db.execute(
            stmt.order_by(prices.c.observed_on.desc(), prices.c.id).limit(limit)
        ).mappings()
    ]
