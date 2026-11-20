import os
import re

import pytest
from sqlalchemy import delete, update
from sqlalchemy.orm import Session
from test_pilot import login, new_lot, new_offer
from test_pilot import pilot as pilot
from test_signup import PASSWORD, bearer, password_login, registration

from app import rate_limits
from app.auth import users

requires_database = pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"),
    reason="requires disposable migrated PostgreSQL",
)
ASCII = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


@pytest.fixture(autouse=True)
def clean_rate_limits(pilot):
    """Demo accounts are shared and limit windows persist in the database."""
    _, engine, _ = pilot
    with Session(engine) as db, db.begin():
        db.execute(delete(rate_limits.buckets))


def latest(client, headers):
    response = client.get("/v1/simulator/sms", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()["messages"]


def send(client, headers, body):
    response = client.post("/v1/simulator/sms", headers=headers, json={"body": body})
    assert response.status_code == 200, response.text
    return response.json()["messages"][-1]["body"]


def code_in(text):
    match = re.search(r"কোড ([০-৯0-9]{4})", text)
    assert match, text
    return match.group(1).translate(ASCII)


@requires_database
def test_an_offer_sms_can_be_accepted_with_reply_1_and_the_code(pilot):
    client, _, _ = pilot
    farmer, buyer = login(client, "farmer"), login(client, "buyer")
    lot = new_lot(client, farmer, quantity="1000", listed=True)
    new_offer(client, buyer, lot, 200, price_bdt_kg="45")

    offer_sms = [m for m in latest(client, farmer) if "নতুন অফার" in m["body"]]
    assert offer_sms and "রাজি হলে 1" in offer_sms[-1]["body"]
    assert offer_sms[-1]["direction"] == "in"

    staged = send(client, farmer, "১")
    assert "গ্রহণ" in staged and "কোড" in staged
    lot_view = client.get(f"/v1/lots/{lot}", headers=farmer).json()
    assert lot_view["reserved_kg"] == "0.000"  # nothing changes before the code

    assert "অফার গ্রহণ নিশ্চিত" in send(client, farmer, code_in(staged))
    assert client.get(f"/v1/lots/{lot}", headers=farmer).json()["reserved_kg"] == (
        "200.000"
    )
    confirmed = [m for m in latest(client, farmer) if "অর্ডার নিশ্চিত" in m["body"]]
    assert confirmed and "টাকা পাঠায় না" in confirmed[-1]["body"]
    # The same reply cannot act twice on the closed offer.
    assert "সক্রিয় নেই" in send(client, farmer, "1")


@requires_database
def test_decline_wrong_codes_and_cancel_leave_stock_unchanged(pilot):
    client, _, _ = pilot
    farmer, buyer = login(client, "farmer"), login(client, "buyer")
    lot = new_lot(client, farmer, quantity="1000", listed=True)
    new_offer(client, buyer, lot, 150, price_bdt_kg="44")
    latest(client, farmer)

    staged = send(client, farmer, "1")
    wrong = "0000" if code_in(staged) != "0000" else "1111"
    assert "আবার দিন" in send(client, farmer, wrong)
    assert "আর একবার" in send(client, farmer, wrong)
    assert "বাতিল হয়েছে" in send(client, farmer, wrong)
    staged = send(client, farmer, "1")
    assert "আগের কাজটি" in send(client, farmer, "দর")  # must finish first
    assert "বাতিল হয়েছে" in send(client, farmer, "0")
    declined = send(client, farmer, "2")
    assert "প্রত্যাখ্যান" in declined
    assert "প্রত্যাখ্যান করা হয়েছে" in send(client, farmer, code_in(declined))
    assert client.get(f"/v1/lots/{lot}", headers=farmer).json()["reserved_kg"] == (
        "0.000"
    )


@requires_database
def test_text_commands_answer_and_form_heavy_changes_are_redirected(pilot):
    client, _, _ = pilot
    farmer = login(client, "farmer")
    new_lot(client, farmer, quantity="600", listed=True)
    assert "কেজি" in send(client, farmer, "আমার মজুত")
    assert "অ্যাপে করুন" in send(client, farmer, "পাল্টা অফার ১৫০ কেজি")
    assert "“না”" in send(client, farmer, "অফার গ্রহণ করব না")
    assert "বোঝা যায়নি" in send(client, farmer, "হ্যালো")
    alert = client.post("/v1/simulator/price-alert", headers=farmer).json()["messages"]
    assert alert[-1]["body"].startswith("পেঁয়াজফ্লো সাপ্তাহিক দর:")


@requires_database
def test_ussd_menu_reaches_an_offer_and_confirms_with_the_code(pilot):
    client, _, _ = pilot
    farmer, buyer = login(client, "farmer"), login(client, "buyer")
    lot = new_lot(client, farmer, quantity="1000", listed=True)
    new_offer(client, buyer, lot, 120, price_bdt_kg="46")

    def ussd(text):
        response = client.post(
            "/v1/simulator/ussd", headers=farmer, json={"text": text}
        )
        assert response.status_code == 200, response.text
        return response.json()

    assert "১ আজকের দর" in ussd("")["text"]
    assert ussd("2")["end"] is True
    listing = ussd("4")["text"]
    assert "অফার বেছে নিন" in listing and "১২০কেজি" in listing
    assert "১ গ্রহণ" in ussd("4*1")["text"]
    staged = ussd("4*1*1")
    assert staged["awaiting"] == "code" and staged["end"] is False
    done = ussd(f"4*1*1*{staged['demo_code']}")
    assert done["end"] is True and "নিশ্চিত" in done["text"]
    assert client.get(f"/v1/lots/{lot}", headers=farmer).json()["reserved_kg"] == (
        "120.000"
    )
    assert ussd("9")["text"] == "ভুল নম্বর।"


@requires_database
def test_call_menu_keys_and_spoken_offer_with_cancel(pilot):
    client, _, _ = pilot
    farmer, buyer = login(client, "farmer"), login(client, "buyer")
    lot = new_lot(client, farmer, quantity="1000", listed=True)
    new_offer(client, buyer, lot, 90, price_bdt_kg="45")

    def turn(text):
        response = client.post(
            "/v1/simulator/call/turn", headers=farmer, json={"body": text}
        )
        assert response.status_code == 200, response.text
        return response.json()

    greeting = client.post("/v1/simulator/call/start", headers=farmer).json()
    assert "সিমুলেটেড কল" in greeting["text"]
    assert "কেজি" in turn("2")["text"]
    staged = turn("নব্বই কেজির অফার নেব")
    assert staged["awaiting"] == "code" and "গ্রহণ" in staged["text"]
    assert "বাতিল" in turn("0")["text"]
    assert client.get(f"/v1/lots/{lot}", headers=farmer).json()["reserved_kg"] == (
        "0.000"
    )
    mismatch = turn("২০০ কেজির অফার নেব")
    assert "মেলেনি" in mismatch["text"]


@requires_database
def test_real_accounts_confirm_by_pin_and_demo_tools_are_demo_only(pilot, monkeypatch):
    client, engine, _ = pilot
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DEMO_MODE", "false")
    monkeypatch.delenv("SHOWCASE_ACCESS_KEY", raising=False)
    entry = registration(role="farmer")
    assert client.post("/v1/auth/signup", json=entry).status_code == 201
    # An unverified account cannot sign in, so it never reaches the simulator.
    assert password_login(client, entry).status_code == 403
    with Session(engine) as db, db.begin():
        db.execute(
            update(users)
            .where(users.c.nid == entry["nid"])
            .values(verification_status="verified", verified=True)
        )
    farmer = bearer(password_login(client, entry))
    assert client.get("/v1/simulator/sms").status_code == 401

    needs_pin = send(client, farmer, "সহায়তা")
    assert "ভয়েস পিন ঠিক করুন" in needs_pin
    assert (
        client.put(
            "/v1/voice/pin", headers=farmer, json={"pin": "4826", "password": PASSWORD}
        ).status_code
        == 204
    )
    staged = send(client, farmer, "সহায়তা")
    assert "পিন দিন" in staged and "কোড" not in staged
    assert "সহায়তার অনুরোধ পাঠানো" in send(client, farmer, "৪৮২৬")
    assert client.post("/v1/simulator/test-offer", headers=farmer).status_code == 403

    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DEMO_MODE", "true")
    demo = login(client, "farmer")
    new_lot(client, demo, quantity="800", listed=True)
    offered = client.post("/v1/simulator/test-offer", headers=demo)
    assert offered.status_code == 200, offered.text
    assert "নতুন অফার" in offered.json()["messages"][-1]["body"]
    assert (
        client.post(
            "/v1/simulator/test-offer", headers=login(client, "buyer")
        ).status_code
        == 403
    )
    # Another account never sees this thread.
    other = latest(client, login(client, "farmer-two"))
    assert all("Fictional" not in m["body"] for m in other)
    assert not any(m["body"] == offered.json()["messages"][-1]["body"] for m in other)


@requires_database
def test_transcription_needs_setup_consent_and_audio(pilot, monkeypatch):
    from app import intent_model

    client, _, _ = pilot
    farmer = login(client, "farmer")
    clip = {
        "audio": "UklGRiQAAABXQVZFZm10IBAAAAABAAEA",
        "mime": "audio/wav",
        "consent": True,
    }
    path = "/v1/simulator/transcribe"
    monkeypatch.delenv("VOICE_TRANSCRIPTION", raising=False)
    assert client.get(path, headers=farmer).json() == {"available": False}
    off = client.post(path, headers=farmer, json=clip)
    assert (off.status_code, off.json()["detail"]) == (503, "transcription_unavailable")

    monkeypatch.setenv("VOICE_TRANSCRIPTION", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "fixture")
    sent = []

    def post(url, body, headers):
        sent.append(body)
        return {
            "candidates": [{"content": {"parts": [{"text": " অফার   গ্রহণ ২০০ কেজি "}]}}]
        }

    monkeypatch.setattr(intent_model, "post", post)
    assert (
        client.post(path, headers=farmer, json={**clip, "consent": False}).status_code
        == 422
    )
    assert (
        client.post(
            path, headers=farmer, json={**clip, "mime": "video/mp4"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            path, headers=farmer, json={**clip, "audio": "not base64!!" * 3}
        ).status_code
        == 422
    )
    heard = client.post(path, headers=farmer, json=clip)
    assert heard.json() == {"text": "অফার গ্রহণ ২০০ কেজি"}
    assert sent[-1]["contents"][0]["parts"][1]["inlineData"]["mimeType"] == "audio/wav"
    monkeypatch.setattr(intent_model, "post", lambda *_: None)
    assert client.post(path, headers=farmer, json=clip).status_code == 502


@requires_database
def test_simultaneous_replies_share_one_session_and_one_pending_change(pilot):
    from concurrent.futures import ThreadPoolExecutor

    from sqlalchemy import func, select

    from app import voice

    client, engine, _ = pilot
    farmer, buyer = login(client, "farmer"), login(client, "buyer")
    lot = new_lot(client, farmer, quantity="1000", listed=True)
    new_offer(client, buyer, lot, 60, price_bdt_kg="45")
    latest(client, farmer)
    member = client.get("/v1/me", headers=farmer).json()["membership_id"]
    with Session(engine) as db, db.begin():
        db.execute(
            update(voice.calls)
            .where(voice.calls.c.actor_id == member)
            .values(status="ended")
        )

    def reply(_):
        return client.post("/v1/simulator/sms", headers=farmer, json={"body": "1"})

    with ThreadPoolExecutor(8) as pool:
        assert {r.status_code for r in pool.map(reply, range(8))} == {200}
    with Session(engine) as db:
        active = db.scalar(
            select(func.count())
            .select_from(voice.calls)
            .where(voice.calls.c.actor_id == member, voice.calls.c.status == "active")
        )
        pending = db.scalar(
            select(func.count())
            .select_from(voice.actions.join(voice.calls))
            .where(
                voice.calls.c.actor_id == member,
                voice.calls.c.status == "active",
                voice.actions.c.state == "pending",
            )
        )
    assert (active, pending) == (1, 1)
