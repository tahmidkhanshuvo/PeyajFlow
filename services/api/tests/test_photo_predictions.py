import json
from decimal import Decimal
from io import BytesIO

from PIL import Image
from test_pilot import login, new_lot
from test_pilot import pilot as pilot

from app.inspection import PHOTO_MODEL, PHOTO_RULE
from app.lots import today


def clear_photo(seed):
    """A 400 px noise image that passes the photo-quality checks."""
    buffer = BytesIO()
    Image.effect_noise((400, 400), 60 + seed).convert("RGB").save(buffer, "JPEG")
    return buffer.getvalue()


def dark_photo():
    buffer = BytesIO()
    Image.new("RGB", (400, 400), "black").save(buffer, "JPEG")
    return buffer.getvalue()


def inspect(client, farmer, lot, images):
    observations = {
        "observed_on": today().isoformat(),
        "curing": "cured",
        "ventilation": "good",
        "moisture": "dry",
        "odor": "normal",
        "visible_flags": ["uncertain_or_low_quality"],
    }
    response = client.post(
        f"/v1/lots/{lot}/inspections",
        headers=farmer,
        data={"observations": json.dumps(observations), "consent": "true"},
        files=[
            ("images", (f"photo-{index}.jpg", content, "image/jpeg"))
            for index, content in enumerate(images)
        ],
    )
    assert response.status_code == 201, response.text
    return response.json()


def scores(**values):
    base = {"rot": 0.05, "sprouting": 0.05, "damage": 0.05, "clear": 0.05}
    base["uncertain"] = 0.05
    base.update(values)
    total = sum(base.values())
    return {key: value / total for key, value in base.items()}


def test_predictions_are_validated_kept_and_compared_with_human_review(pilot):
    client, _, _ = pilot
    farmer, agent, admin, buyer, outsider = (
        login(client, name)
        for name in ("farmer", "agent", "admin", "buyer", "farmer-two")
    )
    lot = new_lot(client, farmer)
    record = inspect(client, farmer, lot, [clear_photo(0), clear_photo(5)])
    first, second = (photo["id"] for photo in record["photos"])
    assert not record["photos"][0]["quality_flags"]
    assert record["photos"][0]["prediction"] is None
    path = f"/v1/lots/{lot}/inspection-photos"
    body = {"model": PHOTO_MODEL, "rule": PHOTO_RULE, "scores": scores(sprouting=0.8)}

    def save(headers, photo=first, **changes):
        return client.post(
            f"{path}/{photo}/predictions", headers=headers, json={**body, **changes}
        )

    assert save(outsider).status_code == 404
    assert save(buyer).status_code == 403
    assert save(agent, model="Xenova/other-model").json()["detail"] == (
        "photo_model_unrecognized"
    )
    assert save(agent, scores={"rot": 1.0}).status_code == 422
    assert save(agent, scores={**body["scores"], "rot": 0.9}).status_code == 422
    stored = save(agent)
    assert stored.status_code == 201, stored.text
    assert stored.json()["flag"] == "sprouting"
    assert stored.json()["top_score"] > 0.58
    close_call = scores(rot=0.4, damage=0.35)
    assert save(farmer, second, scores=close_call).json()["flag"] == (
        "uncertain_or_low_quality"
    )

    dark = inspect(client, farmer, lot, [dark_photo(), dark_photo()])
    flagged = dark["photos"][0]["id"]
    assert save(agent, flagged).json()["detail"] == "photo_quality_insufficient"

    other_lot = new_lot(client, farmer)
    assert (
        client.post(
            f"/v1/lots/{other_lot}/inspection-photos/{first}/predictions",
            headers=agent,
            json=body,
        ).status_code
        == 404
    )
    listed = client.get(f"/v1/lots/{lot}/inspections", headers=farmer).json()
    photos = next(item for item in listed if item["id"] == record["id"])["photos"]
    assert [photo["prediction"]["flag"] for photo in photos] == [
        "sprouting",
        "uncertain_or_low_quality",
    ]

    assert client.get("/v1/admin/photo-model", headers=farmer).status_code == 403
    before = client.get("/v1/admin/photo-model", headers=admin).json()
    review = {"flags": ["sprouting"], "reason": "Green shoots on several bulbs"}
    reviewed = client.post(
        f"/v1/lots/{lot}/inspections/{record['id']}/review", headers=agent, json=review
    )
    assert reviewed.status_code == 200, reviewed.text
    after = client.get("/v1/admin/photo-model", headers=admin).json()
    assert after["model"] == PHOTO_MODEL and after["rule"] == PHOTO_RULE
    for key, change in {
        "reviewed_photos": 2,
        "abstained": 1,
        "decided": 1,
        "agreed": 1,
        "predicted_before_review": 2,
    }.items():
        assert after[key] - before[key] == change, key
    if after["decided"] < after["minimum_pairs"]:
        assert after["agreement_pct"] is None
    else:
        expected = Decimal(100 * after["agreed"]) / after["decided"]
        assert Decimal(after["agreement_pct"]) == expected.quantize(Decimal(".1"))
    assert any(
        cell["predicted"] == "sprouting" and cell["reviewed"] == ["sprouting"]
        for cell in after["cells"]
    )
