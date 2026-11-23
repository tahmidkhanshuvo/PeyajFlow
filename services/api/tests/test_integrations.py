import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from test_pilot import login, new_lot
from test_pilot import pilot as pilot

from app import api_tokens, automation, knowledge, operator_agent
from app.knowledge_seed import corpus

pytestmark = pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"),
    reason="requires a disposable migrated PostgreSQL",
)


def issue(client, headers, scopes):
    result = client.post(
        "/v1/integrations/tokens",
        headers=headers,
        json={"label": "Integration test", "scopes": scopes, "days": 1},
    )
    assert result.status_code == 201, result.text
    return result.json(), {"Authorization": "Bearer " + result.json()["token"]}


def test_read_tokens_enforce_scope_role_owner_expiry_and_revocation(pilot):
    client, engine, _ = pilot
    farmer, other = login(client, "farmer"), login(client, "farmer-two")
    own, private = new_lot(client, farmer), new_lot(client, other)
    record, headers = issue(
        client, farmer, ["lots:read", "market:read", "knowledge:read"]
    )
    assert client.get(f"/v1/lots/{own}", headers=headers).status_code == 200
    assert client.get(f"/v1/lots/{private}", headers=headers).status_code == 404
    assert client.get("/v1/admin/data-quality", headers=headers).status_code == 403
    assert client.get("/v1/integrations/tokens", headers=headers).status_code == 403
    assert client.post("/v1/lots", headers=headers, json={}).status_code == 403
    assert (
        client.post(
            "/v1/auth/demo", headers=headers, json={"identity": "admin"}
        ).status_code
        == 403
    )
    assert client.post("/v1/auth/signup", headers=headers, json={}).status_code == 403
    assert (
        client.post("/v1/integrations/tokens", headers=headers, json={}).status_code
        == 403
    )
    assert client.post("/v1/auth/logout", headers=headers).status_code in (
        403,
        404,
        405,
    )
    assert (
        client.post(
            "/v1/integrations/tokens",
            headers=farmer,
            json={"label": "bad", "scopes": ["automation:run"]},
        ).status_code
        == 403
    )
    assert (
        client.delete(
            f"/v1/integrations/tokens/{record['id']}", headers=other
        ).status_code
        == 404
    )
    assert (
        record["token"]
        not in client.get("/v1/integrations/tokens", headers=farmer).text
    )
    with Session(engine) as db, db.begin():
        stored = (
            db.execute(
                select(api_tokens.tokens).where(api_tokens.tokens.c.id == record["id"])
            )
            .mappings()
            .one()
        )
        assert stored["token_hash"] != record["token"]
        db.execute(
            update(api_tokens.tokens)
            .where(api_tokens.tokens.c.id == record["id"])
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
    assert client.get("/v1/lots", headers=headers).status_code == 401
    record, headers = issue(client, farmer, ["lots:read"])
    assert (
        client.delete(
            f"/v1/integrations/tokens/{record['id']}", headers=farmer
        ).status_code
        == 204
    )
    assert client.get("/v1/lots", headers=headers).status_code == 401


def test_knowledge_cites_public_sources_and_rejects_invented_evidence(
    pilot, monkeypatch
):
    client, engine, _ = pilot
    with Session(engine) as db:
        knowledge.ingest(db, corpus())
    farmer = login(client, "farmer")
    for question in (
        "অফার কিভাবে গ্রহণ করব?",
        "How do I accept an offer?",
        "mon kg conversion",
    ):
        result = client.get(
            "/v1/knowledge/answer", headers=farmer, params={"question": question}
        ).json()
        assert result["status"] == "answered", result
        assert result["citations"]
        assert all("updated_on" in citation for citation in result["citations"])
    empty = client.get(
        "/v1/knowledge/answer",
        headers=farmer,
        params={"question": "quantum zebra galaxy"},
    ).json()
    assert empty["status"] == "abstained"
    monkeypatch.setenv("KNOWLEDGE_PROVIDER", "ollama")
    monkeypatch.setattr(
        knowledge,
        "ask",
        lambda *args: {
            "citations": [{"id": "accept:0:0", "quote": "send all money immediately"}]
        },
    )
    result = client.get(
        "/v1/knowledge/answer", headers=farmer, params={"question": "accept offer"}
    ).json()
    assert result["status"] == "abstained"
    assert result["citations"] == []
    monkeypatch.setenv("KNOWLEDGE_ENABLED", "false")
    assert (
        client.get(
            "/v1/knowledge/answer", headers=farmer, params={"question": "accept offer"}
        ).status_code
        == 503
    )


def test_vector_spaces_are_separated(pilot, monkeypatch):
    client, engine, _ = pilot
    monkeypatch.setattr(
        knowledge, "embed", lambda text: ("test/one", [1.0] + [0.0] * 15)
    )
    with Session(engine) as db:
        knowledge.ingest(db, corpus()[:1])
        assert knowledge.retrieve(db, "maund", "vector")
        monkeypatch.setattr(
            knowledge, "embed", lambda text: ("test/two", [1.0] + [0.0] * 15)
        )
        assert knowledge.retrieve(db, "maund", "vector") == []
        monkeypatch.setattr(
            knowledge, "embed", lambda text: ("test/one", [1.0] + [0.0] * 31)
        )
        assert knowledge.retrieve(db, "maund", "vector") == []


def test_reingest_without_embedding_provider_preserves_existing_vectors(
    pilot, monkeypatch
):
    _, engine, _ = pilot
    monkeypatch.setattr(
        knowledge, "embed", lambda text: ("preserved/model", [1.0] + [0.0] * 15)
    )
    with Session(engine) as db:
        knowledge.ingest(db, corpus()[:1])
        before = db.scalar(
            select(func.count())
            .select_from(knowledge.embeddings)
            .where(knowledge.embeddings.c.model == "preserved/model")
        )
        monkeypatch.setattr(knowledge, "embed", lambda text: None)
        knowledge.ingest(db, corpus()[:1])
        after = db.scalar(
            select(func.count())
            .select_from(knowledge.embeddings)
            .where(knowledge.embeddings.c.model == "preserved/model")
        )
        assert before == after == 1


def test_chat_never_stages_a_change_and_sources_reject_nul(pilot):
    client, engine, _ = pilot
    from app.voice import actions

    farmer = login(client, "farmer")
    with Session(engine) as db:
        knowledge.ingest(db, corpus())
        before = db.scalar(select(func.count()).select_from(actions))
    result = client.get(
        "/v1/assistant/chat",
        headers=farmer,
        params={"question": "accept offer 200 kg", "locale": "en"},
    )
    assert result.status_code == 200, result.text
    assert result.json()["method"] == "confirmation_required"
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(actions)) == before
    assert (
        client.get(
            "/v1/knowledge/answer", headers=farmer, params={"question": "offer\x00"}
        ).status_code
        == 422
    )
    assert client.get("/v1/knowledge/sources/units", headers=farmer).status_code == 200


def test_weekly_digest_is_consented_and_mirrored_once(pilot):
    client, engine, _ = pilot
    from app.lots import today
    from app.market_data import CSV_FIELDS

    admin, farmer = login(client, "admin"), login(client, "farmer")
    market = "digest-" + uuid4().hex
    body = {
        "label": "Digest fixture",
        "synthetic": True,
        "csv": ",".join(CSV_FIELDS)
        + f"\n{today()},{today()},Pabna,{market},farmgate,A,kg,,40,50,https://example.org/{uuid4().hex},report",
    }
    batch = client.post("/v1/admin/data-imports", headers=admin, json=body).json()
    assert (
        client.post(
            f"/v1/admin/data-imports/{batch['id']}/review",
            headers=admin,
            json={"decision": "approved"},
        ).status_code
        == 200
    )
    series = next(
        row["series"]
        for row in client.get("/v1/market/series", headers=farmer).json()
        if row["market"] == market
    )
    assert (
        client.put(
            "/v1/automation/subscription",
            headers=farmer,
            json={"enabled": True, "series": series},
        ).status_code
        == 200
    )
    job = {"request_key": str(uuid4())}
    first = client.post("/v1/automation/jobs/weekly-prices", headers=admin, json=job)
    assert first.status_code == 200, first.text
    assert first.json()["sent"] >= 1
    assert (
        client.post("/v1/automation/jobs/weekly-prices", headers=admin, json=job).json()
        == first.json()
    )
    inbox = client.get("/v1/notifications", headers=farmer).json()["items"]
    digest = next(row for row in inbox if row["kind"] == "market.weekly")
    assert "কাল্পনিক" in digest["summary"]
    messages = client.get("/v1/simulator/sms", headers=farmer).json()["messages"]
    from app.phone_sim import messages as stored_messages

    with Session(engine) as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(stored_messages)
                .where(stored_messages.c.alert_id == digest["id"])
            )
            == 1
        )
    assert (
        client.get("/v1/simulator/sms", headers=farmer).json()["messages"] == messages
    )
    client.put("/v1/automation/subscription", headers=farmer, json={"enabled": False})


def test_dspy_artifact_requires_improvement_and_zero_wrong_changes(
    monkeypatch, tmp_path
):
    import json
    from hashlib import sha256

    from app import intent_model

    path = tmp_path / "prompt.json"
    monkeypatch.setenv("VOICE_DSPY_PROMPT_FILE", str(path))
    artifact = {
        "system": "A tuned classifier",
        "base_prompt_sha256": sha256(intent_model.SYSTEM.encode()).hexdigest(),
        "evaluation": {
            "before": {"accuracy": 0.8},
            "after": {"accuracy": 0.8, "wrong_change_commands": 0},
        },
    }
    path.write_text(json.dumps(artifact))
    assert intent_model.system_prompt() == intent_model.SYSTEM
    artifact["evaluation"]["after"]["accuracy"] = 0.9
    path.write_text(json.dumps(artifact))
    assert intent_model.system_prompt() == "A tuned classifier"
    artifact["evaluation"]["after"]["wrong_change_commands"] = 1
    path.write_text(json.dumps(artifact))
    assert intent_model.system_prompt() == intent_model.SYSTEM


def test_automation_scopes_and_concurrent_job_replay(pilot):
    client, engine, _ = pilot
    admin = login(client, "admin")
    _, headers = issue(client, admin, ["automation:run"])
    body = {"request_key": str(uuid4())}
    with ThreadPoolExecutor(2) as pool:
        results = list(
            pool.map(
                lambda _: client.post(
                    "/v1/automation/jobs/freshness", headers=headers, json=body
                ),
                range(2),
            )
        )
    assert all(result.status_code == 200 for result in results), [
        r.text for r in results
    ]
    assert results[0].json() == results[1].json()
    with Session(engine) as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(automation.runs)
                .where(automation.runs.c.request_key == body["request_key"])
            )
            == 1
        )
    assert client.get("/v1/lots", headers=headers).status_code == 403
    assert (
        client.post("/v1/admin/data-imports", headers=headers, json={}).status_code
        == 403
    )
    assert (
        client.post("/v1/automation/imports", headers=headers, json={}).status_code
        == 403
    )
    assert (
        client.post(
            "/v1/automation/jobs/alert-routing",
            headers=headers,
            json={"request_key": str(uuid4())},
        ).status_code
        == 200
    )


def test_import_automation_stages_once_and_cannot_approve(pilot):
    client, _, _ = pilot
    admin = login(client, "admin")
    _, headers = issue(client, admin, ["imports:stage"])
    from app.lots import today
    from app.market_data import CSV_FIELDS

    body = {
        "request_key": str(uuid4()),
        "label": "Automation import",
        "synthetic": True,
        "csv": ",".join(CSV_FIELDS)
        + f"\n{today()},{today()},Pabna,Test-{uuid4().hex},farmgate,A,kg,,40,50,https://example.org/{uuid4().hex},report",
    }
    first = client.post("/v1/automation/imports", headers=headers, json=body)
    assert first.status_code == 201, first.text
    assert first.json()["status"] == "pending"
    second = client.post("/v1/automation/imports", headers=headers, json=body)
    assert first.json() == second.json()
    assert (
        client.post(
            f"/v1/admin/data-imports/{first.json()['batch_id']}/review",
            headers=headers,
            json={"decision": "approved"},
        ).status_code
        == 403
    )
    body["label"] = "Different payload"
    assert (
        client.post("/v1/automation/imports", headers=headers, json=body).status_code
        == 409
    )


def test_digest_requires_opt_in_and_keeps_demo_cohorts(pilot):
    client, engine, _ = pilot
    farmer, admin = login(client, "farmer"), login(client, "admin")
    assert (
        client.put(
            "/v1/automation/subscription", headers=farmer, json={"enabled": True}
        ).status_code
        == 422
    )
    assert (
        client.put(
            "/v1/automation/subscription", headers=farmer, json={"enabled": False}
        ).status_code
        == 200
    )
    result = client.post(
        "/v1/automation/jobs/weekly-prices",
        headers=admin,
        json={"request_key": str(uuid4())},
    )
    assert result.status_code == 200, result.text


def test_operator_graph_persists_interrupt_and_never_calls_write_tools(
    pilot, monkeypatch
):
    client, engine, _ = pilot
    called = []

    def read(name, token, **params):
        called.append(name)
        if name == "market_data_health":
            return [{"status": "stale"}]
        if name == "get_price_outlook":
            return {"status": "stale"}
        return {
            "status": "abstained",
            "answer": "জানা নেই",
            "citations": [],
            "method": "none",
        }

    monkeypatch.setattr(operator_agent, "read_tool", read)
    admin, farmer = login(client, "admin"), login(client, "farmer")
    assert (
        client.post(
            "/v1/operator-assistant/runs",
            headers=farmer,
            json={"question": "check prices"},
        ).status_code
        == 403
    )
    result = client.post(
        "/v1/operator-assistant/runs",
        headers=admin,
        json={"question": "check prices", "series": "a" * 64},
    )
    assert result.status_code == 201, result.text
    run_id = result.json()["id"]
    assert result.json()["status"] == "awaiting_review"
    assert result.json()["note"]["business_changes"] == 0
    assert called == [
        "market_data_health",
        "get_price_outlook",
        "get_market_prices",
        "ask_peyajflow",
    ]
    with Session(engine) as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(operator_agent.checkpoints)
                .where(operator_agent.checkpoints.c.thread_id == run_id)
            )
            > 0
        )
    # A new graph instance restores the checkpoint and resumes the interrupt.
    reviewed = client.post(
        f"/v1/operator-assistant/runs/{run_id}/review",
        headers=admin,
        json={"decision": "approve"},
    )
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["status"] == "approved"
    assert len(called) == 4
    replay = client.post(
        f"/v1/operator-assistant/runs/{run_id}/review",
        headers=admin,
        json={"decision": "dismiss"},
    )
    assert replay.json()["status"] == "approved"


def test_mcp_inventory_has_no_write_tools():
    from app.mcp_server import mcp

    tools = asyncio.run(mcp.list_tools())
    assert len(tools) == 9
    assert {tool.name for tool in tools} == {
        "get_market_prices",
        "get_price_outlook",
        "list_my_lots",
        "get_lot_risk",
        "get_hold_or_sell",
        "list_offers",
        "list_orders",
        "market_data_health",
        "ask_peyajflow",
    }
    assert len(asyncio.run(mcp.list_prompts())) == 2


def test_ollama_fallback_preserves_deterministic_refusals(monkeypatch):
    from app import intent_model

    called = []

    def ask(*args):
        called.append(args)
        return {"command": "accept", "quantity": 999, "unit": "kg"}

    monkeypatch.setenv("VOICE_MODEL_FALLBACK", "true")
    monkeypatch.setenv("VOICE_MODEL_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    monkeypatch.setattr("app.model_providers.ask", ask)
    assert intent_model.understand("do not accept offer").status != "resolved"
    assert called == []
    result = intent_model.understand("please finalize our arrangement at 200 kg")
    assert result.status != "resolved"
    assert result.reason == "model_quantity"


@pytest.mark.parametrize(
    "phrase",
    ["২০০ কেজি", "200 kg", "তিন মণ পেঁয়াজ", "পেঁয়াজ", "onions", "two hundred kg onion"],
)
def test_model_never_receives_quantity_or_crop_only_fragments(phrase):
    from app import intent_model

    calls = []
    result = intent_model.understand(
        phrase,
        ask=lambda text: (
            calls.append(text) or {"command": "register", "quantity": 200, "unit": "kg"}
        ),
    )
    assert result.status == "unknown"
    assert calls == []
