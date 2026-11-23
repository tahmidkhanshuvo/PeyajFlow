import os
from typing import Annotated
from urllib.error import URLError
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import Field

from app import features, intent_model, lots, model_providers
from app.auth import Actor, Input, Role, require_role
from app.database import DB
from app.rate_limits import enforce

router = APIRouter(prefix="/v1", tags=["Local models and evidence"])


@router.get("/assistant/chat")
def chat(
    actor: Actor,
    db: DB,
    question: Annotated[str, Query(min_length=1, max_length=500)],
    locale: str = "bn",
):
    from app import intent, knowledge, voice

    enforce(db, "assistant-chat", str(actor.membership_id), limit=60, seconds=3600)
    result = intent.interpret(question)
    if result.status == "resolved" and result.tool in voice.READS:
        # Read services keep their role and ownership checks. A chat message
        # never reaches the voice staging/confirmation or mutation code.
        reply = voice.read_tool(db, actor, result.tool, voice.Lookup())
        return {"answer": reply, "citations": [], "method": "scoped_workspace_read"}
    if result.status == "resolved" and result.tool not in voice.READS:
        return {
            "answer": "এই কাজের শর্ত অ্যাপ বা কল সিমুলেটরে দেখে নিশ্চিত করুন। এখানে কিছু বদলানো হয়নি।"
            if locale == "bn"
            else "Review and confirm this action in the app or call simulator. Nothing was changed here.",
            "citations": [],
            "method": "confirmation_required",
        }
    return knowledge.read_answer(actor, db, question, locale)


@router.get("/integrations/models")
def models(actor: Actor):
    require_role(actor, Role.ADMIN)
    try:
        data = model_providers.ollama_json("/api/tags") or {}
        installed = [
            {"name": row["name"], "size": row.get("size"), "digest": row.get("digest")}
            for row in data.get("models", [])
        ][:30]
    except (URLError, OSError, ValueError, KeyError, TypeError):
        installed = []
    return {
        "runtime": "ollama",
        "available": bool(installed),
        "models": installed,
        "command_model": os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct-q4_K_M"),
        "embedding_model": model_providers.embedding_identity(),
        "knowledge_provider": os.getenv("KNOWLEDGE_PROVIDER", "extractive"),
        "fallback_enabled": intent_model.enabled(),
        "prompt_tuning_active": intent_model.system_prompt() != intent_model.SYSTEM,
        "deployment": "server_local_inference_requires_api_connection",
    }


class Preview(Input):
    phrase: Annotated[str, Field(min_length=1, max_length=200)]
    model: Annotated[str | None, Field(max_length=100)] = None


@router.post("/integrations/local-preview")
def preview(body: Preview, actor: Actor, db: DB):
    require_role(actor, Role.ADMIN)
    features.require("LOCAL_MODEL_PREVIEW_ENABLED", "local_model_preview_disabled")
    enforce(db, "local-preview", str(actor.membership_id), limit=20, seconds=3600)
    runtime = models(actor)
    if not runtime["available"] or (
        body.model and body.model not in {row["name"] for row in runtime["models"]}
    ):
        raise HTTPException(503, "local_model_unavailable")
    from time import perf_counter

    start = perf_counter()
    result = intent_model.understand(
        body.phrase,
        ask=lambda phrase: model_providers.ask(
            "ollama", intent_model.SYSTEM, phrase, model=body.model
        ),
    )
    return {
        "status": result.status,
        "tool": result.tool,
        "quantity": str(result.quantity) if result.quantity is not None else None,
        "unit": result.unit,
        "reason": result.reason,
        "match": result.match,
        "elapsed_ms": round((perf_counter() - start) * 1000),
        "business_changes": 0,
    }


@router.get("/lots/{lot_id}/weight-history")
def weight_history(lot_id: UUID, actor: Actor, db: DB):
    from math import exp, log
    from statistics import linear_regression

    from app.loss_model import comparable_weights, estimate_loss

    lot = lots.get_lot(db, actor, lot_id)
    weights = comparable_weights(db, lot_id, lot["stored_on"], lots.today())
    estimate = estimate_loss(weights, lots.today(), 7)
    points = sorted(weights.items())
    fit = (
        linear_regression(
            [(day - points[0][0]).days for day, _ in points],
            [log(float(weight)) for _, weight in points],
        )
        if estimate
        else None
    )
    return {
        "status": "experimental_fit" if fit else "insufficient_comparable_weights",
        "readings": [
            {
                "recorded_at": day.isoformat(),
                "verified_kg": str(weight),
                "fitted_kg": round(
                    exp(fit.intercept + fit.slope * (day - points[0][0]).days), 2
                )
                if fit
                else None,
            }
            for day, weight in points
        ],
    }
