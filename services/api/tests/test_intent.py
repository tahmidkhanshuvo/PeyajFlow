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


@pytest.mark.parametrize(
    ("phrase", "tool", "quantity", "unit"),
    [
        ("হ্যাঁ ভাই, দুইশো কেজির অফারে আমি রাজি", "accept", "200", "kg"),
        ("দুশো কেজির অফার নেব", "accept", "200", "kg"),
        ("২শো কেজি অফার গ্রহণ", "accept", "200", "kg"),
        ("পাল্টা অফার একশো পঞ্চাশ কেজি", "counter", "150", "kg"),
        ("দশ কেজি পেঁয়াজ নষ্ট হয়েছে", "movement", "10", "kg"),
        ("নতুন লট নিবন্ধন আশি মণ", "register", "80", "maund"),
        ("দেড় মণের অফার নেব", "accept", "1.5", "maund"),
        ("আড়াইশো কেজি অফার গ্রহণ", "accept", "250", "kg"),
        ("সাড়ে তিন মণ পচে গেছে", "movement", "3.5", "maund"),
        ("সোয়া পাঁচ মণ অফার গ্রহণ", "accept", "5.25", "maund"),
        ("পৌনে দুই মণ ওজন কম", "movement", "1.75", "maund"),
        ("পনেরোশো কেজির অফার নেব", "accept", "1500", "kg"),
        ("দুই হাজার পাঁচশো কেজি অফার গ্রহণ", "accept", "2500", "kg"),
        ("এক লাখ কেজি অফার পাঠাব", "send_offer", "100000", "kg"),
        ("accept offer two hundred kg", "accept", "200", "kg"),
        ("accept offer two hundred and fifty kg", "accept", "250", "kg"),
        ("accept offer twenty-five kg", "accept", "25", "kg"),
        ("accept offer ninety nine kg", "accept", "99", "kg"),
        ("accept a hundred kg offer", "accept", "100", "kg"),
        ("accept offer one thousand two hundred kg", "accept", "1200", "kg"),
        ("2 hundred kg accept offer", "accept", "200", "kg"),
        ("1.5 হাজার কেজি অফার নেব", "accept", "1500", "kg"),
        ("I want to buy two hundred kg", "send_offer", "200", "kg"),
        ("tin mon er offer nibo", "accept", "3", "maund"),
        ("dusho kg offer nibo", "accept", "200", "kg"),
        ("sare tin mon offer nibo", "accept", "3.5", "maund"),
        ("ek hajar kg offer pathabo", "send_offer", "1000", "kg"),
    ],
)
def test_quantities_said_in_words_are_read(phrase, tool, quantity, unit):
    result = interpret(phrase)
    assert (result.status, result.tool, result.quantity, result.unit) == (
        "resolved",
        tool,
        Decimal(quantity),
        unit,
    )
    # Whole amounts carry no decimal places, so the form is filled with "200".
    assert str(result.quantity) == quantity


@pytest.mark.parametrize(
    "phrase",
    [
        "অফার গ্রহণ দুইশো",  # no unit
        "দুই নম্বর লটের ২০ মণ অফার গ্রহণ",  # a number word that is not the quantity
        "two three kg accept offer",
        "accept offer nine ninety kg",
        "accept offer two thousand thousand kg",
        "accept offer hundred kg",
        "accept offer two hundred and kg",
        "accept offer five hundred kg thousand",
        "অফার গ্রহণ এক হাজার পনেরোশো কেজি",
        "sare 200.5 kg offer nibo",  # a fraction that cannot apply is not dropped
        "অফার গ্রহণ সাড়ে কেজি",
    ],
)
def test_irregular_spoken_numbers_abstain(phrase):
    result = interpret(phrase)
    assert (result.status, result.tool, result.reason) == (
        "unknown",
        None,
        "number_words",
    )


def test_spoken_numbers_keep_the_other_quantity_rules():
    assert interpret("অফার গ্রহণ দুইশো কেজি ৩০০ কেজি").reason == "multiple_quantities"
    assert interpret("accept offer zero kg").reason == "invalid_quantity"
    # নয় (nine) is also "is not", so it stays a negation, never a quantity.
    assert interpret("নয় মণ অফার গ্রহণ").status == "negated"
    # Banglish words that are also English words do not swallow a quantity.
    assert interpret("accept offer at 200 kg").quantity == Decimal(200)
    assert interpret("share 200 kg offer").tool == "offers"
    # A price said in words is not a quantity, just like "৪০ টাকা".
    result = interpret("পঞ্চাশ টাকা দরে ২০০ কেজি অফার গ্রহণ")
    assert (result.tool, result.quantity, result.unit) == ("accept", Decimal(200), "kg")
    assert resolve("দেড় মণের অফার নেব") == ("accept", (Decimal("1.5"), "maund"))


@pytest.mark.parametrize(
    ("phrase", "tool", "quantity"),
    [
        ("no thanks, reject it", "reject", None),
        ("এই দামে দিব না, অফারটা বাদ দিন", "reject", None),
        ("আমি বুঝতে পারছি না, একজন মানুষের সাথে কথা বলতে চাই", "support", None),
        ("না, অফার গ্রহণ ২০০ কেজি", "accept", "200"),
        ("আমি জানি না। ট্রাক লাগবে", "transport", None),
        ("no. accept offer 2.5 maund", "accept", "2.5"),
    ],
)
def test_a_negation_in_an_earlier_clause_does_not_block_the_final_command(
    phrase, tool, quantity
):
    result = interpret(phrase)
    assert (result.status, result.tool) == ("resolved", tool)
    assert result.quantity == (None if quantity is None else Decimal(quantity))


@pytest.mark.parametrize(
    ("phrase", "status"),
    [
        ("no thanks reject it", "negated"),  # no punctuation, never split
        ("অফার গ্রহণ করব, না", "negated"),  # the negation follows the command
        ("don't accept, reject it", "negated"),  # a change in the negated clause
        ("no, don't accept", "negated"),
        ("২০০ কেজি না, ৩০০ কেজির অফার নেব", "negated"),  # a quantity was negated
        ("অফার গ্রহণ করব না, অফার গ্রহণ করব না", "negated"),
        ("not now, accept offer kina", "ambiguous"),
        ("no thanks, reject or accept it", "ambiguous"),
        ("অফারটা নেব নাকি বাদ দেব বুঝছি না", "ambiguous"),
    ],
)
def test_clause_scoping_never_acts_on_a_negated_or_uncertain_command(phrase, status):
    result = interpret(phrase)
    assert (result.status, result.tool) == (status, None)


def test_reject_with_a_helper_verb_is_not_sending_an_offer():
    for phrase in (
        "অফারটা বাদ দিন",
        "অফারটা নাকচ করে দিন",
        "অফারটা বাদ দিয়ে দিন",
        "offer ta bad diye din",
    ):
        assert interpret(phrase).tool == "reject", phrase
    assert interpret("অফার দিন ২০০ কেজি").tool == "send_offer"
    assert interpret("বাদ দিয়ে নতুন অফার পাঠান").status == "ambiguous"


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
