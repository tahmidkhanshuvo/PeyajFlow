import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from io import BytesIO
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.auth import audit_log, fingerprint, seed_demo, sessions
from app.database import database_engine
from app.lots import lot_events, today
from app.main import app
from app.trade import orders, sweep_expired

pytestmark = pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"),
    reason="requires a disposable migrated PostgreSQL",
)


@pytest.fixture
def pilot(monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("PHOTO_STORAGE", "local")
    monkeypatch.setenv("PHOTO_DIR", str(tmp_path))
    engine = database_engine()
    assert engine is not None
    try:
        with Session(engine) as db, db.begin():
            seed_demo(db)
        with TestClient(app) as client:
            yield client, engine, tmp_path
    finally:
        engine.dispose()


def login(client, identity):
    result = client.post("/v1/auth/demo", json={"identity": identity})
    assert result.status_code == 201, result.text
    return {"Authorization": f"Bearer {result.json()['token']}"}


def lot_input(**changes):
    return {
        "label": f"Sujanagar {uuid4().hex[:8]}",
        "district": "Pabna",
        "variety": "Taherpuri",
        "storage_type": "Ventilated shed",
        "harvest_on": (today() - timedelta(days=8)).isoformat(),
        "stored_on": (today() - timedelta(days=7)).isoformat(),
        "grade": "A",
        "listed": True,
        "quantity": "1000",
        "unit": "kg",
        "request_key": str(uuid4()),
        **changes,
    }


def new_lot(client, farmer, **changes):
    response = client.post("/v1/lots", headers=farmer, json=lot_input(**changes))
    assert response.status_code == 201, response.text
    return response.json()["id"]


def new_offer(client, buyer, lot_id, quantity, **changes):
    response = client.post(
        "/v1/offers",
        headers=buyer,
        json={
            "lot_id": lot_id,
            "quantity_kg": str(quantity),
            "price_bdt_kg": "45.55",
            "delivery_district": "Dhaka",
            "transport": "buyer",
            "request_key": str(uuid4()),
            **changes,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def reply(offer, action="accept", **changes):
    return {
        "version": offer["version"],
        "action": action,
        "confirm": True,
        "request_key": str(uuid4()),
        **changes,
    }


def test_demo_auth_roles_and_expiry(pilot, monkeypatch):
    client, engine, _ = pilot
    assert client.get("/v1/me").status_code == 401
    auth = login(client, "buyer")
    assert client.get("/v1/me", headers=auth).json()["role"] == "buyer"
    assert client.post("/v1/lots", headers=auth, json=lot_input()).status_code == 403
    token = auth["Authorization"].removeprefix("Bearer ")
    with Session(engine) as db, db.begin():
        row = (
            db.execute(
                select(sessions).where(sessions.c.token_hash == fingerprint(token))
            )
            .mappings()
            .one()
        )
        assert row["token_hash"] != token
        db.execute(
            update(sessions)
            .where(sessions.c.token_hash == fingerprint(token))
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
    assert client.get("/v1/me", headers=auth).status_code == 401
    active = login(client, "agent")
    assert client.delete("/v1/auth/session", headers=active).status_code == 204
    assert client.get("/v1/me", headers=active).status_code == 401
    active = login(client, "admin")
    monkeypatch.setenv("APP_ENV", "production")
    assert client.get("/v1/me", headers=active).status_code == 401
    assert client.post("/v1/auth/demo", json={"identity": "admin"}).status_code == 404


def test_owned_lot_unit_conversion_and_concurrent_ledger(pilot):
    client, _, _ = pilot
    farmer, outsider, agent = [
        login(client, name) for name in ("farmer", "farmer-two", "agent")
    ]
    request = lot_input(quantity="25", unit="maund", kg_per_maund="40")
    created = client.post("/v1/lots", headers=farmer, json=request)
    assert created.status_code == 201, created.text
    assert created.json()["initial_kg"] == "1000.000"
    lot_id = created.json()["id"]
    assert client.post("/v1/lots", headers=farmer, json=request).json()["id"] == lot_id
    assert (
        client.post(
            "/v1/lots", headers=farmer, json={**request, "quantity": "26"}
        ).status_code
        == 409
    )
    assert client.get(f"/v1/lots/{lot_id}", headers=outsider).status_code == 404
    assert client.get(f"/v1/lots/{lot_id}", headers=agent).status_code == 200
    unrelated = new_lot(client, outsider)
    assert client.get(f"/v1/lots/{unrelated}", headers=agent).status_code == 404
    assert (
        client.post(
            f"/v1/lots/{lot_id}/verification",
            headers=farmer,
            json={"verified_kg": "950"},
        ).status_code
        == 403
    )
    verified = client.post(
        f"/v1/lots/{lot_id}/verification", headers=agent, json={"verified_kg": "950"}
    )
    assert verified.json()["verified_kg"] == "950.000"

    def loss(key):
        return client.post(
            f"/v1/lots/{lot_id}/movements",
            headers=farmer,
            json={
                "event_type": "LOSS_REPORTED",
                "quantity": "-600",
                "reason": "Damaged sample",
                "unit": "kg",
                "request_key": str(key),
            },
        )

    keys = [uuid4(), uuid4()]
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(loss, keys))
    assert sorted(response.status_code for response in responses) == [200, 409]
    assert (
        loss(
            keys[
                next(
                    index
                    for index, result in enumerate(responses)
                    if result.status_code == 200
                )
            ]
        ).status_code
        == 200
    )
    lot = client.get(f"/v1/lots/{lot_id}", headers=farmer).json()
    assert lot["available_kg"] == "400.000"
    assert lot["verified_kg"] == "350.000"
    assert len(lot["events"]) == 2
    assert lot["events"][-1]["kg_per_maund"] == "40.000"


def test_demand_filters_projection_and_pagination(pilot):
    client, _, _ = pilot
    farmer, buyer, outsider, agent = [
        login(client, key) for key in ("farmer", "buyer", "buyer-two", "agent")
    ]
    district = f"District-{uuid4().hex[:8]}"
    visible = [new_lot(client, farmer, district=district) for _ in range(21)]
    hidden = new_lot(client, farmer, district=district, listed=False)
    new_lot(client, farmer, district=district, grade="C")
    client.post(
        f"/v1/lots/{visible[0]}/verification",
        headers=agent,
        json={"verified_kg": "900"},
    )
    terms = {
        "quantity_kg": "200",
        "variety": "Taherpuri",
        "minimum_grade": "B",
        "delivery_district": "Dhaka",
        "delivery_from": today().isoformat(),
        "delivery_to": (today() + timedelta(days=3)).isoformat(),
        "transport": "buyer",
        "price_ceiling_bdt_kg": "50",
    }
    demand = client.post("/v1/buyer-requests", headers=buyer, json=terms)
    assert demand.status_code == 201, demand.text
    request_id = demand.json()["id"]
    assert (
        client.get(f"/v1/buyer-requests/{request_id}", headers=outsider).status_code
        == 404
    )
    assert client.get("/v1/matches", headers=farmer).status_code == 403
    params = {"request_id": request_id, "district": district}
    first = client.get("/v1/matches", headers=buyer, params=params).json()
    assert len(first["items"]) == 20 and first["next_offset"] == 20
    assert first["items"][0]["id"] == visible[0]
    assert set(first["items"][0]) == {
        "id",
        "district",
        "variety",
        "grade",
        "sellable_kg",
        "verification",
    }
    second = client.get(
        "/v1/matches", headers=buyer, params={**params, "offset": 20}
    ).json()
    assert second["next_offset"] is None
    assert {item["id"] for item in first["items"] + second["items"]} == set(visible)
    assert hidden not in {item["id"] for item in first["items"]}
    verified = client.get(
        "/v1/matches", headers=buyer, params={**params, "verified_only": True}
    ).json()
    assert [item["id"] for item in verified["items"]] == visible[:1]
    linked_offer = new_offer(
        client, buyer, visible[0], 200, buyer_request_id=request_id
    )
    assert linked_offer["buyer_verified"] is True
    assert linked_offer["delivery_to"] == terms["delivery_to"]
    assert (
        client.post(f"/v1/buyer-requests/{request_id}/close", headers=buyer).status_code
        == 200
    )
    assert client.get("/v1/matches", headers=buyer, params=params).status_code == 409


def test_concurrent_acceptance_exactly_once_and_state_parity(pilot):
    client, engine, _ = pilot
    farmer, buyer, rival, outsider, admin = [
        login(client, name)
        for name in ("farmer", "buyer", "buyer-two", "farmer-two", "admin")
    ]
    lot_id = new_lot(client, farmer)
    offers = [
        new_offer(client, buyer, lot_id, 700),
        new_offer(client, rival, lot_id, 600),
    ]
    requests = [reply(offer) for offer in offers]

    def accept(index):
        return client.post(
            f"/v1/offers/{offers[index]['id']}/respond",
            headers=farmer,
            json=requests[index],
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(accept, range(2)))
    assert sorted(result.status_code for result in results) == [200, 409]
    winner = next(
        index for index, result in enumerate(results) if result.status_code == 200
    )
    winning_buyer = [buyer, rival][winner]
    response = results[winner].json()
    assert accept(winner).json() == response
    assert (
        client.post(
            f"/v1/offers/{offers[winner]['id']}/respond",
            headers=farmer,
            json={**requests[winner], "confirm": False},
        ).status_code
        == 409
    )
    order_id = response["order_id"]
    order_path = f"/v1/orders/{order_id}"
    seller_view = client.get(order_path, headers=farmer).json()
    assert seller_view == client.get(order_path, headers=winning_buyer).json()
    assert seller_view == client.get(order_path, headers=admin).json()
    assert client.get(order_path, headers=outsider).status_code == 404
    assert (
        client.get(f"/v1/lots/{lot_id}", headers=farmer).json()["reserved_kg"]
        == offers[winner]["quantity_kg"]
    )
    with Session(engine) as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(lot_events)
                .where(
                    lot_events.c.lot_id == UUID(lot_id),
                    lot_events.c.event_type == "RESERVED",
                )
            )
            == 1
        )
    dispatch = {"action": "dispatch", "request_key": str(uuid4()), "confirm": True}
    assert (
        client.post(
            f"{order_path}/transition", headers=winning_buyer, json=dispatch
        ).status_code
        == 403
    )
    assert (
        client.post(f"{order_path}/transition", headers=farmer, json=dispatch).json()[
            "status"
        ]
        == "dispatched"
    )
    assert (
        client.post(f"{order_path}/transition", headers=farmer, json=dispatch).json()[
            "status"
        ]
        == "dispatched"
    )
    receive = {"action": "receive", "request_key": str(uuid4()), "confirm": True}
    assert (
        client.post(
            f"{order_path}/transition", headers=winning_buyer, json=receive
        ).json()["status"]
        == "delivered"
    )
    stock = client.get(f"/v1/lots/{lot_id}", headers=farmer).json()
    assert stock["reserved_kg"] == "0.000"
    assert stock["available_kg"] == ("300.000" if winner == 0 else "400.000")


def test_counter_acceptance_and_expiration_release(pilot):
    client, engine, _ = pilot
    farmer, buyer = [login(client, name) for name in ("farmer", "buyer")]
    lot_id = new_lot(client, farmer)
    offer = new_offer(client, buyer, lot_id, 200)
    path = f"/v1/offers/{offer['id']}/respond"
    assert client.post(path, headers=buyer, json=reply(offer)).status_code == 409
    assert (
        client.post(path, headers=farmer, json=reply(offer, confirm=False)).status_code
        == 422
    )
    counter = client.post(
        path,
        headers=farmer,
        json=reply(
            offer,
            "counter",
            quantity_kg="150",
            price_bdt_kg="50",
        ),
    )
    assert counter.status_code == 200, counter.text
    assert client.post(path, headers=buyer, json=reply(offer)).status_code == 409
    accepted = client.post(path, headers=buyer, json=reply(counter.json())).json()
    history = client.get(f"/v1/offers/{offer['id']}", headers=buyer).json()["activity"]
    assert [entry["quantity_kg"] for entry in history] == [
        "200.000",
        "150.000",
        "150.000",
    ]
    assert [entry["version"] for entry in history] == [1, 2, 3]
    order_id = UUID(accepted["order_id"])
    with Session(engine) as db, db.begin():
        db.execute(
            update(orders)
            .where(orders.c.id == order_id)
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
    sweep_expired(engine)
    sweep_expired(engine)
    record = client.get(f"/v1/orders/{order_id}", headers=farmer).json()
    assert record["status"] == "expired"
    assert [item["action"] for item in record["activity"]] == ["confirmed", "expired"]
    assert record["activity"][-1]["by_system"]
    assert (
        client.get(f"/v1/lots/{lot_id}", headers=farmer).json()["reserved_kg"]
        == "0.000"
    )


def test_inspection_images_review_and_risk(pilot):
    client, engine, folder = pilot
    farmer, agent, outsider, buyer = [
        login(client, name) for name in ("farmer", "agent", "farmer-two", "buyer")
    ]
    lot_id = new_lot(client, farmer)
    prefix = f"/v1/lots/{lot_id}"
    assert (
        client.get(f"{prefix}/risk", headers=farmer).json()["band"]
        == "insufficient_data"
    )
    photo = BytesIO()
    exif = Image.Exif()
    exif[270] = "Private location metadata"
    Image.new("RGB", (32, 32), "black").save(photo, "JPEG", exif=exif)
    files = [
        ("images", (name, photo.getvalue(), "image/jpeg"))
        for name in ("overview.jpg", "closeup.jpg")
    ]
    observations = {
        "observed_on": today().isoformat(),
        "curing": "cured",
        "ventilation": "good",
        "moisture": "dry",
        "odor": "normal",
        "visible_flags": ["uncertain_or_low_quality"],
    }
    payload = {"observations": json.dumps(observations), "consent": "true"}
    path = f"{prefix}/inspections"
    assert (
        client.post(path, headers=outsider, data=payload, files=files).status_code
        == 404
    )
    assert client.post(path, headers=farmer, data=payload).status_code == 422
    bad = [("images", ("mismatch.png", photo.getvalue(), "image/png")), files[0]]
    assert client.post(path, headers=farmer, data=payload, files=bad).status_code == 415
    big = [
        ("images", ("large.jpg", b"x" * (3 * 1024 * 1024 + 1), "image/jpeg")),
        files[0],
    ]
    assert client.post(path, headers=farmer, data=payload, files=big).status_code == 413
    assert list(folder.iterdir()) == []
    result = client.post(path, headers=farmer, data=payload, files=files[:1])
    assert result.status_code == 201, result.text
    inspection = result.json()
    assert inspection["confidence"] is None
    assert inspection["quality_assessment"] == "uncertain_or_low_quality"
    assert "too_dark" in inspection["photos"][0]["quality_flags"]
    image_path = f"{prefix}/inspection-photos/{inspection['photos'][0]['id']}"
    assert client.get(image_path, headers=outsider).status_code == 404
    assert client.get(image_path, headers=buyer).status_code == 403
    image = client.get(image_path, headers=agent)
    assert image.status_code == 200 and image.headers["content-type"] == "image/jpeg"
    assert not Image.open(BytesIO(image.content)).getexif()
    correction = {"flags": ["physical_damage"], "reason": "Close-up shows bruising"}
    review_path = f"{path}/{inspection['id']}/review"
    assert (
        client.post(review_path, headers=farmer, json=correction).json()["provenance"]
        == "owner_correction"
    )
    review = {
        "flags": ["visible_rot_or_mold"],
        "reason": "Observed decay during on-site inspection",
    }
    confirmed = client.post(review_path, headers=agent, json=review)
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["provenance"] == "human_review"
    assert confirmed.json()["visible_flags"] == ["uncertain_or_low_quality"]
    assert client.post(review_path, headers=farmer, json=correction).status_code == 409
    risk = client.get(f"{prefix}/risk", headers=farmer).json()
    assert risk["band"] == "high" and risk["reasons"] == ["visible_rot"]
    assert {"temperature_c", "humidity_pct"} <= set(risk["missing"])
    with Session(engine) as db:
        assert (
            db.scalar(
                select(func.count())
                .select_from(audit_log)
                .where(
                    audit_log.c.resource_id == UUID(inspection["id"]),
                )
            )
            == 3
        )
