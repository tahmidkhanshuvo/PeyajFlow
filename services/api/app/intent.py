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
NUMBER = re.compile(r"(?<![\d.])(\d{1,9}(?:\.\d{1,3})?)(?![\d.])")

# Quantities said in words ("দুইশো কেজি", "দেড় মণ", "two hundred kg").
# A spoken number is read only when it directly precedes kg or maund and the
# whole phrase follows the rules in ``read_number``. Any other number word in
# a quantity command makes the resolver abstain instead of guessing.
BANGLA_NUMBERS = {
    0: ("শূন্য",),
    1: ("এক",),
    2: ("দুই", "দু"),
    3: ("তিন",),
    4: ("চার",),
    5: ("পাঁচ",),
    6: ("ছয়", "ছ"),
    7: ("সাত",),
    8: ("আট",),
    9: ("নয়",),
    10: ("দশ",),
    11: ("এগারো", "এগার"),
    12: ("বারো", "বার"),
    13: ("তেরো", "তের"),
    14: ("চৌদ্দ", "চোদ্দ"),
    15: ("পনেরো", "পনের"),
    16: ("ষোলো", "ষোল"),
    17: ("সতেরো", "সতের"),
    18: ("আঠারো", "আঠার"),
    19: ("উনিশ",),
    20: ("বিশ", "কুড়ি"),
    21: ("একুশ",),
    22: ("বাইশ",),
    23: ("তেইশ",),
    24: ("চব্বিশ",),
    25: ("পঁচিশ",),
    26: ("ছাব্বিশ",),
    27: ("সাতাশ",),
    28: ("আটাশ", "আঠাশ"),
    29: ("ঊনত্রিশ", "উনত্রিশ"),
    30: ("ত্রিশ", "তিরিশ"),
    31: ("একত্রিশ",),
    32: ("বত্রিশ",),
    33: ("তেত্রিশ",),
    34: ("চৌত্রিশ",),
    35: ("পঁয়ত্রিশ",),
    36: ("ছত্রিশ",),
    37: ("সাঁইত্রিশ",),
    38: ("আটত্রিশ",),
    39: ("ঊনচল্লিশ", "উনচল্লিশ"),
    40: ("চল্লিশ",),
    41: ("একচল্লিশ",),
    42: ("বিয়াল্লিশ",),
    43: ("তেতাল্লিশ",),
    44: ("চুয়াল্লিশ",),
    45: ("পঁয়তাল্লিশ",),
    46: ("ছেচল্লিশ",),
    47: ("সাতচল্লিশ",),
    48: ("আটচল্লিশ",),
    49: ("ঊনপঞ্চাশ", "উনপঞ্চাশ"),
    50: ("পঞ্চাশ",),
    51: ("একান্ন",),
    52: ("বাহান্ন",),
    53: ("তিপ্পান্ন",),
    54: ("চুয়ান্ন",),
    55: ("পঞ্চান্ন",),
    56: ("ছাপ্পান্ন",),
    57: ("সাতান্ন",),
    58: ("আটান্ন",),
    59: ("ঊনষাট", "উনষাট"),
    60: ("ষাট",),
    61: ("একষট্টি",),
    62: ("বাষট্টি",),
    63: ("তেষট্টি",),
    64: ("চৌষট্টি",),
    65: ("পঁয়ষট্টি",),
    66: ("ছেষট্টি",),
    67: ("সাতষট্টি",),
    68: ("আটষট্টি",),
    69: ("ঊনসত্তর", "উনসত্তর"),
    70: ("সত্তর",),
    71: ("একাত্তর",),
    72: ("বাহাত্তর",),
    73: ("তিয়াত্তর",),
    74: ("চুয়াত্তর",),
    75: ("পঁচাত্তর",),
    76: ("ছিয়াত্তর",),
    77: ("সাতাত্তর",),
    78: ("আটাত্তর",),
    79: ("ঊনআশি", "উনআশি"),
    80: ("আশি",),
    81: ("একাশি",),
    82: ("বিরাশি",),
    83: ("তিরাশি",),
    84: ("চুরাশি",),
    85: ("পঁচাশি",),
    86: ("ছিয়াশি",),
    87: ("সাতাশি",),
    88: ("অষ্টাশি",),
    89: ("ঊননব্বই", "উননব্বই"),
    90: ("নব্বই",),
    91: ("একানব্বই",),
    92: ("বিরানব্বই",),
    93: ("তিরানব্বই",),
    94: ("চুরানব্বই",),
    95: ("পঁচানব্বই",),
    96: ("ছিয়ানব্বই",),
    97: ("সাতানব্বই",),
    98: ("আটানব্বই",),
    99: ("নিরানব্বই",),
}
# Banglish forms are short and often collide with English words ("at", "sat",
# "tin"), so they only count when the whole phrase reads as a number.
BANGLISH_NUMBERS = {
    1: ("ek",),
    2: ("dui", "du"),
    3: ("tin",),
    4: ("char",),
    5: ("panch", "pach"),
    6: ("choy", "chhoy", "soy"),
    7: ("sat", "saat"),
    8: ("at", "aat"),
    9: ("noy",),
    10: ("dosh", "dos"),
    11: ("egaro",),
    12: ("baro",),
    13: ("tero",),
    14: ("choddo", "chouddo"),
    15: ("ponero",),
    16: ("sholo", "solo"),
    17: ("shotero", "sotero"),
    18: ("atharo",),
    19: ("unish",),
    20: ("bish", "kuri"),
    25: ("pochish",),
    30: ("trish", "tirish"),
    40: ("chollish",),
    50: ("ponchash", "panchash"),
    60: ("shat",),
    70: ("sottor",),
    80: ("ashi",),
    90: ("nobboi",),
}
ENGLISH_ONES = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
}
ENGLISH_TENS = {
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}
# One and a half (দেড়) and two and a half (আড়াই) are single words in Bangla.
HALVES = {"দেড়": "1.5", "আড়াই": "2.5"}
BANGLISH_HALVES = {"der": "1.5", "dedh": "1.5", "arai": "2.5"}
# সাড়ে তিন = 3.5, সোয়া তিন = 3.25, পৌনে তিন = 2.75.
FRACTIONS = {"সাড়ে": "0.5", "সোয়া": "0.25", "পৌনে": "-0.25"}
BANGLISH_FRACTIONS = {
    "sare": "0.5",
    "soa": "0.25",
    "shoa": "0.25",
    "poune": "-0.25",
}
HUNDREDS = {"শো": True, "শত": True, "শ": True, "hundred": True, "sho": False}
SCALES = {
    "হাজার": (1000, True),
    "লাখ": (100000, True),
    "লক্ষ": (100000, False),  # also "aim" or "notice"
    "thousand": (1000, True),
    "lakh": (100000, True),
    "lakhs": (100000, True),
    "hajar": (1000, False),
    "hazar": (1000, False),
}
# Bangla numerals that are also everyday words: বার ("times"), নয় ("is not").
WEAK_BANGLA = ("বার", "নয়", "ছ")
HUNDRED_SUFFIXES = (nfc("শত"), nfc("শো"), nfc("শ"), "shoto", "sho")
# Tokens shaped like a hundreds word that the table cannot read ("…শো").
HUNDREDS_SHAPE = re.compile(nfc(r"\S+(?:শো|শত)"))
ENGLISH_MULTIPLIERS = frozenset({"hundred", "thousand", "lakh", "lakhs"})
MAX_SPOKEN = Decimal(999_999_999)


@dataclass(frozen=True)
class Numeral:
    kind: Literal["number", "tens", "fraction", "hundred", "hundreds", "scale"]
    value: Decimal
    strong: bool  # Unambiguous as a number, so an unread one blocks the command.


def numeral_table() -> dict[str, Numeral]:
    table: dict[str, Numeral] = {}

    def add(form: str, kind, value, strong: bool) -> None:
        table[nfc(form)] = Numeral(kind, Decimal(str(value)), strong)

    for value, forms in BANGLA_NUMBERS.items():
        for form in forms:
            add(form, "number", value, True)
    for value, forms in BANGLISH_NUMBERS.items():
        for form in forms:
            add(form, "number", value, False)
    for form, value in ENGLISH_ONES.items():
        add(form, "number", value, True)
    for form, value in ENGLISH_TENS.items():
        add(form, "tens", value, True)
    for form, value in HALVES.items():
        add(form, "number", value, True)
    for form, value in BANGLISH_HALVES.items():
        add(form, "number", value, False)
    for form, value in FRACTIONS.items():
        add(form, "fraction", value, True)
    for form, value in BANGLISH_FRACTIONS.items():
        add(form, "fraction", value, False)
    for form, strong in HUNDREDS.items():
        add(form, "hundred", 100, strong)
    for form, (value, strong) in SCALES.items():
        add(form, "scale", value, strong)
    for form in WEAK_BANGLA:
        entry = table[nfc(form)]
        table[nfc(form)] = Numeral(entry.kind, entry.value, False)
    return table


NUMERALS = numeral_table()
ENGLISH_DIGITS = frozenset(
    form for form, value in ENGLISH_ONES.items() if 1 <= value <= 9
)


def numeral(token: str) -> Numeral | None:
    """Classify one token as part of a spoken number, or return None."""
    entry = NUMERALS.get(token)
    if entry is not None:
        return entry
    # Hundreds written as one word: দুইশো, দেড়শো, পনেরোশো, dusho.
    for suffix in HUNDRED_SUFFIXES:
        if token.endswith(suffix) and len(token) > len(suffix):
            base = NUMERALS.get(token[: -len(suffix)])
            if base is not None and base.kind == "number" and 0 < base.value < 100:
                return Numeral("hundreds", base.value, base.strong)
    if HUNDREDS_SHAPE.fullmatch(token):
        return Numeral("hundreds", Decimal(0), True)  # unreadable, never accepted
    return None


def read_number(tokens: list[str]) -> Decimal | None:
    """Read a whole spoken number, or return None if any part is irregular.

    Accepted shapes: a number below one hundred (one word in Bangla, or an
    English tens word followed by a digit word), optionally preceded by সাড়ে,
    সোয়া or পৌনে; a hundreds group (দুইশো, two hundred); and descending
    thousand and lakh groups, joined in English by "and".
    """
    total = Decimal(0)
    group: Decimal | None = None  # hundreds within the current scale group
    small: Decimal | None = None  # the part below one hundred
    open_tens = False  # "twenty" may still take "five"
    fraction: Decimal | None = None
    last_scale: Decimal | None = None
    joined = False  # an "and" is waiting for the next number
    for token in tokens:
        if NUMBER.fullmatch(token):
            entry = Numeral("number", Decimal(token), True)
        elif token == "a":
            entry = Numeral("number", Decimal(1), False)
        elif token == "and":
            if joined or fraction is not None or small is not None:
                return None
            if group is None and last_scale is None:
                return None
            joined = True
            continue
        else:
            entry = numeral(token)
            if entry is None:
                return None
        value = entry.value
        if entry.kind == "fraction":
            if fraction is not None or small is not None:
                return None
            fraction = value
        elif entry.kind in ("number", "tens"):
            if small is not None:
                if open_tens and token in ENGLISH_DIGITS and fraction is None:
                    small += value
                    open_tens = False
                    continue
                return None
            if fraction is not None:
                if value < 1 or value != value.to_integral_value():
                    return None
                value += fraction
                fraction = None
            small = value
            open_tens = entry.kind == "tens"
            joined = False
        elif entry.kind == "hundreds":
            if value == 0 or small is not None or group is not None or joined:
                return None
            if fraction is not None:
                if value != value.to_integral_value():
                    return None
                value += fraction
                fraction = None
            if last_scale is not None and value >= 10:
                return None
            group = value * 100
        elif entry.kind == "hundred":
            if small is None or group is not None or fraction is not None or joined:
                return None
            if small >= 100 or (last_scale is not None and small >= 10):
                return None
            group = small * 100
            small = None
            open_tens = False
        else:  # scale
            if fraction is not None or joined or (small is None and group is None):
                return None
            if last_scale is not None and value >= last_scale:
                return None
            total += ((group or 0) + (small or 0)) * value
            group = small = None
            open_tens = False
            last_scale = value
    if fraction is not None or joined:
        return None
    if small is None and group is None and last_scale is None:
        return None
    value = total + (group or 0) + (small or 0)
    if value > MAX_SPOKEN:
        return None
    if value == value.to_integral_value():
        return value.quantize(Decimal(1))
    return value.normalize()


def is_numeral(tokens: list[str], index: int) -> bool:
    token = tokens[index]
    if NUMBER.fullmatch(token) or numeral(token) is not None:
        return True
    following = tokens[index + 1] if index + 1 < len(tokens) else ""
    if token == "a":  # "a hundred kg"
        return following in ENGLISH_MULTIPLIERS
    if token == "and":  # "two hundred and fifty"
        return index > 0 and following != "" and is_numeral(tokens, index + 1)
    return False


def number_runs(tokens: list[str]) -> list[tuple[int, int]]:
    """Spans of consecutive tokens that may form one spoken number."""
    runs = []
    index = 0
    while index < len(tokens):
        if tokens[index] == "and" or not is_numeral(tokens, index):
            index += 1
            continue
        start = index
        while index < len(tokens) and is_numeral(tokens, index):
            index += 1
        runs.append((start, index))
    return runs


def is_strong(token: str) -> bool:
    if NUMBER.fullmatch(token) or token in ("a", "and"):
        return False
    entry = numeral(token)
    return entry is not None and entry.strong


def droppable(token: str) -> bool:
    """A weak whole-number word that may be an ordinary word instead.

    Fractions and halves are never dropped: reading "sare 3 mon" as 3 maunds
    would silently change the amount."""
    if token in ("a", "and"):
        return True
    if NUMBER.fullmatch(token) or is_strong(token):
        return False
    entry = numeral(token)
    if entry is None:
        return False
    return entry.kind != "fraction" and entry.value == entry.value.to_integral_value()


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


Quantities = tuple[list[tuple[Decimal, Unit]], bool, bool]


def digit_quantities(tokens: list[str], start: int, end: int) -> Quantities:
    """Numbers written in digits, each read on its own."""
    pairs: list[tuple[Decimal, Unit]] = []
    bare = False
    for index in range(start, end):
        token = tokens[index]
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
    return pairs, bare, False


def run_quantities(tokens: list[str], start: int, end: int) -> Quantities:
    if start >= end:
        return [], False, False
    run = tokens[start:end]
    if all(NUMBER.fullmatch(token) for token in run):
        return digit_quantities(tokens, start, end)
    previous = tokens[start - 1] if start else ""
    following = tokens[end] if end < len(tokens) else ""
    if previous in CURRENCY or following in CURRENCY:
        return [], False, False  # a price said in words, not a quantity
    unit = UNITS.get(following)
    value = read_number(run)
    if value is not None and unit is not None:
        return [(value, unit)], False, False
    if droppable(run[0]):
        # A leading Banglish word ("at 200 kg") may not be a number at all,
        # so read the rest without it.
        return run_quantities(tokens, start + 1, end)
    if any(not NUMBER.fullmatch(token) and not droppable(token) for token in run):
        return [], False, True
    return digit_quantities(tokens, start, end)


def quantities(text: str) -> Quantities:
    """Return (number, unit) pairs, whether a number had no unit, and whether
    a number said in words could not be read."""
    tokens = text.split()
    pairs: list[tuple[Decimal, Unit]] = []
    bare = unread = False
    for start, end in number_runs(tokens):
        found, run_bare, run_unread = run_quantities(tokens, start, end)
        pairs.extend(found)
        bare = bare or run_bare
        unread = unread or run_unread
    return pairs, bare, unread


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
    pairs, bare, unread = quantities(normalized)
    if unread:
        return Interpretation("unknown", reason="number_words", candidates=(tool,))
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
