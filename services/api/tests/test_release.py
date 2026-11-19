import os
from datetime import UTC, datetime
from urllib.parse import urlencode
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_pilot import login, new_lot, new_offer, reply
from test_pilot import pilot as pilot

from app import notifications as alerts
from app import telephony, twilio
from app.auth import Role, demo_id
from app.credentials import provision, rotate

requires_db = pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"), reason="needs disposable PostgreSQL"
)
ORIGIN = "https://pilot.example.invalid"
SID = "AC" + "a" * 32
SECRET = "fixture-signature-secret"


def provider_env(monkeypatch, *, voice=False, sms=False):
    monkeypatch.setenv("PUBLIC_API_ORIGIN", ORIGIN)
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", SID)
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", SECRET)
    if voice:
        monkeypatch.setenv("TELEPHONY_PROVIDER", "twilio")
    if sms:
        monkeypatch.setenv("SMS_PROVIDER", "twilio")
        monkeypatch.setenv("TWILIO_MESSAGING_SERVICE_SID", "MG" + "b" * 32)


def callback(client, path, *, valid=True, **fields):
    fields = {"AccountSid": SID, **fields}
    signature = twilio.signature(
        ORIGIN + path, {key: [value] for key, value in fields.items()}, SECRET
    )
    return client.post(
        path,
        content=urlencode(fields),
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Twilio-Signature": signature if valid else "a" * 27 + "=",
        },
    )


def test_provider_documented_signature_and_quiet_hours():
    values = {
        "Digits": ["1234"],
        "To": ["+18005551212"],
        "From": ["+14158675310"],
        "Caller": ["+14158675310"],
        "CallSid": ["CA1234567890ABCDE"],
    }
    assert (
        twilio.signature("https://example.com/myapp.php?foo=1&bar=2", values, "12345")
        == "L/OH5YylLD5NRKLltdqwSvS0BnU="
    )
    assert alerts.resume_after(
        datetime(2026, 11, 12, 17, tzinfo=UTC), 22, 7
    ) == datetime(2026, 11, 13, 1, tzinfo=UTC)
    instant = datetime(2026, 11, 13, 1, tzinfo=UTC)
    assert alerts.resume_after(instant, 22, 7) == instant


@requires_db
def test_carrier_signature_retry_and_terminal_state(pilot, monkeypatch):
    client, engine, _ = pilot
    path = "/v1/webhooks/telephony/twilio"
    call = "CA" + uuid4().hex
    assert callback(client, path, CallSid=call).status_code == 404
    provider_env(monkeypatch, voice=True)
    assert callback(client, path, CallSid=call, valid=False).status_code == 403
    assert (
        callback(client, path, CallSid=call, AccountSid="AC" + "c" * 32).status_code
        == 403
    )
    first = callback(client, path, CallSid=call, From="+8801700000000")
    retry = callback(client, path, CallSid=call, From="+8801700000000")
    assert first.status_code == retry.status_code == 200 and first.text == retry.text
    assert "<Gather" in first.text and "+8801700000000" not in first.text
    gathered = callback(client, f"{path}/menu", CallSid=call, Digits="2")
    assert "contact an operator" in gathered.text
    assert (
        callback(client, f"{path}/menu", CallSid=call, Digits="1").text == gathered.text
    )
    assert (
        callback(
            client, f"{path}/status", CallSid=call, CallStatus="completed"
        ).status_code
        == 204
    )
    assert (
        callback(
            client, f"{path}/status", CallSid=call, CallStatus="ringing"
        ).status_code
        == 204
    )
    with Session(engine) as db:
        ref = twilio.fingerprint(call)
        assert (
            db.scalar(
                select(telephony.calls.c.status).where(
                    telephony.calls.c.reference == ref
                )
            )
            == "completed"
        )
        assert (
            db.scalar(
                select(func.count())
                .select_from(twilio.events)
                .where(twilio.events.c.reference == ref)
            )
            == 4
        )


@requires_db
def test_transactional_alerts_read_state_and_dispute_resolution(pilot):
    client, _, _ = pilot
    farmer, buyer, admin = [login(client, key) for key in ("farmer", "buyer", "admin")]
    lot = new_lot(client, farmer)
    offer = new_offer(client, buyer, lot, 200)
    inbox = "/v1/notifications"
    alerts_for_lot = [
        item
        for item in client.get(inbox, headers=farmer).json()["items"]
        if item["resource_id"] == offer["id"]
    ]
    assert len(alerts_for_lot) == 1 and alerts_for_lot[0]["kind"] == "offer.sent"
    alert = f"{inbox}/{alerts_for_lot[0]['id']}/read"
    assert client.post(alert, headers=buyer).status_code == 404
    assert client.post(alert, headers=farmer).status_code == 204
    assert any(
        item["read_at"]
        for item in client.get(inbox, headers=farmer).json()["items"]
        if item["id"] == alerts_for_lot[0]["id"]
    )
    payload = reply(offer)
    accept = f"/v1/offers/{offer['id']}/respond"
    order = client.post(accept, headers=farmer, json=payload).json()["order_id"]
    assert client.post(accept, headers=farmer, json=payload).json()["order_id"] == order
    records = client.get(inbox, headers=buyer).json()["items"]
    assert (
        len(
            [
                row
                for row in records
                if row["resource_id"] == order and row["kind"] == "order.confirmed"
            ]
        )
        == 1
    )
    assert client.post(f"{inbox}/read-all", headers=buyer).status_code == 204
    assert client.get(inbox, headers=buyer).json()["unread"] == 0
    transition = f"/v1/orders/{order}/transition"
    for actor, action in [(farmer, "dispatch"), (buyer, "dispute")]:
        response = client.post(
            transition,
            headers=actor,
            json={"action": action, "request_key": str(uuid4()), "confirm": True},
        )
        assert response.status_code == 200, response.text
    assert client.get("/v1/admin/overview", headers=farmer).status_code == 403
    summary = client.get("/v1/admin/overview", headers=admin)
    assert summary.status_code == 200, summary.text
    assert summary.json()["open_disputes"] >= 1
    assert any(
        row["id"] == order
        for row in client.get("/v1/admin/disputes", headers=admin).json()
    )
    resolve = f"/v1/admin/disputes/{order}/resolve"
    body = {"confirmed": True, "note": "Private resolution evidence fixture"}
    assert client.post(resolve, headers=buyer, json=body).status_code == 403
    resolved = client.post(resolve, headers=admin, json=body)
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["restored_status"] == "dispatched"
    assert client.post(resolve, headers=admin, json=body).json() == resolved.json()
    assert (
        client.get(f"/v1/orders/{order}", headers=buyer).json()["status"]
        == "dispatched"
    )
    audit = client.get(
        "/v1/admin/audit",
        headers=admin,
        params={"action": "order.", "resource_id": order},
    )
    assert audit.status_code == 200, audit.text
    assert any(
        row["action"] == "order.dispute_resolved" for row in audit.json()["items"]
    )
    assert all(
        set(row) == {"id", "action", "actor_role", "resource_id", "recorded_at"}
        for row in audit.json()["items"]
    )
    assert body["note"] not in audit.text
    account = str(demo_id("membership", "farmer-two"))
    verify = f"/v1/admin/verifications/{account}"
    assert (
        client.put(verify, headers=farmer, json={"verified": True}).status_code == 403
    )
    assert (
        client.put(verify, headers=admin, json={"verified": True}).json()["verified"]
        is True
    )
    assert (
        client.put(verify, headers=admin, json={"verified": False}).json()["verified"]
        is False
    )


def account(client, engine, *, phone=None):
    username = f"tester-{uuid4().hex}"
    password = "temporary release fixture passphrase"
    with Session(engine) as db, db.begin():
        provision(
            db,
            username,
            password,
            role=Role.FARMER,
            name="Test account",
            district="Pabna",
            organization="Fixture",
            phone=phone,
        )
    response = client.post(
        "/v1/auth/password", json={"username": username, "password": password}
    )
    assert response.status_code == 201, response.text
    auth = {"Authorization": f"Bearer {response.json()['token']}"}
    return username, password, auth


@requires_db
def test_sms_opt_in_retries_status_and_stop(pilot, monkeypatch):
    client, engine, _ = pilot
    provider_env(monkeypatch, sms=True)
    phone = f"+88017{uuid4().int % 100_000_000:08d}"
    _, _, auth = account(client, engine, phone=phone)
    member = UUID(client.get("/v1/me", headers=auth).json()["membership_id"])
    preferences = "/v1/notifications/preferences"
    assert client.put(
        preferences,
        headers=auth,
        json={"sms_enabled": True, "quiet_start": 0, "quiet_end": 0},
    ).json()["sms_enabled"]
    sid = "SM" + uuid4().hex
    invocations = []

    def sender(_config, _sender, recipient):
        invocations.append(recipient)
        return "accepted", twilio.fingerprint(sid)

    monkeypatch.setattr(alerts, "send_sms", sender)
    reference = uuid4()
    with Session(engine) as db, db.begin():
        alerts.publish(db, [member], "order.confirmed", "order", reference)
        alerts.publish(db, [member], "order.confirmed", "order", reference)
    alerts.process_deliveries(engine)
    alerts.process_deliveries(engine)
    assert invocations == [phone]
    path = "/v1/webhooks/messaging/twilio"
    assert (
        callback(
            client, f"{path}/status", MessageSid=sid, MessageStatus="delivered"
        ).status_code
        == 204
    )
    assert (
        callback(
            client, f"{path}/status", MessageSid=sid, MessageStatus="sent"
        ).status_code
        == 204
    )
    with Session(engine) as db, db.begin():
        assert (
            db.scalar(
                select(alerts.deliveries.c.status).where(
                    alerts.deliveries.c.provider_reference == twilio.fingerprint(sid)
                )
            )
            == "delivered"
        )
        alerts.publish(db, [member], "order.dispatched", "order", reference)
    stop = callback(
        client,
        f"{path}/opt-out",
        MessageSid="SM" + uuid4().hex,
        From=phone,
        OptOutType="STOP",
    )
    assert stop.status_code == 200
    assert client.get(preferences, headers=auth).json()["sms_enabled"] is False
    alerts.process_deliveries(engine)
    assert invocations == [phone]


@requires_db
def test_production_password_rotation_limits_and_redacted_validation(
    pilot, monkeypatch
):
    client, engine, _ = pilot
    username, password, auth = account(client, engine)
    monkeypatch.setenv("APP_ENV", "production")
    assert client.get("/v1/auth/demo").status_code == 404
    assert client.get("/v1/me", headers=auth).status_code == 200
    replacement = "rotated release fixture passphrase"
    with Session(engine) as db, db.begin():
        rotate(db, username, replacement)
    assert client.get("/v1/me", headers=auth).status_code == 401
    assert (
        client.post(
            "/v1/auth/password", json={"username": username, "password": password}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/v1/auth/password",
            json={"username": username.upper(), "password": replacement},
        ).status_code
        == 201
    )
    secret = "PRIVATE-VALIDATION-FIXTURE" * 20
    rejected = client.post(
        "/v1/auth/password", json={"username": username, "password": secret}
    )
    assert rejected.status_code == 422 and secret not in rejected.text
    assert rejected.headers["x-content-type-options"] == "nosniff"
    assert len(rejected.headers["x-request-id"]) == 32
    assert client.post("/v1/auth/password", content="x" * 17000).status_code == 413
    for _ in range(5):
        assert (
            client.post(
                "/v1/auth/password", json={"username": username, "password": "bad"}
            ).status_code
            == 401
        )
    limited = client.post(
        "/v1/auth/password", json={"username": username, "password": replacement}
    )
    assert limited.status_code == 429 and int(limited.headers["retry-after"]) > 0


@requires_db
def test_hosted_account_chooser_requires_code_for_simulated_calls(pilot, monkeypatch):
    client, _, _ = pilot
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("SHOWCASE_ACCESS_KEY", raising=False)
    assert client.get("/v1/auth/demo").status_code == 404
    code = "fixture-portfolio-access-key-only"
    monkeypatch.setenv("SHOWCASE_ACCESS_KEY", code)
    assert client.get("/v1/auth/demo").status_code == 200
    assert client.post("/v1/auth/demo", json={"identity": "admin"}).status_code == 401
    assert (
        client.post(
            "/v1/auth/demo", json={"identity": "admin", "access_key": "invalid"}
        ).status_code
        == 401
    )
    signed_in = client.post(
        "/v1/auth/demo", json={"identity": "admin", "access_key": code}
    )
    assert signed_in.status_code == 201
    headers = {"Authorization": f"Bearer {signed_in.json()['token']}"}
    assert client.get("/v1/admin/overview", headers=headers).status_code == 200
    assert client.post("/v1/voice/calls").status_code == 401
    assert client.post("/v1/voice/calls", headers=headers).status_code == 201
    signed_in = client.post(
        "/v1/auth/demo", json={"identity": "buyer", "access_key": code}
    )
    assert signed_in.status_code == 201
    buyer = {"Authorization": f"Bearer {signed_in.json()['token']}"}
    simulated = client.post("/v1/voice/calls", headers=buyer)
    assert simulated.status_code == 201
    assert simulated.json()["mode"] == "simulation"
    monkeypatch.delenv("SHOWCASE_ACCESS_KEY")
    assert client.get("/v1/me", headers=headers).status_code == 401
