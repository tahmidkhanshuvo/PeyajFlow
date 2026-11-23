"""Bounded LangGraph investigation with durable checkpoints and note approval.

Operational records are summarized locally. Only public knowledge passages and
the user's question can reach a configured model. No graph node has write tools.
"""

from typing import Annotated, Literal, TypedDict
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request
from langgraph.checkpoint.base import (
    WRITES_IDX_MAP,
    BaseCheckpointSaver,
    CheckpointTuple,
)
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from pydantic import Field
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    LargeBinary,
    String,
    Table,
    Uuid,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import insert as upsert
from sqlalchemy.orm import Session

from app.auth import Actor, Input, Role, audit, require_role
from app.database import DB, metadata
from app.integration_reads import read_tool
from app.rate_limits import enforce

router = APIRouter(prefix="/v1/operator-assistant", tags=["Operator assistant"])
runs = Table(
    "operator_runs",
    metadata,
    Column("id", Uuid, primary_key=True, default=uuid4),
    Column("membership_id", ForeignKey("memberships.id"), nullable=False, index=True),
    Column("question", String(500), nullable=False),
    Column("series", String(64)),
    Column("status", String(30), nullable=False),
    Column("result", JSON, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)
checkpoints = Table(
    "operator_checkpoints",
    metadata,
    Column("thread_id", String(36), primary_key=True),
    Column("ns", String(100), primary_key=True),
    Column("checkpoint_id", String(60), primary_key=True),
    Column("parent_id", String(60)),
    Column("kind", String(30), nullable=False),
    Column("payload", LargeBinary, nullable=False),
    Column("meta_kind", String(30), nullable=False),
    Column("meta_payload", LargeBinary, nullable=False),
)
writes_table = Table(
    "operator_checkpoint_writes",
    metadata,
    Column("thread_id", String(36), primary_key=True),
    Column("ns", String(100), primary_key=True),
    Column("checkpoint_id", String(60), primary_key=True),
    Column("task_id", String(60), primary_key=True),
    Column("idx", String(12), primary_key=True),
    Column("channel", String(100), nullable=False),
    Column("kind", String(30), nullable=False),
    Column("payload", LargeBinary, nullable=False),
)


class DatabaseSaver(BaseCheckpointSaver):
    """LangGraph persistence in Alembic-owned tables, without runtime DDL."""

    def __init__(self, engine):
        super().__init__()
        self.engine = engine

    def get_tuple(self, config):
        keys = config["configurable"]
        query = select(checkpoints).where(
            checkpoints.c.thread_id == keys["thread_id"],
            checkpoints.c.ns == keys.get("checkpoint_ns", ""),
        )
        if keys.get("checkpoint_id"):
            query = query.where(checkpoints.c.checkpoint_id == keys["checkpoint_id"])
        with Session(self.engine) as db:
            row = (
                db.execute(query.order_by(checkpoints.c.checkpoint_id.desc()).limit(1))
                .mappings()
                .one_or_none()
            )
            if not row:
                return None
            current = {
                "configurable": {
                    "thread_id": row["thread_id"],
                    "checkpoint_ns": row["ns"],
                    "checkpoint_id": row["checkpoint_id"],
                }
            }
            pending = (
                db.execute(
                    select(writes_table)
                    .where(
                        writes_table.c.thread_id == row["thread_id"],
                        writes_table.c.ns == row["ns"],
                        writes_table.c.checkpoint_id == row["checkpoint_id"],
                    )
                    .order_by(writes_table.c.task_id, writes_table.c.idx)
                )
                .mappings()
                .all()
            )
            parent = (
                {
                    "configurable": {
                        **current["configurable"],
                        "checkpoint_id": row["parent_id"],
                    }
                }
                if row["parent_id"]
                else None
            )
            return CheckpointTuple(
                config=current,
                checkpoint=self.serde.loads_typed((row["kind"], row["payload"])),
                metadata=self.serde.loads_typed(
                    (row["meta_kind"], row["meta_payload"])
                ),
                parent_config=parent,
                pending_writes=[
                    (
                        w["task_id"],
                        w["channel"],
                        self.serde.loads_typed((w["kind"], w["payload"])),
                    )
                    for w in pending
                ],
            )

    def put(self, config, checkpoint, metadata, new_versions):
        keys = config["configurable"]
        kind, payload = self.serde.dumps_typed(checkpoint)
        meta_kind, meta_payload = self.serde.dumps_typed(metadata)
        with Session(self.engine) as db, db.begin():
            db.execute(
                upsert(checkpoints)
                .values(
                    thread_id=keys["thread_id"],
                    ns=keys.get("checkpoint_ns", ""),
                    checkpoint_id=checkpoint["id"],
                    parent_id=keys.get("checkpoint_id"),
                    kind=kind,
                    payload=payload,
                    meta_kind=meta_kind,
                    meta_payload=meta_payload,
                )
                .on_conflict_do_nothing()
            )
        return {
            "configurable": {
                "thread_id": keys["thread_id"],
                "checkpoint_ns": keys.get("checkpoint_ns", ""),
                "checkpoint_id": checkpoint["id"],
            }
        }

    def put_writes(self, config, writes, task_id, task_path=""):
        keys = config["configurable"]
        with Session(self.engine) as db, db.begin():
            for idx, (channel, value) in enumerate(writes):
                kind, payload = self.serde.dumps_typed(value)
                stmt = upsert(writes_table).values(
                    thread_id=keys["thread_id"],
                    ns=keys.get("checkpoint_ns", ""),
                    checkpoint_id=keys["checkpoint_id"],
                    task_id=task_id,
                    idx=str(WRITES_IDX_MAP.get(channel, idx)),
                    channel=channel,
                    kind=kind,
                    payload=payload,
                )
                if channel in WRITES_IDX_MAP:
                    stmt = stmt.on_conflict_do_update(
                        index_elements=[
                            writes_table.c.thread_id,
                            writes_table.c.ns,
                            writes_table.c.checkpoint_id,
                            writes_table.c.task_id,
                            writes_table.c.idx,
                        ],
                        set_={"kind": kind, "payload": payload},
                    )
                else:
                    stmt = stmt.on_conflict_do_nothing()
                db.execute(stmt)


class State(TypedDict, total=False):
    question: str
    series: str | None
    health: list
    outlook: dict
    observations: list
    knowledge: dict
    steps: list[str]
    note: dict
    decision: str


def graph(engine, actor, token, run_id):
    def record(step):
        with Session(engine) as log, log.begin():
            audit(log, actor, "assistant.step", run_id, step=step)

    def health(state):
        result = read_tool("market_data_health", token)
        record("market_data_health")
        return {
            "health": result if isinstance(result, list) else [],
            "steps": ["market_data_health"],
        }

    def outlook(state):
        result = (
            read_tool("get_price_outlook", token, series=state["series"], horizon=14)
            if state.get("series")
            else {"status": "series_required"}
        )
        record("get_price_outlook")
        observations = (
            read_tool("get_market_prices", token, series=state["series"], limit=1)
            if state.get("series")
            else []
        )
        if state.get("series"):
            record("get_market_prices")
        return {
            "outlook": result,
            "observations": observations if isinstance(observations, list) else [],
            "steps": state["steps"]
            + ["get_price_outlook"]
            + (["get_market_prices"] if state.get("series") else []),
        }

    def knowledge(state):
        result = read_tool(
            "ask_peyajflow", token, question=state["question"], locale="bn"
        )
        record("ask_peyajflow")
        return {"knowledge": result, "steps": state["steps"] + ["ask_peyajflow"]}

    def draft(state):
        stale = sum(row.get("status") == "stale" for row in state["health"])
        note = {
            "stale_series": stale,
            "checked_series": len(state["health"]),
            "outlook_status": state["outlook"].get("status", "unavailable"),
            "knowledge": state["knowledge"],
            "cause": "not_established",
            "follow_up": "review_sources_in_app",
            "business_changes": 0,
            "latest_observation": {
                key: state["observations"][0].get(key)
                for key in (
                    "observed_on",
                    "published_on",
                    "low_bdt_kg",
                    "high_bdt_kg",
                    "source_url",
                    "synthetic",
                )
            }
            if state.get("observations")
            else None,
            "outlook": {
                key: state["outlook"].get(key)
                for key in (
                    "status",
                    "horizon_days",
                    "target_on",
                    "low_bdt_kg",
                    "middle_bdt_kg",
                    "high_bdt_kg",
                    "synthetic",
                )
            },
            "comparison": "current_observation_vs_future_scenario"
            if state.get("observations")
            and state["outlook"].get("middle_bdt_kg") is not None
            else "insufficient_data",
        }
        record("draft_note")
        return {"note": note, "steps": state["steps"] + ["draft_note"]}

    def approval(state):
        decision = interrupt(
            {"kind": "note_review", "note": state["note"], "business_changes": 0}
        )
        return {"decision": "approved" if decision == "approve" else "dismissed"}

    builder = StateGraph(State)
    for name, node in (
        ("freshness", health),
        ("forecast", outlook),
        ("knowledge", knowledge),
        ("draft", draft),
        ("review", approval),
    ):
        builder.add_node(name, node)
    sequence = [START, "freshness", "forecast", "knowledge", "draft", "review", END]
    for left, right in zip(sequence, sequence[1:]):
        builder.add_edge(left, right)
    return builder.compile(checkpointer=DatabaseSaver(engine))


class Investigation(Input):
    question: Annotated[str, Field(min_length=3, max_length=500)]
    series: Annotated[str | None, Field(pattern="^[0-9a-f]{64}$")] = None


class Decision(Input):
    decision: Literal["approve", "dismiss"]


def gate(actor):
    require_role(actor, Role.ADMIN)
    if not actor.verified:
        raise HTTPException(403, "role_forbidden")


@router.get("/runs")
def history(actor: Actor, db: DB):
    gate(actor)
    return list(
        db.execute(
            select(runs)
            .where(runs.c.membership_id == actor.membership_id)
            .order_by(runs.c.created_at.desc())
            .limit(20)
        ).mappings()
    )


@router.post("/runs", status_code=201)
def investigate(body: Investigation, actor: Actor, db: DB, request: Request):
    gate(actor)
    enforce(db, "assistant", str(actor.membership_id), limit=15, seconds=3600)
    run_id = uuid4()
    db.execute(
        insert(runs).values(
            id=run_id,
            membership_id=actor.membership_id,
            question=body.question,
            series=body.series,
            status="running",
            result={},
        )
    )
    audit(db, actor, "assistant.started", run_id)
    db.commit()
    workflow = graph(
        db.get_bind(),
        actor,
        request.headers["authorization"].removeprefix("Bearer "),
        run_id,
    )
    config = {"configurable": {"thread_id": str(run_id)}}
    result = workflow.invoke(body.model_dump(), config)
    output = {"note": result.get("note", {}), "steps": result.get("steps", [])}
    db.execute(
        update(runs)
        .where(runs.c.id == run_id)
        .values(status="awaiting_review", result=output)
    )
    db.commit()
    return {"id": run_id, "status": "awaiting_review", **output}


@router.post("/runs/{run_id}/review")
def review(run_id: UUID, body: Decision, actor: Actor, db: DB, request: Request):
    gate(actor)
    row = (
        db.execute(
            select(runs)
            .where(runs.c.id == run_id, runs.c.membership_id == actor.membership_id)
            .with_for_update()
        )
        .mappings()
        .one_or_none()
    )
    if not row:
        raise HTTPException(404, "assistant_run_not_found")
    if row["status"] != "awaiting_review":
        return {"id": run_id, "status": row["status"], **row["result"]}
    workflow = graph(
        db.get_bind(),
        actor,
        request.headers["authorization"].removeprefix("Bearer "),
        run_id,
    )
    result = workflow.invoke(
        Command(resume=body.decision), {"configurable": {"thread_id": str(run_id)}}
    )
    status = result["decision"]
    db.execute(update(runs).where(runs.c.id == run_id).values(status=status))
    audit(db, actor, "assistant.reviewed", run_id, decision=status)
    db.commit()
    return {"id": run_id, "status": status, **row["result"]}
