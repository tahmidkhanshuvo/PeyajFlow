from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.intent import ALIASES, interpret, normalize
from app.voice import error_code, resolve


@pytest.mark.parametrize(("phrase", "tool"), sorted(ALIASES.items()))
def test_every_listed_phrase_still_resolves_exactly(phrase, tool):
    result = interpret(phrase)
    assert (result.status, result.tool, result.match) == ("resolved", tool, "exact")


def test_normalization_handles_spacing_marks_digits_and_spelling():
    assert normalize("অফার‌   গ্রহন।") == "অফার গ্রহণ"
    assert normalize("Accept Offer ১,০০০KG!") == "accept offer 1000 kg"
    assert normalize("২.৫মণ") == "2.5 মণ"
    assert interpret("আমার মজুদ").tool == "stock"


@pytest.mark.parametrize(
    ("phrase", "tool", "quantity", "unit"),
    [
        ("200 kg offer accept koro", "accept", "200", "kg"),
        ("২০০ কেজির অফারটা নেব", "accept", "200", "kg"),
        ("5 mon er offer ta nibo", "accept", "5", "maund"),
        ("৪ মণের অফারটা নিয়ে নিন", "accept", "4", "maund"),
        ("পাল্টা অফার ১৫০ কেজি", "counter", "150", "kg"),
        ("৫ কেজি পেঁয়াজ পচে গেছে", "movement", "5", "kg"),
        ("300 kg er offer pathabo", "send_offer", "300", "kg"),
    ],
)
def test_quantities_and_units_are_extracted(phrase, tool, quantity, unit):
    result = interpret(phrase)
    assert (result.status, result.tool, result.quantity, result.unit) == (
        "resolved",
        tool,
        Decimal(quantity),
        unit,
    )


def test_negated_change_commands_never_resolve_but_reads_still_answer():
    for phrase in (
        "অফার গ্রহণ করব না",
        "অফার গ্রহণ করিনি",
        "offer ta nibo na",
        "don't accept the offer",
        "ট্রাক লাগবে না",
    ):
        result = interpret(phrase)
        assert (result.status, result.tool) == ("negated", None), phrase
    assert interpret("দাম জানি না, দর বলুন").tool == "prices"
    assert interpret("ekhon bechbo na rakhbo").tool == "advice"


@pytest.mark.parametrize(
    ("phrase", "status", "reason"),
    [
        ("অফার গ্রহণ ২০০", "unknown", "unit_missing"),
        ("অফার গ্রহণ দুইশো", "unknown", "number_words"),
        ("accept offer two hundred kg", "unknown", "number_words"),
        ("অফার গ্রহণ ০ কেজি", "unknown", "invalid_quantity"),
        ("অফার গ্রহণ ২০০ কেজি ৩০০ কেজি", "ambiguous", "multiple_quantities"),
        ("accept or reject the offer", "ambiguous", "multiple_commands"),
        ("offer accept korbo kina", "ambiguous", "uncertain"),
        ("ধানের দাম কত", "unknown", "unsupported_product"),
        ("অর্ডার বাতিল করুন", "unknown", "unsupported_action"),
        ("transfer money to my bank", "unknown", "unsupported_action"),
        ("হ্যালো", "unknown", "no_match"),
    ],
)
def test_unusable_requests_abstain_with_a_reason(phrase, status, reason):
    result = interpret(phrase)
    assert (result.status, result.tool, result.reason) == (status, None, reason)


def test_prices_in_taka_are_not_quantities_and_received_offers_are_reads():
    assert interpret("counter at 40 taka per kg").tool == "counter"
    assert interpret("counter at 40 taka per kg").quantity is None
    assert interpret("did any buyer send me an offer").tool == "offers"
    assert interpret("I want to buy 500 kg from that lot").tool == "send_offer"
    assert interpret("make a counter offer").tool == "counter"


def test_voice_maps_each_outcome_to_a_specific_error():
    assert error_code(interpret("অফার গ্রহণ")) is None
    assert error_code(interpret("অফার গ্রহণ করব না")) == "voice_negated"
    assert error_code(interpret("show offers and orders")) == "voice_ambiguous"
    assert error_code(interpret("অফার গ্রহণ ২০০")) == "voice_say_quantity"
    assert error_code(interpret("potato price")) == "voice_onion_only"
    assert error_code(interpret("cancel my order")) == "voice_unsupported"
    with pytest.raises(HTTPException) as raised:
        resolve("অজানা")
    assert raised.value.detail == "voice_repeat"
    assert resolve("অফার গ্রহণ ৫ মণ") == ("accept", (Decimal(5), "maund"))
