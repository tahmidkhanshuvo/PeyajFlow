"""Deterministic command resolution for the Bangla call simulator.

The resolver understands Bangla, Banglish (Bengali in Latin script), English
and code-switched commands. It never executes anything: a resolved change
command still goes through the existing read-back and keypad confirmation.

Outcomes:
- ``resolved``: one command, matched ``exact`` (a listed phrase) or by
  ``pattern`` (the grammar below).
- ``ambiguous``: more than one command, several quantities, or a "whether"
  question. The caller asks the user to repeat.
- ``negated``: a change command combined with a negation such as "না" or
  "don't". It is never turned into the opposite command.
- ``unknown``: nothing matched, the product is not onion, the action is not
  supported by voice, or the spoken quantity is unusable.

Negation and "whether" questions do not block read commands, because reading
prices or stock changes nothing.
"""

import re
import unicodedata
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Literal

Status = Literal["resolved", "ambiguous", "negated", "unknown"]
Unit = Literal["kg", "maund"]

# Phrases the simulator has always accepted. They stay valid unchanged.
ALIASES = {
    "দর": "prices",
    "বাজার দর": "prices",
    "prices": "prices",
    "মজুত": "stock",
    "আমার মজুত": "stock",
    "stock": "stock",
    "পরামর্শ": "advice",
    "advice": "advice",
    "অফার": "offers",
    "offers": "offers",
    "অর্ডার": "orders",
    "orders": "orders",
    "অফার গ্রহণ": "accept",
    "accept offer": "accept",
    "অফার প্রত্যাখ্যান": "reject",
    "reject offer": "reject",
    "পাল্টা অফার": "counter",
    "counter offer": "counter",
    "ওজন সমন্বয়": "movement",
    "adjust stock": "movement",
    "মজুত নিবন্ধন": "register",
    "register lot": "register",
    "অফার পাঠান": "send_offer",
    "send offer": "send_offer",
    "পরিবহন চাই": "transport",
    "request transport": "transport",
    "পরিদর্শন চাই": "inspection",
    "request inspection": "inspection",
    "সহায়তা": "support",
    "agent help": "support",
}
READS = ("prices", "stock", "advice", "offers", "orders")
WRITES = (
    "accept",
    "reject",
    "counter",
    "movement",
    "register",
    "send_offer",
    "transport",
    "inspection",
    "support",
)
TOOLS = READS + WRITES
# Commands whose form carries a quantity the spoken amount is checked against.
QUANTITY_TOOLS = frozenset({"accept", "counter", "movement", "register", "send_offer"})

DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
INVISIBLE = dict.fromkeys(map(ord, "​‌‍⁠﻿­"))
APOSTROPHES = dict.fromkeys(map(ord, "'’`"))
PUNCTUATION = re.compile(r"[।॥,!?;:\"“”‘(){}\[\]…/\\|*_~=+<>–—-]")
# Common spelling variants mapped to one form before matching.
VARIANTS = (
    ("গ্রহন", "গ্রহণ"),
    ("প্রত্যাক্ষান", "প্রত্যাখ্যান"),
    ("প্রত্যাখান", "প্রত্যাখ্যান"),
    ("প্রত্যাখ্যাণ", "প্রত্যাখ্যান"),
    ("মজুদ", "মজুত"),
    ("নিবন্ধণ", "নিবন্ধন"),
    ("পরিবহণ", "পরিবহন"),
    ("কেজী", "কেজি"),
    ("গাড়ী", "গাড়ি"),
    ("পিঁয়াজ", "পেঁয়াজ"),
    ("পেয়াজ", "পেঁয়াজ"),
    ("পিয়াজ", "পেঁয়াজ"),
)


def nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)


ALIASES = {nfc(key): tool for key, tool in ALIASES.items()}
VARIANTS = tuple((nfc(variant), nfc(standard)) for variant, standard in VARIANTS)


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text).translate(INVISIBLE)
    text = text.translate(APOSTROPHES).translate(DIGITS).casefold()
    text = re.sub(r"(?<=\d),(?=\d{3}(?!\d))", "", text)
    text = PUNCTUATION.sub(" ", text)
    text = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", text)
    # Separate digits from attached words: "200kg" and "২০০কেজি".
    text = re.sub(r"(?<=\d)(?=[^\d\s.])|(?<=[^\d\s.])(?=\d)", " ", text)
    for variant, standard in VARIANTS:
        text = text.replace(variant, standard)
    return " ".join(text.split())


def words(*alternatives: str) -> str:
    """Whole tokens."""
    return rf"(?:^|\s)(?:{'|'.join(map(nfc, alternatives))})(?=\s|$)"


def stems(*alternatives: str) -> str:
    """Tokens starting with a stem, so Bangla suffixes (অফারটা, মজুতের) match."""
    return rf"(?:^|\s)(?:{'|'.join(map(nfc, alternatives))})"


def phrase(*alternatives: str) -> str:
    """Several tokens in sequence; spaces inside an alternative are literal."""
    return rf"(?:^|\s)(?:{'|'.join(map(nfc, alternatives))})"


OFFER = stems("অফার", "offer", "offar", "ofar")
ORDER = stems("অর্ডার", "অডার", "order")
STOCK = stems("মজুত", "stock", "inventory", "mojut", "mojud", "গুদাম", "godam")
PRICE = words(
    "দর",
    "দরের",
    "দরটা",
    "দাম",
    "দামে",
    "দামের",
    "দামটা",
    "বাজারদর",
    "বাজারদরের",
    "price",
    "prices",
    "pricing",
    "rate",
    "rates",
    "dam",
    "dor",
)
SELL = stems("বিক্রি", "বেচ", "bikri", "bech", "sell")
KEEP = stems(
    "রাখ",
    "রেখে",
    "অপেক্ষা",
    "ধরে",
    "পরে",
    "লাভ",
    "rakh",
    "rekhe",
    "opekkha",
    "pore",
    "labh",
    "wait",
    "hold",
    "keep",
    "later",
    "profit",
)
HOW_MUCH = words("কত", "koto", "how")
HAVE = stems("আছে", "ache", "ase", "have")
MONEY = stems("টাকা", "taka", "tk", "৳")
CURRENCY = frozenset(map(nfc, ("টাকা", "টাকায়", "taka", "tk", "bdt", "৳")))
SELLING_FOR = phrase("selling for", "sell for", "how much is", "how much are")
LEFT = phrase("have left", "বাকি আছে", "baki ache", "in storage")
DELIVERY = stems("ডেলিভারি", "delivery", "পৌঁছা", "pouch", "arrive", "shipment")
BUY_FROM_ME = phrase(
    "কিনতে চেয়েছে",
    "কিনতে চায়",
    "কিনতে চাচ্ছে",
    "kinte cheyeche",
    "kinte chay",
    "wants to buy",
    "want to buy from me",
)
I_WANT_TO_BUY = phrase(
    "কিনতে চাই", "kinte chai", "i want to buy", "i would like to buy", "want to buy"
)
RECEIVED = (
    phrase("send me", "sent me", "sends me")
    + "|"
    + words("sent", "received", "got", "পাঠিয়েছে", "দিয়েছে", "এসেছে")
)
ACCEPT_VERB = stems(
    "গ্রহণ",
    "রাজি",
    "নেব",
    "নিব",
    "নিতে",
    "নিলাম",
    "নিচ্ছি",
    "নিয়ে",
    "নিন",
    "মেনে",
    "accept",
    "grohon",
    "grohan",
    "raji",
    "nibo",
    "nebo",
    "nite",
    "nilam",
    "niye",
)
REJECT_VERB = stems(
    "প্রত্যাখ্যান",
    "নাকচ",
    "বাদ",
    "reject",
    "decline",
    "refuse",
    "nakoch",
    "protyakhan",
    "bad",
)
COUNTER = stems("পাল্টা", "palta", "counter")
COUNTER_OBJECT = stems("অফার", "offer", "দর", "দাম", "প্রস্তাব", "dor", "dam", "proposal")
COUNTER_ALONE = words("counter", "counteroffer")
SEND_VERB = stems(
    "পাঠা",
    "দিতে",
    "দিন",
    "দেব",
    "দিব",
    "দিচ্ছি",
    "pathao",
    "pathab",
    "pathai",
    "dite",
    "dibo",
    "debo",
    "din",
    "send",
    "make",
    "place",
    "give",
)
WEIGHT = stems("ওজন", "ojon", "weight")
SHORTFALL = words("কম", "kom", "less", "short", "missing")
ADJUST = stems("সমন্বয়", "ঠিক", "বদল", "adjust", "thik", "correct", "change")
LOSS = (
    stems(
        "পচে",
        "পচা",
        "নষ্ট",
        "ক্ষতি",
        "poche",
        "pocha",
        "nosto",
        "khoti",
        "loss",
        "lost",
        "rotted",
        "rotten",
        "spoiled",
    )
    + "|"
    + phrase("went bad", "gone bad", "খারাপ হয়ে", "kharap hoye")
)
REGISTER = stems("নিবন্ধন", "register", "registration", "nibondhon")
NEW = words("নতুন", "notun", "new")
LOT = stems("লট", "lot", "মজুত", "mojut", "stock")
TRANSPORT = stems(
    "পরিবহন",
    "ট্রাক",
    "গাড়ি",
    "পিকআপ",
    "transport",
    "truck",
    "gari",
    "vehicle",
    "lorry",
    "pickup",
)
INSPECTION = stems("পরিদর্শন", "inspection", "inspect", "poridorshon")
COME_SEE = phrase("দেখে যান", "এসে দেখ", "কেউ এসে", "dekhe jan", "ese dekh", "keu ese")
CHECK = stems("চেক", "check")
CHECK_OBJECT = stems(
    "পেঁয়াজ", "onion", "গুদাম", "storage", "পচ", "rot", "কেউ", "someone", "lot", "লট"
)
HELP = stems("সহায়তা", "সাহায্য", "help", "sahajjo", "shahajjo", "support")
AGENT = stems("এজেন্ট", "agent")
TALK = stems("কথা", "সাথে", "talk", "speak", "kotha", "connect", "যোগাযোগ")
PERSON = stems("মানুষ", "লোক", "person", "human", "someone", "manush")
ACCEPT_ALONE = words("accept")
REJECT_ALONE = words("reject", "decline")

NEGATION = re.compile(
    words(
        "না",
        "নয়",
        "নয়",
        "নই",
        "নাই",
        "নেই",
        "নহে",
        "not",
        "no",
        "never",
        "dont",
        "doesnt",
        "didnt",
        "wont",
        "cant",
        "cannot",
        "na",
        "nai",
        "noy",
        "nah",
    )
    + r"|\S(?:িনি|ইনি)(?=\s|$)"
)
UNCERTAIN = re.compile(words("কিনা", "kina") + "|" + phrase("কি না", "ki na"))
UNSUPPORTED_ACTION = re.compile(
    stems(
        "বাতিল",
        "মুছ",
        "পেমেন্ট",
        "রিফান্ড",
        "ক্যানসেল",
        "ক্যান্সেল",
        "cancel",
        "delete",
        "remove",
        "refund",
        "transfer",
    )
    + "|"
    + words("pay", "payment", "batil", "money", "bank")
    + "|"
    + phrase("টাকা পাঠা", "taka patha")
)
OTHER_PRODUCT = re.compile(
    words(
        "ধান",
        "ধানের",
        "চাল",
        "চালের",
        "আলু",
        "আলুর",
        "রসুন",
        "রসুনের",
        "মরিচ",
        "মরিচের",
        "গম",
        "গমের",
        "পাট",
        "পাটের",
        "আদা",
        "আদার",
        "ভুট্টা",
        "ভুট্টার",
        "rice",
        "paddy",
        "potato",
        "potatoes",
        "garlic",
        "chili",
        "chilli",
        "wheat",
        "jute",
        "ginger",
        "maize",
        "corn",
        "dhan",
        "chal",
        "alu",
        "aloo",
        "roshun",
    )
)
ONION = re.compile(stems("পেঁয়াজ", "onion", "peyaj", "piyaj", "peyaz"))
UNIT_WORDS = {
    "kg": (
        "কেজি",
        "কেজির",
        "কেজিতে",
        "কিলো",
        "কিলোর",
        "কিলোগ্রাম",
        "kg",
        "kgs",
        "kilo",
        "kilos",
        "kilogram",
        "kilograms",
    ),
    "maund": (
        "মণ",
        "মণের",
        "মণে",
        "মন",
        "মনের",
        "maund",
        "maunds",
        "mon",
        "moner",
        "mond",
    ),
}
UNITS = {nfc(word): unit for unit, forms in UNIT_WORDS.items() for word in forms}
# Quantities said in words cannot be checked against the form, so a change
# command that contains them asks for digits instead of guessing.
NUMBER_WORDS = re.compile(
    words(
        "এক",
        "দুই",
        "তিন",
        "চার",
        "পাঁচ",
        "ছয়",
        "সাত",
        "আট",
        "দশ",
        "বিশ",
        "পঞ্চাশ",
        "একশ",
        "একশো",
        "হাজার",
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "twenty",
        "fifty",
        "hundred",
        "thousand",
    )
    + "|"
    + r"(?:^|\s)\S+(?:শো|শত)(?=\s|$)"
)
NUMBER = re.compile(r"(?<![\d.])(\d{1,9}(?:\.\d{1,3})?)(?![\d.])")


def has(text: str, *patterns: str) -> bool:
    return all(re.search(pattern, text) for pattern in patterns)


def matches(text: str) -> list[str]:
    found = {
        "prices": has(text, PRICE)
        or has(text, HOW_MUCH, MONEY)
        or has(text, SELLING_FOR),
        "stock": has(text, STOCK) or has(text, HOW_MUCH, HAVE) or has(text, LEFT),
        "advice": has(text, stems("পরামর্শ", "advice", "advise", "poramor"))
        or has(text, SELL, KEEP),
        "offers": has(text, OFFER) or has(text, BUY_FROM_ME),
        "orders": has(text, ORDER) or has(text, DELIVERY),
        "accept": has(text, OFFER, ACCEPT_VERB) or has(text, ACCEPT_ALONE),
        "reject": has(text, OFFER, REJECT_VERB) or has(text, REJECT_ALONE),
        "counter": has(text, COUNTER, COUNTER_OBJECT) or has(text, COUNTER_ALONE),
        "movement": has(text, WEIGHT, ADJUST)
        or has(text, WEIGHT, SHORTFALL)
        or has(text, STOCK, ADJUST)
        or has(text, LOSS),
        "register": has(text, REGISTER) or has(text, NEW, LOT),
        "send_offer": (has(text, OFFER, SEND_VERB) and not has(text, RECEIVED))
        or (has(text, I_WANT_TO_BUY) and not has(text, BUY_FROM_ME)),
        "transport": has(text, TRANSPORT),
        "inspection": has(text, INSPECTION)
        or has(text, COME_SEE)
        or (has(text, CHECK, CHECK_OBJECT) and not has(text, PRICE)),
        "support": has(text, HELP) or has(text, AGENT, TALK) or has(text, TALK, PERSON),
    }
    if found["counter"]:
        # "পাল্টা অফার দিব" proposes new terms on an existing offer.
        found["send_offer"] = False
    return [tool for tool in TOOLS if found[tool]]


@dataclass(frozen=True)
class Interpretation:
    status: Status
    tool: str | None = None
    quantity: Decimal | None = None
    unit: Unit | None = None
    match: Literal["exact", "pattern"] | None = None
    reason: str | None = None
    candidates: tuple[str, ...] = field(default=())


def quantities(text: str) -> tuple[list[tuple[Decimal, Unit]], bool]:
    """Return (number, unit) pairs and whether a number had no unit."""
    tokens = text.split()
    pairs: list[tuple[Decimal, Unit]] = []
    bare = False
    for index, token in enumerate(tokens):
        if not NUMBER.fullmatch(token):
            continue
        following = tokens[index + 1] if index + 1 < len(tokens) else ""
        previous = tokens[index - 1] if index else ""
        if following in CURRENCY or previous in CURRENCY:
            continue  # a price such as "৪০ টাকা", not a quantity
        unit = UNITS.get(following)
        if unit is None:
            bare = True
        else:
            pairs.append((Decimal(token), unit))
    return pairs, bare


def interpret(text: str) -> Interpretation:
    normalized = normalize(text)
    if not normalized:
        return Interpretation("unknown", reason="no_match")
    alias = ALIASES.get(normalized)
    if alias is not None:
        return Interpretation("resolved", alias, match="exact")
    if UNSUPPORTED_ACTION.search(normalized):
        return Interpretation("unknown", reason="unsupported_action")
    if OTHER_PRODUCT.search(normalized) and not ONION.search(normalized):
        return Interpretation("unknown", reason="unsupported_product")

    found = matches(normalized)
    changes = [tool for tool in found if tool in WRITES]
    if changes:
        if UNCERTAIN.search(normalized):
            return Interpretation(
                "ambiguous", reason="uncertain", candidates=tuple(changes)
            )
        if NEGATION.search(normalized):
            return Interpretation(
                "negated", reason="negated", candidates=tuple(changes)
            )
        if len(changes) > 1:
            return Interpretation(
                "ambiguous", reason="multiple_commands", candidates=tuple(changes)
            )
        tool = changes[0]
    elif found:
        if len(found) > 1:
            return Interpretation(
                "ambiguous", reason="multiple_commands", candidates=tuple(found)
            )
        tool = found[0]
    else:
        return Interpretation("unknown", reason="no_match")

    if tool not in QUANTITY_TOOLS:
        return Interpretation("resolved", tool, match="pattern")
    if NUMBER_WORDS.search(normalized):
        return Interpretation("unknown", reason="number_words", candidates=(tool,))
    pairs, bare = quantities(normalized)
    if len(pairs) > 1:
        return Interpretation(
            "ambiguous", reason="multiple_quantities", candidates=(tool,)
        )
    if not pairs:
        if bare:
            return Interpretation("unknown", reason="unit_missing", candidates=(tool,))
        return Interpretation("resolved", tool, match="pattern")
    amount, unit = pairs[0]
    if amount <= 0:
        return Interpretation("unknown", reason="invalid_quantity", candidates=(tool,))
    return Interpretation("resolved", tool, amount, unit, match="pattern")
