from decimal import Decimal

import pytest

from app import intent_model
from app.intent import interpret
from app.voice import error_code

# Phrases the grammar does not match (checked in the first test).
VAGUE = "ওরা যা দিতে চাইল ওটাই রেখে দেন"
VAGUE_200 = "২০০ কেজি ওরা যা দিতে চাইল ওটাই রেখে দেন"
VAGUE_300 = "ওই ৩০০ কেজির ব্যাপারটা দেখেন"


class Model:
    """A stand-in for the model that records whether it was asked."""

    def __init__(self, answer):
        self.answer = answer
        self.asked: list[str] = []

    def __call__(self, phrase):
        self.asked.append(phrase)
        return self.answer


def test_the_fixture_phrases_are_not_matched_by_the_grammar():
    for phrase in (VAGUE, VAGUE_200, VAGUE_300):
        assert (interpret(phrase).status, interpret(phrase).reason) == (
            "unknown",
            "no_match",
        )


def test_off_by_default(monkeypatch):
    monkeypatch.delenv("VOICE_MODEL_FALLBACK", raising=False)
    assert not intent_model.enabled()
    assert intent_model.understand(VAGUE).reason == "no_match"
    monkeypatch.setenv("VOICE_MODEL_FALLBACK", "true")
    monkeypatch.setenv("MODEL_API_KEY", "fixture")
    assert not intent_model.enabled()  # no model name
    monkeypatch.setenv("META_MODEL", "fixture-model")
    assert intent_model.enabled()


@pytest.mark.parametrize(
    "phrase",
    [
        "অফার গ্রহণ ২০০ কেজি",  # the grammar resolved it
        "অফার গ্রহণ করব না",  # negated
        "offer accept korbo kina",  # uncertain
        "accept or reject the offer",  # ambiguous
        "অফার গ্রহণ দুইশো",  # unreadable quantity
        "ধানের দাম কত",  # another crop
        "অর্ডার বাতিল করুন",  # unsupported action
        "ব্যাপারী যা বলেছে সেটা না",  # no match, but it holds a negation
        "x" * 201,  # too long
    ],
)
def test_the_model_never_overturns_the_grammar_or_sees_refusals(phrase):
    model = Model({"command": "accept", "quantity": None, "unit": None})
    before = interpret(phrase)
    after = intent_model.understand(phrase, model)
    assert model.asked == []
    assert after == before


def test_a_chosen_command_is_marked_as_model_help():
    result = intent_model.understand(VAGUE, Model({"command": "accept"}))
    assert (result.status, result.tool, result.match, result.quantity) == (
        "resolved",
        "accept",
        "model",
        None,
    )
    read = intent_model.understand(VAGUE, Model({"command": "offers"}))
    assert (read.tool, read.match) == ("offers", "model")


@pytest.mark.parametrize(
    "answer",
    [None, {}, {"command": "none"}, {"command": "delete_everything"}, {"command": 7}],
)
def test_unusable_answers_keep_the_refusal(answer):
    result = intent_model.understand(VAGUE, Model(answer))
    assert (result.status, result.reason) == ("unknown", "no_match")


def test_the_model_cannot_invent_or_change_a_quantity():
    invented = intent_model.understand(
        VAGUE, Model({"command": "accept", "quantity": 200, "unit": "kg"})
    )
    assert (invented.status, invented.reason) == ("unknown", "model_quantity")
    assert error_code(invented) == "voice_say_quantity"
    changed = intent_model.understand(
        VAGUE_200, Model({"command": "accept", "quantity": 250, "unit": "kg"})
    )
    assert changed.reason == "model_quantity"
    other_unit = intent_model.understand(
        VAGUE_200, Model({"command": "accept", "quantity": 200, "unit": "maund"})
    )
    assert other_unit.reason == "model_quantity"


def test_a_quantity_the_user_said_is_kept_from_the_grammar():
    same = intent_model.understand(
        VAGUE_200, Model({"command": "accept", "quantity": "200", "unit": "kg"})
    )
    assert (same.tool, same.quantity, same.unit) == ("accept", Decimal(200), "kg")
    silent = intent_model.understand(VAGUE_300, Model({"command": "accept"}))
    assert (silent.quantity, silent.unit) == (Decimal(300), "kg")


def test_a_model_loss_marks_the_movement_as_a_loss():
    result = intent_model.understand(
        VAGUE_300, Model({"command": "movement", "loss": True})
    )
    assert (result.tool, result.loss, result.quantity) == ("movement", True, 300)
    other = intent_model.understand(
        VAGUE_300, Model({"command": "accept", "loss": True})
    )
    assert other.loss is False


def test_replies_are_parsed_strictly():
    assert intent_model.parse('```json\n{"command": "stock"}\n```') == {
        "command": "stock"
    }
    assert intent_model.parse('Sure: {"command": "prices", "quantity": null}') == {
        "command": "prices",
        "quantity": None,
    }
    for reply in (None, "", "no json", "[1, 2]", '{"command": 3}', "{broken"):
        assert intent_model.parse(reply) is None
    assert intent_model.number("1e999") is None
    assert intent_model.number(True) is None
    assert intent_model.number("NaN") is None


def test_provider_settings_choose_what_is_enabled(monkeypatch):
    for name in ("MODEL_API_KEY", "META_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("VOICE_MODEL_FALLBACK", "true")
    monkeypatch.setenv("VOICE_MODEL_PROVIDER", "gemini")
    assert not intent_model.enabled()
    monkeypatch.setenv("GEMINI_API_KEY", "fixture")
    assert intent_model.enabled()
    assert intent_model.model_name() == intent_model.GEMINI_DEFAULT
    monkeypatch.setenv("VOICE_MODEL_PROVIDER", "both")
    assert not intent_model.enabled()  # Meta is not configured
    monkeypatch.setenv("MODEL_API_KEY", "fixture")
    monkeypatch.setenv("META_MODEL", "muse-fixture")
    assert intent_model.enabled()
    assert intent_model.model_name() == f"muse-fixture+{intent_model.GEMINI_DEFAULT}"
    monkeypatch.setenv("VOICE_MODEL_PROVIDER", "unknown")
    assert not intent_model.enabled()
    assert intent_model.ask_model("anything") is None


def test_both_providers_must_agree(monkeypatch):
    accept = {"command": "accept", "quantity": None}
    assert intent_model.same(accept, {"command": "accept"}) == {**accept, "loss": False}
    assert intent_model.same(accept, {"command": "reject"}) is None
    assert intent_model.same(accept, None) is None
    assert intent_model.same({"command": "accept", "quantity": 200}, accept) is None
    assert intent_model.same(
        {"command": "movement", "loss": True}, {"command": "movement"}
    )["loss"]
    monkeypatch.setenv("VOICE_MODEL_PROVIDER", "both")
    monkeypatch.setattr(intent_model, "ask_meta", lambda _: {"command": "stock"})
    monkeypatch.setattr(intent_model, "ask_gemini", lambda _: {"command": "prices"})
    assert intent_model.ask_model("x") is None
    monkeypatch.setattr(intent_model, "ask_gemini", lambda _: {"command": "stock"})
    assert intent_model.ask_model("x")["command"] == "stock"


def test_each_provider_reply_is_read_and_failures_are_none(monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "fixture")
    monkeypatch.setenv("META_MODEL", "muse-fixture")
    monkeypatch.setenv("GEMINI_API_KEY", "fixture")
    sent = []

    def post(url, body, headers):
        sent.append((url, headers))
        if "googleapis" in url:
            return {
                "candidates": [
                    {"content": {"parts": [{"text": '{"command": "orders"}'}]}}
                ]
            }
        return {"choices": [{"message": {"content": '{"command": "offers"}'}}]}

    monkeypatch.setattr(intent_model, "post", post)
    assert intent_model.ask_meta("x") == {"command": "offers"}
    assert intent_model.ask_gemini("x") == {"command": "orders"}
    assert "Authorization" in sent[0][1] and "x-goog-api-key" in sent[1][1]
    monkeypatch.setattr(intent_model, "post", lambda *_: None)
    assert intent_model.ask_meta("x") is None and intent_model.ask_gemini("x") is None
    monkeypatch.setattr(intent_model, "post", lambda *_: {"unexpected": True})
    assert intent_model.ask_meta("x") is None and intent_model.ask_gemini("x") is None
    monkeypatch.setenv("GEMINI_MODEL", "../../evil")
    assert intent_model.ask_gemini("x") is None
