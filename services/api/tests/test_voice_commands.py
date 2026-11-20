import os
from datetime import timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy import insert, update
from sqlalchemy.orm import Session
from test_market_and_voice import batch_payload, observation
from test_pilot import login, new_lot, new_offer
from test_pilot import pilot as pilot
from test_signup import bearer, password_login, registration, staff

from app import advice
from app.auth import Role, audit_log
from app.forecast import ForecastView
from app.lots import lot_events, today
from app.trade import now

requires_database = pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"),
    reason="requires disposable migrated PostgreSQL",
)


def start(client, headers):
    response = client.post("/v1/voice/calls", headers=headers)
    assert response.status_code == 201, response.text
    return f"/v1/voice/calls/{response.json()['id']}"


def say(client, headers, path, phrase, params=None, tool=None):
    body = {"phrase": phrase, "params": params or {}}
    if tool:
        body["tool"] = tool
    return client.post(f"{path}/intent", headers=headers, json=body)


def cancel(client, headers, path, staged):
    return client.post(
        f"{path}/actions/{staged['entry']['id']}/cancel", headers=headers
    )


@requires_database
def test_verified_traders_use_simulator_without_demo_or_showcase(pilot, monkeypatch):
    client, engine, _ = pilot
    demo = login(client, "farmer")
    demo_call = start(client, demo)
    for identity in ("buyer", "agent", "admin"):
        headers = login(client, identity)
        assert client.delete(start(client, headers), headers=headers).status_code == 204
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DEMO_MODE", "false")
    monkeypatch.delenv("SHOWCASE_ACCESS_KEY", raising=False)

    reviewer = staff(client, engine, Role.AGENT)
    unverified_farmer = staff(client, engine, Role.FARMER)
    unverified_buyer = staff(client, engine, Role.BUYER)
    operator = staff(client, engine, Role.ADMIN)

    def verified_signup(role):
        entry = registration(role=role)
        created = client.post("/v1/auth/signup", json=entry)
        assert created.status_code == 201, created.text
        member = created.json()["membership_id"]
        queue = client.get("/v1/auth/verifications", headers=reviewer).json()
        signup = next(row for row in queue if row["membership_id"] == member)
        decision = client.post(
            "/v1/auth/verify",
            headers=reviewer,
            json={"user_id": signup["user_id"], "action": "verify"},
        )
        assert decision.status_code == 204, decision.text
        return bearer(password_login(client, entry))

    farmer = verified_signup("farmer")
    buyer = verified_signup("buyer")
    for actor in (unverified_farmer, unverified_buyer, reviewer, operator):
        assert client.post("/v1/voice/calls", headers=actor).status_code == 403
        assert (
            client.post(
                "/v1/voice/resolve", headers=actor, json={"phrases": ["আমার মজুত"]}
            ).status_code
            == 403
        )

    assert client.get(demo_call, headers=demo).status_code == 401
    assert client.get(demo_call, headers=farmer).status_code == 404
    for actor, phrase, tool in (
        (farmer, "আমার মজুত", "stock"),
        (buyer, "অর্ডার", "orders"),
    ):
        path = start(client, actor)
        preview = client.post(
            "/v1/voice/resolve", headers=actor, json={"phrases": [phrase]}
        )
        assert preview.json()[0]["tool"] == tool
        assert say(client, actor, path, phrase).json()["entry"]["state"] == "answered"

        note = "Fictional production voice support request"
        staged = say(client, actor, path, "সহায়তা", {"note": note}).json()
        assert staged["entry"]["state"] == "pending"
        tasks = "/v1/voice/tasks"
        assert client.get(tasks, headers=actor).json() == []
        confirmed = client.post(
            f"{path}/confirm",
            headers=actor,
            json={"action_id": staged["entry"]["id"], "digits": staged["demo_code"]},
        )
        assert confirmed.json()["state"] == "committed"
        assert [row["note"] for row in client.get(tasks, headers=actor).json()] == [
            note
        ]
        assert client.delete(path, headers=actor).status_code == 204


@requires_database
def test_guards_cancel_and_keypad_feedback_keep_stock_unchanged(pilot):
    client, _, _ = pilot
    farmer, buyer = login(client, "farmer"), login(client, "buyer")
    lot = new_lot(client, farmer, quantity="25", unit="maund", kg_per_maund="40")
    offer = new_offer(client, buyer, lot, 200, price_bdt_kg="45")
    params = {"offer_id": offer["id"], "lot_id": lot, "version": offer["version"]}

    resolved = client.post(
        "/v1/voice/resolve",
        headers=farmer,
        json={"phrases": ["offer ta nibo na", "200 kg offer accept koro"]},
    )
    assert resolved.status_code == 200, resolved.text
    negated, accepted = resolved.json()
    assert (negated["status"], negated["error"]) == ("negated", "voice_negated")
    assert (accepted["tool"], accepted["quantity"], accepted["unit"]) == (
        "accept",
        "200",
        "kg",
    )
    assert (
        client.post("/v1/voice/resolve", headers=farmer, json={"phrases": []})
    ).status_code == 422

    path = start(client, farmer)
    refused = say(client, farmer, path, "অফার গ্রহণ করব না", params)
    assert (refused.status_code, refused.json()["detail"]) == (422, "voice_negated")
    mismatch = say(client, farmer, path, "200 kg offer accept koro", params, "counter")
    assert mismatch.json()["detail"] == "voice_tool_mismatch"
    wrong = say(client, farmer, path, "100 kg offer accept koro", params, "accept")
    assert (wrong.status_code, wrong.json()["detail"]) == (
        409,
        "voice_quantity_mismatch",
    )
    assert client.get(path, headers=farmer).json()["entries"] == []

    staged = say(client, farmer, path, "5 mon er offer ta nibo", params, "accept")
    assert staged.status_code == 200, staged.text
    staged = staged.json()
    assert "200.000 কেজি" in staged["entry"]["readback_bn"]
    # Reads still answer while a change waits; another change is refused.
    assert say(client, farmer, path, "পরিবহন চাই").json()["detail"] == "voice_pending"
    withdrawn = cancel(client, farmer, path, staged)
    assert withdrawn.json()["state"] == "cancelled"
    assert cancel(client, farmer, path, staged).json()["state"] == "cancelled"
    confirm = {"action_id": staged["entry"]["id"], "digits": staged["demo_code"]}
    assert (
        client.post(f"{path}/confirm", headers=farmer, json=confirm).status_code == 409
    )
    assert client.get(f"/v1/lots/{lot}", headers=farmer).json()["reserved_kg"] == (
        "0.000"
    )

    staged = say(client, farmer, path, "অফারটা নিতে চাই", params, "accept").json()
    wrong_digits = "0000" if staged["demo_code"] != "0000" else "1111"
    codes = [
        client.post(
            f"{path}/confirm",
            headers=farmer,
            json={"action_id": staged["entry"]["id"], "digits": wrong_digits},
        ).json()["detail"]
        for _ in range(3)
    ]
    assert codes == [
        "voice_wrong_digits",
        "voice_wrong_digits_last",
        "voice_confirmation_cancelled",
    ]
    entries = client.get(path, headers=farmer).json()["entries"]
    assert entries[-1]["state"] == "cancelled"

    staged = say(client, farmer, path, "অফার গ্রহণ", params, "accept").json()
    confirm = {"action_id": staged["entry"]["id"], "digits": staged["demo_code"]}
    assert (
        client.post(f"{path}/confirm", headers=farmer, json=confirm).json()["state"]
        == "committed"
    )
    assert cancel(client, farmer, path, staged).status_code == 409
    assert client.get(f"/v1/lots/{lot}", headers=farmer).json()["reserved_kg"] == (
        "200.000"
    )
    outsider = login(client, "farmer-two")
    assert cancel(client, outsider, path, staged).status_code == 404


@requires_database
def test_spoken_quantities_are_checked_for_counter_loss_and_buyer_offer(pilot):
    client, _, _ = pilot
    farmer, buyer = login(client, "farmer"), login(client, "buyer")
    lot = new_lot(client, farmer, quantity="1000", listed=True)
    offer = new_offer(client, buyer, lot, 200, price_bdt_kg="45")
    path = start(client, farmer)
    counter = {
        "offer_id": offer["id"],
        "lot_id": lot,
        "version": offer["version"],
        "quantity_kg": "150",
        "price_bdt_kg": "47",
    }
    assert (
        say(client, farmer, path, "পাল্টা অফার ১০০ কেজি", counter).json()["detail"]
        == "voice_quantity_mismatch"
    )
    staged = say(client, farmer, path, "পাল্টা অফার ১৫০ কেজি", counter).json()
    assert "150.000 কেজি" in staged["entry"]["readback_bn"]
    cancel(client, farmer, path, staged)

    loss = {
        "lot_id": lot,
        "event_type": "LOSS_REPORTED",
        "quantity": "-6",
        "unit": "kg",
        "reason": "Sprouted bulbs removed",
    }
    assert (
        say(client, farmer, path, "৫ কেজি পেঁয়াজ পচে গেছে", loss).json()["detail"]
        == "voice_quantity_mismatch"
    )
    staged = say(
        client, farmer, path, "৫ কেজি পেঁয়াজ পচে গেছে", {**loss, "quantity": "-5"}
    ).json()
    assert staged["entry"]["state"] == "pending"
    cancel(client, farmer, path, staged)

    buyer_call = start(client, buyer)
    proposal = {
        "lot_id": lot,
        "quantity_kg": "250",
        "price_bdt_kg": "44",
        "delivery_district": "Dhaka",
        "transport": "buyer",
    }
    assert (
        say(client, buyer, buyer_call, "৩০০ কেজির অফার পাঠান", proposal).json()["detail"]
        == "voice_quantity_mismatch"
    )
    staged = say(
        client,
        buyer,
        buyer_call,
        "৩০০ কেজির অফার পাঠান",
        {**proposal, "quantity_kg": "300"},
    ).json()
    assert "300.000 কেজি" in staged["entry"]["readback_bn"]


@requires_database
def test_prices_ask_for_a_series_and_advice_states_its_loss_basis(pilot, monkeypatch):
    client, engine, _ = pilot
    admin, farmer = login(client, "admin"), login(client, "farmer")
    base = "/v1/admin/data-imports"
    for market in (f"Voice A {uuid4().hex}", f"Voice B {uuid4().hex}"):
        batch = client.post(
            base, headers=admin, json=batch_payload([observation(market)])
        ).json()
        client.post(
            f"{base}/{batch['id']}/review", headers=admin, json={"decision": "approved"}
        )
    series = client.get("/v1/market/series", headers=farmer).json()
    assert len(series) > 1
    path = start(client, farmer)
    assert say(client, farmer, path, "আজকের দর কত").json()["detail"] == (
        "voice_choose_series"
    )
    chosen = next(row for row in series if row["market"].startswith("Voice A"))
    answered = say(
        client, farmer, path, "আজকের দর কত", {"series": chosen["series"]}
    ).json()
    assert answered["entry"]["state"] == "answered"
    assert chosen["market"] in answered["entry"]["readback_bn"]

    # Fix the future range so both lots reach the price comparison.
    monkeypatch.setattr(
        advice,
        "market_forecast",
        lambda *args: ForecastView(
            status="baseline",
            method="last_value",
            horizon_days=7,
            synthetic=True,
            as_of=today(),
            target_on=today() + timedelta(days=7),
            history_count=80,
            low_bdt_kg=Decimal(30),
            middle_bdt_kg=Decimal(36),
            high_bdt_kg=Decimal(42),
            backtest=[],
        ),
    )
    measured = new_lot(
        client,
        farmer,
        harvest_on=(today() - timedelta(days=32)).isoformat(),
        stored_on=(today() - timedelta(days=31)).isoformat(),
    )
    unmeasured = new_lot(client, farmer)
    operator = client.get("/v1/me", headers=admin).json()["membership_id"]
    with Session(engine) as db, db.begin():
        db.execute(
            update(lot_events)
            .where(lot_events.c.lot_id == UUID(measured))
            .values(recorded_at=now() - timedelta(days=31))
        )
        for age, kg in ((21, "1000"), (14, "990"), (0, "930")):
            db.execute(
                insert(audit_log).values(
                    resource_id=UUID(measured),
                    membership_id=UUID(operator),
                    action="lot.verified",
                    context={"verified_kg": kg},
                    recorded_at=now() - timedelta(days=age),
                )
            )

    def read_advice(lot):
        entry = say(
            client,
            farmer,
            path,
            "এখন বিক্রি করব নাকি রাখব",
            {"lot_id": lot, "series": chosen["series"]},
        ).json()["entry"]
        assert entry["state"] == "answered"
        return entry["readback_bn"]

    modeled = read_advice(measured)
    assert "যাচাই করা ওজনের প্রবণতা থেকে আনুমানিক" in modeled
    assert "অপেক্ষায়" in modeled
    manual = read_advice(unmeasured)
    assert "খরচ ও ওজন ক্ষতি শূন্য ধরে তুলনা; ওজনের যথেষ্ট যাচাই নেই" in manual
