import json
import os
from contextlib import contextmanager
from uuid import uuid4

import pytest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from test_pilot import login
from test_pilot import pilot as pilot

from app import knowledge, knowledge_cache, model_providers
from app.knowledge_import import load_manifest, pdf_sections
from app.knowledge_seed import corpus
from app.knowledge_text import split_passage, token_count


def test_token_chunks_preserve_unicode_and_budget():
    text = "পেঁয়াজ শুকনো রাখুন। Onion storage <|endoftext|>\n" * 120
    pieces = list(split_passage(text, 64))
    assert "".join(pieces) == text
    assert all(0 < token_count(piece) <= 64 for piece in pieces)
    assert all("\ufffd" not in piece for piece in pieces)
    with pytest.raises(ValueError):
        list(split_passage(text, 0))


def test_cache_expiration_eviction_copy_and_abstention(monkeypatch):
    knowledge_cache._entries.clear()
    monkeypatch.setenv("KNOWLEDGE_CACHE_MAX_ENTRIES", "1")
    monkeypatch.setenv("KNOWLEDGE_CACHE_TTL_SECONDS", "5")
    monkeypatch.setattr(knowledge_cache, "monotonic", lambda: 10)
    value = {"status": "answered", "citations": ["one"]}
    knowledge_cache.put("one", value)
    value["citations"].clear()
    assert knowledge_cache.get("one")["citations"] == ["one"]
    knowledge_cache.put("two", {"status": "abstained"})
    assert knowledge_cache.get("two") is None
    knowledge_cache.put("two", {"status": "answered"})
    assert knowledge_cache.get("one") is None
    monkeypatch.setattr(knowledge_cache, "monotonic", lambda: 15)
    assert knowledge_cache.get("two") is None
    knowledge_cache.put("three", value)
    monkeypatch.setenv("KNOWLEDGE_CACHE_ENABLED", "false")
    assert knowledge_cache.get("three") is None
    assert not knowledge_cache._entries


def make_pdf(path, *, blank=False, encrypted=False):
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    if not blank:
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {NameObject("/F1"): writer._add_object(font)}
                )
            }
        )
        stream = DecodedStreamObject()
        stream.set_data(b"BT /F1 12 Tf 20 250 Td (Synthetic public guide.) Tj ET")
        page[NameObject("/Contents")] = writer._add_object(stream)
    if encrypted:
        writer.encrypt("test-password")
    writer.write(path)


def test_pdf_and_manifest_refuse_missing_text_and_untrusted_paths(tmp_path):
    pdf = tmp_path / "guide.pdf"
    make_pdf(pdf)
    assert pdf_sections(pdf) == [
        {"heading": "Page 1", "body": "Synthetic public guide."}
    ]
    record = {
        "id": "synthetic-test",
        "title": "Synthetic test",
        "source_url": "https://example.org/guide",
        "licence": "CC0 test fixture",
        "updated_on": "2026-11-23",
        "language": "en",
        "path": "guide.pdf",
        "public": True,
    }
    manifest = tmp_path / "manifest.json"

    def load(**changes):
        manifest.write_text(json.dumps([{**record, **changes}]), encoding="utf-8")
        return load_manifest(manifest)

    assert load()[0]["sections"][0]["heading"] == "Page 1"
    for changes in (
        {"public": False},
        {"path": "../outside.pdf"},
        {"source_url": "https://secret:password@example.org"},
        {"licence": ""},
    ):
        with pytest.raises(ValueError):
            load(**changes)
    make_pdf(pdf, blank=True)
    with pytest.raises(ValueError, match="scanned"):
        pdf_sections(pdf)
    make_pdf(pdf, encrypted=True)
    with pytest.raises(ValueError, match="Encrypted"):
        pdf_sections(pdf)
    md = tmp_path / "guide.md"
    md.write_text("# First\nPublic text\n## Second\nMore text", encoding="utf-8")
    assert len(load(path="guide.md")[0]["sections"]) == 2


def test_ollama_transport_auth_and_redirect_refusal(monkeypatch):
    monkeypatch.setenv("OLLAMA_BASE_URL", "https://inference.example.org")
    monkeypatch.setenv("OLLAMA_API_KEY", "synthetic-test-key")
    seen = []

    class Opener:
        @contextmanager
        def open(self, request, timeout):
            seen.append((request.full_url, request.get_header("Authorization")))

            class Response:
                def read(self, limit):
                    return b'{"models": []}'

            yield Response()

    monkeypatch.setattr(model_providers, "build_opener", lambda handler: Opener())
    for path, body in [("/api/tags", None), ("/api/chat", {}), ("/api/embed", {})]:
        assert model_providers.ollama_json(path, body) == {"models": []}
    assert all(auth == "Bearer synthetic-test-key" for _, auth in seen)
    assert (
        model_providers.NoRedirect().redirect_request(
            None, None, 302, "", {}, "https://other.example.org"
        )
        is None
    )


database = pytest.mark.skipif(
    not os.getenv("TEST_DATABASE_URL"), reason="disposable PostgreSQL required"
)


@database
def test_context_uses_ollama_reuses_and_rolls_back(pilot, monkeypatch):
    _, engine, _ = pilot
    monkeypatch.setenv("KNOWLEDGE_PROVIDER", "extractive")
    monkeypatch.setattr(knowledge, "embed", lambda text: None)
    calls = []

    def ask(provider, system, passage, **kwargs):
        calls.append(provider)
        return {"context": "Public unit conversion reference."}

    monkeypatch.setattr(knowledge, "ask", ask)
    document = {**corpus()[0], "id": "context-" + uuid4().hex}
    with Session(engine) as db:
        first = knowledge.ingest(db, [document], True, require_context=True)
        assert first["contexts_generated"] > 0
        second = knowledge.ingest(db, [document], True, require_context=True)
        assert second["contexts_generated"] == 0
        assert second["contexts_reused"] == first["chunks"]
        assert set(calls) == {"ollama"}
        monkeypatch.setattr(knowledge, "ask", lambda *args, **kwargs: None)
        changed = {**document, "title": "Uncommitted change"}
        with pytest.raises(ValueError, match="not committed"):
            knowledge.ingest(db, [changed], True, require_context=True)
        db.rollback()
        assert (
            db.scalar(
                select(knowledge.documents.c.title).where(
                    knowledge.documents.c.id == document["id"]
                )
            )
            == document["title"]
        )


@database
def test_answer_cache_invalidation_separation_and_switch(pilot, monkeypatch):
    client, engine, _ = pilot
    knowledge_cache._entries.clear()
    monkeypatch.setenv("EMBEDDING_PROVIDER", "none")
    monkeypatch.setattr(knowledge, "embed", lambda text: None)
    with Session(engine) as db:
        knowledge.ingest(db, corpus()[:1])
    calls = []
    monkeypatch.setattr(
        knowledge,
        "answer",
        lambda *args: (
            calls.append(True)
            or {"status": "answered", "answer": "Public text", "citations": []}
        ),
    )
    farmer = login(client, "farmer")
    other = login(client, "farmer-two")

    def ask(headers=farmer, **params):
        return client.get(
            "/v1/knowledge/answer",
            headers=headers,
            params={"question": "public units", **params},
        )

    assert ask().json()["cached"] is False
    assert ask().json()["cached"] is True
    assert len(calls) == 1
    assert ask(other).json()["cached"] is False
    assert ask(locale="en").json()["cached"] is False
    with Session(engine) as db, db.begin():
        db.execute(
            update(knowledge.chunks)
            .where(knowledge.chunks.c.document_id == corpus()[0]["id"])
            .values(context="Changed public context " + uuid4().hex)
        )
    assert ask().json()["cached"] is False
    monkeypatch.setenv("KNOWLEDGE_ENABLED", "false")
    assert ask().status_code == 503
    monkeypatch.setenv("KNOWLEDGE_ENABLED", "true")
    monkeypatch.setenv("KNOWLEDGE_CACHE_ENABLED", "false")
    before = len(calls)
    ask()
    ask()
    assert len(calls) == before + 2


@database
def test_cost_switches_gate_mutations_keep_opt_out_and_history(pilot, monkeypatch):
    client, _, _ = pilot
    admin, farmer = login(client, "admin"), login(client, "farmer")
    monkeypatch.setenv("AUTOMATION_ENABLED", "false")
    monkeypatch.setenv("OPERATOR_ASSISTANT_ENABLED", "false")
    monkeypatch.setenv("LOCAL_MODEL_PREVIEW_ENABLED", "false")
    for path, body, code in [
        (
            "/v1/automation/jobs/freshness",
            {"request_key": str(uuid4())},
            "automation_disabled",
        ),
        (
            "/v1/automation/imports",
            {
                "request_key": str(uuid4()),
                "label": "test",
                "synthetic": True,
                "csv": "test",
            },
            "automation_disabled",
        ),
        (
            "/v1/operator-assistant/runs",
            {"question": "check prices"},
            "operator_assistant_disabled",
        ),
        (
            f"/v1/operator-assistant/runs/{uuid4()}/review",
            {"decision": "approve"},
            "operator_assistant_disabled",
        ),
        (
            "/v1/integrations/local-preview",
            {"phrase": "help"},
            "local_model_preview_disabled",
        ),
    ]:
        response = client.post(path, headers=admin, json=body)
        assert response.status_code == 503, response.text
        assert response.json()["detail"] == code
    assert (
        client.put(
            "/v1/automation/subscription", headers=farmer, json={"enabled": False}
        ).status_code
        == 200
    )
    assert (
        client.put(
            "/v1/automation/subscription", headers=farmer, json={"enabled": True}
        ).status_code
        == 503
    )
    for path in ["/v1/automation/runs", "/v1/operator-assistant/runs"]:
        assert client.get(path, headers=admin).status_code == 200
