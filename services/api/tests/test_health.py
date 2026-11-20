import os
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.main import DatabaseStatus, app, check_database


def test_liveness_and_unconfigured_readiness(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with TestClient(app) as client:
        live = client.get("/health/live")
        assert live.status_code == 200
        assert live.json() == {"status": "ok"}

        ready = client.get("/health/ready")
        assert ready.status_code == 503
        assert ready.json() == {"database": "unconfigured"}


def test_readiness_when_connection_fails() -> None:
    engine = MagicMock()
    engine.connect.side_effect = OperationalError("connect", {}, Exception("offline"))
    assert (
        check_database(engine, frozenset({"0001_foundation"}))
        == DatabaseStatus.UNREACHABLE
    )


@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="requires a migrated PostgreSQL"
)
def test_migrated_database_readiness() -> None:
    with TestClient(app) as client:
        ready = client.get("/health/ready")
        assert ready.status_code == 200
        assert ready.json() == {"database": "ready"}

        app.state.migration_heads = frozenset({"unapplied"})
        stale = client.get("/health/ready")
        assert stale.status_code == 503
        assert stale.json() == {"database": "migration_required"}


def test_request_bodies_with_nul_characters_are_refused():
    from pydantic import ValidationError

    from app.auth import Input

    class Body(Input):
        note: str
        params: dict = {}

    assert Body(note="fine", params={"a": ["ok"]}).note == "fine"
    for bad in (
        {"note": "a\x00b"},
        {"note": "ok", "params": {"k": "v\x00"}},
        {"note": "ok", "params": {"k\x00": "v"}},
        {"note": "ok", "params": {"k": ["x", "\x00"]}},
    ):
        try:
            Body.model_validate(bad)
        except ValidationError:
            continue
        raise AssertionError(f"accepted {bad!r}")
