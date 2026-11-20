import logging
from datetime import date, datetime
from decimal import Decimal
from hashlib import sha256
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import (
    JSON,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Uuid,
    func,
    insert,
    select,
)
from sqlalchemy.engine import RowMapping
from sqlalchemy.orm import Session

from app import rate_limits
from app.auth import Actor, Input, Role, audit, require_role
from app.condition import MAX_PHOTO_BYTES, QUALITY_VERSION, VisibleFlag, prepare_photo
from app.database import DB, metadata
from app.lots import NonnegativeKg, get_lot, today
from app.photo_storage import PhotoStorage

router = APIRouter(prefix="/v1/lots/{lot_id}", tags=["Inspection and condition"])
logger = logging.getLogger(__name__)
inspections = Table(
    "inspections",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("lot_id", ForeignKey("lots.id"), nullable=False, index=True),
    Column("actor_id", ForeignKey("memberships.id"), nullable=False),
    Column("observed_on", Date, nullable=False),
    Column("curing", String(10), nullable=False),
    Column("ventilation", String(10), nullable=False),
    Column("moisture", String(10), nullable=False),
    Column("odor", String(10), nullable=False),
    Column("temperature_c", Numeric(4, 1)),
    Column("humidity_pct", Numeric(4, 1)),
    Column("sample_kg", Numeric(12, 3)),
    Column("visible_flags", JSON, nullable=False),
    Column("notes", String(500), nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)
photos = Table(
    "inspection_photos",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("inspection_id", ForeignKey("inspections.id"), nullable=False, index=True),
    Column("storage_key", String(48), nullable=False, unique=True),
    Column("width", Integer, nullable=False),
    Column("height", Integer, nullable=False),
    Column("bytes", Integer, nullable=False),
    Column("sha256", String(64), nullable=False),
    Column("quality_flags", JSON, nullable=False),
    Column("quality_version", String(24), nullable=False),
)
reviews = Table(
    "inspection_reviews",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("inspection_id", ForeignKey("inspections.id"), nullable=False, index=True),
    Column("actor_id", ForeignKey("memberships.id"), nullable=False),
    Column("source", String(20), nullable=False),
    Column("flags", JSON, nullable=False),
    Column("reason", String(500), nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)


predictions = Table(
    "photo_predictions",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("photo_id", ForeignKey("inspection_photos.id"), nullable=False, index=True),
    Column("actor_id", ForeignKey("memberships.id"), nullable=False),
    Column("flag", String(32), nullable=False),
    Column("scores", JSON, nullable=False),
    Column("model", String(100), nullable=False),
    Column("rule", String(24), nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)
# The browser worker in apps/web/public/condition-model.js runs this exact model
# and rule. A prediction from any other model or rule is rejected.
PHOTO_MODEL = "Xenova/clip-vit-base-patch32@6b7c523703ae26e39be4b03774966f8571c7f523"
PHOTO_RULE = "clip-margin-v1"
MIN_TOP_SCORE = 0.58
MIN_LEAD = 0.16
MODEL_LABELS = {
    "rot": VisibleFlag.ROT_OR_MOLD,
    "sprouting": VisibleFlag.SPROUTING,
    "damage": VisibleFlag.DAMAGE,
    "clear": VisibleFlag.NO_OBVIOUS_DEFECT,
    "uncertain": VisibleFlag.UNCERTAIN,
}
Score = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]


def validate_flags(flags: list[VisibleFlag]) -> list[VisibleFlag]:
    if not flags or len(set(flags)) != len(flags):
        raise ValueError("Select one or more distinct visible flags")
    if len(flags) > 1 and (
        VisibleFlag.NO_OBVIOUS_DEFECT in flags or VisibleFlag.UNCERTAIN in flags
    ):
        raise ValueError("An uncertain or clear observation must stand alone")
    return flags


class Observations(Input):
    observed_on: date
    curing: Literal["cured", "uncured", "unknown"]
    ventilation: Literal["good", "poor", "unknown"]
    moisture: Literal["dry", "wet", "unknown"]
    odor: Literal["normal", "off", "unknown"]
    temperature_c: Annotated[Decimal, Field(ge=-20, le=65, decimal_places=1)] | None = (
        None
    )
    humidity_pct: Annotated[Decimal, Field(ge=0, le=100, decimal_places=1)] | None = (
        None
    )
    sample_kg: NonnegativeKg | None = None
    visible_flags: Annotated[list[VisibleFlag], Field(max_length=5)]
    notes: Annotated[str, Field(max_length=500)] = ""

    @field_validator("visible_flags")
    @classmethod
    def flags_valid(cls, value):
        return validate_flags(value)


class ReviewInput(Input):
    flags: Annotated[list[VisibleFlag], Field(max_length=5)]
    reason: Annotated[str, Field(min_length=1, max_length=500)]

    @field_validator("flags")
    @classmethod
    def flags_valid(cls, value):
        return validate_flags(value)


class PredictionInput(Input):
    model: Annotated[str, Field(max_length=100)]
    rule: Annotated[str, Field(max_length=24)]
    scores: dict[Literal["rot", "sprouting", "damage", "clear", "uncertain"], Score]

    @field_validator("scores")
    @classmethod
    def complete(cls, value):
        if len(value) != len(MODEL_LABELS) or not 0.98 <= sum(value.values()) <= 1.02:
            raise ValueError("Supply all five scores from one classification")
        return value


class PredictionView(BaseModel):
    flag: VisibleFlag
    top_score: float
    model: str
    rule: str
    created_at: datetime


class PhotoView(BaseModel):
    id: UUID
    width: int
    height: int
    quality_flags: list[str]
    quality_version: str
    prediction: PredictionView | None = None


def decide(scores: dict[str, float]) -> VisibleFlag:
    """Apply the worker's abstention rule to the submitted scores."""
    (top, best), (_, runner_up) = sorted(
        scores.items(), key=lambda item: item[1], reverse=True
    )[:2]
    if best >= MIN_TOP_SCORE and best - runner_up >= MIN_LEAD:
        return MODEL_LABELS[top]
    return VisibleFlag.UNCERTAIN


def prediction_view(row: RowMapping) -> PredictionView:
    return PredictionView(
        flag=row["flag"],
        top_score=max(row["scores"].values()),
        model=row["model"],
        rule=row["rule"],
        created_at=row["created_at"],
    )


class ReviewView(BaseModel):
    source: Literal["owner_correction", "human_review"]
    flags: list[VisibleFlag]
    reason: str
    created_at: datetime


class InspectionView(Observations):
    id: UUID
    created_at: datetime
    photos: list[PhotoView]
    quality_assessment: Literal["uncertain_or_low_quality", "needs_human_review"]
    confidence: None = None
    effective_flags: list[VisibleFlag]
    provenance: Literal["submitted_observation", "owner_correction", "human_review"]
    review_history: list[ReviewView]


def review_rows(db: Session, inspection_id: UUID) -> list[RowMapping]:
    return list(
        db.execute(
            select(reviews)
            .where(reviews.c.inspection_id == inspection_id)
            .order_by(reviews.c.created_at.desc(), reviews.c.id)
            .limit(20)
        ).mappings()
    )


def inspection_view(db: Session, row: RowMapping) -> InspectionView:
    photo_rows = list(
        db.execute(
            select(photos)
            .where(photos.c.inspection_id == row["id"])
            .order_by(photos.c.id)
        ).mappings()
    )
    latest: dict[UUID, PredictionView] = {}
    if photo_rows:
        for item in db.execute(
            select(predictions)
            .where(predictions.c.photo_id.in_([photo["id"] for photo in photo_rows]))
            .order_by(predictions.c.created_at.desc(), predictions.c.id)
            .limit(100)
        ).mappings():
            latest.setdefault(item["photo_id"], prediction_view(item))
    images = [
        PhotoView.model_validate({**item, "prediction": latest.get(item["id"])})
        for item in photo_rows
    ]
    history = [ReviewView.model_validate(item) for item in review_rows(db, row["id"])]
    values = {
        name: row[name] for name in (*Observations.model_fields, "id", "created_at")
    }
    return InspectionView(
        **values,
        photos=images,
        quality_assessment="needs_human_review"
        if any(not image.quality_flags for image in images)
        else "uncertain_or_low_quality",
        effective_flags=history[0].flags if history else row["visible_flags"],
        provenance=history[0].source if history else "submitted_observation",
        review_history=history,
    )


def observations_query(lot_id: UUID):
    return (
        select(inspections)
        .where(inspections.c.lot_id == lot_id)
        .order_by(
            inspections.c.observed_on.desc(),
            inspections.c.created_at.desc(),
            inspections.c.id,
        )
    )


@router.get("/inspections", response_model=list[InspectionView])
def list_inspections(lot_id: UUID, actor: Actor, db: DB):
    get_lot(db, actor, lot_id)
    return [
        inspection_view(db, row)
        for row in db.execute(observations_query(lot_id).limit(20)).mappings()
    ]


@router.post("/inspections", response_model=InspectionView, status_code=201)
def create_inspection(
    lot_id: UUID,
    actor: Actor,
    db: DB,
    observations: Annotated[str, Form(max_length=4096)],
    images: Annotated[list[UploadFile], File()],
    consent: Annotated[bool, Form()],
):
    require_role(actor, Role.FARMER, Role.AGENT)
    lot = get_lot(db, actor, lot_id)
    try:
        body = Observations.model_validate_json(observations)
    except ValidationError as error:
        raise HTTPException(422, "invalid_input") from error
    if not lot["stored_on"] <= body.observed_on <= today():
        raise HTTPException(422, "inspection_date_invalid")
    if not 1 <= len(images) <= 4:
        raise HTTPException(422, "photos_required")
    if not consent:
        raise HTTPException(422, "confirmation_required")
    files = [
        prepare_photo(image.file.read(MAX_PHOTO_BYTES + 1), image.content_type)
        for image in images
    ]
    storage = PhotoStorage()
    row = (
        db.execute(
            insert(inspections)
            .values(
                **body.model_dump(),
                lot_id=lot_id,
                actor_id=actor.membership_id,
            )
            .returning(inspections)
        )
        .mappings()
        .one()
    )
    uploaded = []
    try:
        for image in files:
            key = f"{uuid4().hex}.jpg"
            uploaded.append(key)
            storage.put(key, image.content)
            db.execute(
                insert(photos).values(
                    inspection_id=row["id"],
                    storage_key=key,
                    width=image.width,
                    height=image.height,
                    bytes=len(image.content),
                    sha256=sha256(image.content).hexdigest(),
                    quality_flags=image.quality_flags,
                    quality_version=QUALITY_VERSION,
                )
            )
        audit(
            db,
            actor,
            "inspection.submitted",
            row["id"],
            lot_id=str(lot_id),
            photo_consent="yes",
        )
        view = inspection_view(db, row)
    except Exception:
        for key in uploaded:
            try:
                storage.remove(key)
            except Exception:
                logger.warning("Could not remove an incomplete inspection object")
        raise
    db.commit()
    return view


@router.get(
    "/inspection-photos/{photo_id}", responses={200: {"content": {"image/jpeg": {}}}}
)
def read_photo(lot_id: UUID, photo_id: UUID, actor: Actor, db: DB):
    get_lot(db, actor, lot_id)
    key = db.scalar(
        select(photos.c.storage_key)
        .select_from(photos.join(inspections))
        .where(
            photos.c.id == photo_id,
            inspections.c.lot_id == lot_id,
        )
    )
    if key is None:
        raise HTTPException(404, "not_found")
    return Response(
        PhotoStorage().get(key),
        media_type="image/jpeg",
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post(
    "/inspection-photos/{photo_id}/predictions",
    response_model=PredictionView,
    status_code=201,
)
def record_prediction(
    lot_id: UUID, photo_id: UUID, body: PredictionInput, actor: Actor, db: DB
):
    """Keep a browser photo-model result so reviewers and operators can compare
    it with human review. The label is derived here from the scores."""
    get_lot(db, actor, lot_id)
    quality = db.scalar(
        select(photos.c.quality_flags)
        .select_from(photos.join(inspections))
        .where(photos.c.id == photo_id, inspections.c.lot_id == lot_id)
    )
    if quality is None:
        raise HTTPException(404, "not_found")
    if quality:
        # Low-quality photos are left to people; the model is not run on them.
        raise HTTPException(409, "photo_quality_insufficient")
    if body.model != PHOTO_MODEL or body.rule != PHOTO_RULE:
        raise HTTPException(422, "photo_model_unrecognized")
    rate_limits.enforce(
        db, "photo-prediction", str(actor.membership_id), limit=30, seconds=600
    )
    flag = decide(body.scores)
    row = (
        db.execute(
            insert(predictions)
            .values(
                photo_id=photo_id,
                actor_id=actor.membership_id,
                flag=flag,
                scores=body.scores,
                model=body.model,
                rule=body.rule,
            )
            .returning(predictions)
        )
        .mappings()
        .one()
    )
    audit(db, actor, "inspection.photo_predicted", photo_id, flag=flag)
    db.commit()
    return prediction_view(row)


@router.post("/inspections/{inspection_id}/review", response_model=InspectionView)
def review_inspection(
    lot_id: UUID, inspection_id: UUID, body: ReviewInput, actor: Actor, db: DB
):
    get_lot(db, actor, lot_id)
    row = (
        db.execute(
            select(inspections)
            .where(inspections.c.id == inspection_id, inspections.c.lot_id == lot_id)
            .with_for_update()
        )
        .mappings()
        .one_or_none()
    )
    if row is None:
        raise HTTPException(404, "not_found")
    source = "human_review"
    if actor.role == Role.FARMER:
        if any(
            review["source"] == "human_review"
            for review in review_rows(db, inspection_id)
        ):
            raise HTTPException(409, "review_locked")
        source = "owner_correction"
    db.execute(
        insert(reviews).values(
            inspection_id=inspection_id,
            actor_id=actor.membership_id,
            source=source,
            flags=body.flags,
            reason=body.reason,
        )
    )
    audit(db, actor, "inspection.reviewed", inspection_id, source=source)
    db.commit()
    return inspection_view(db, row)
