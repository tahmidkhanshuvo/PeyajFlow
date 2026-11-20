"""Optional language-model fallback for voice commands the grammar misses.

The deterministic grammar in ``app.intent`` always runs first and decides.
The model is asked only when the grammar found no command at all
(``no_match``). It is never asked to overturn a refusal: negated, uncertain,
ambiguous, out-of-scope and unreadable-quantity phrases keep their refusal.

The model may only choose one command from the fixed list. A quantity it
returns is used only if the grammar read the same quantity from the user's
own words, so the model cannot invent an amount. A resolved command still
goes through the same read-back, form check and keypad or PIN confirmation.

Only the phrase is sent, never account data. The fallback is off unless
``VOICE_MODEL_FALLBACK=true``. ``VOICE_MODEL_PROVIDER`` chooses the model:

- ``meta``: Meta Model API (``MODEL_API_KEY``, ``META_MODEL``);
- ``gemini``: Google Gemini API (``GEMINI_API_KEY``, ``GEMINI_MODEL``);
- ``both``: ask both and use the answer only when they choose the same
  command and quantity.

Any failure, timeout, disagreement or unexpected answer leaves the
grammar's result.
"""

import json
import os
import re
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app import intent as grammar

ENDPOINT = "https://api.meta.ai/v1/chat/completions"
GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_DEFAULT = "gemini-3.5-flash-lite"
TIMEOUT_SECONDS = 8
MAX_PHRASE = 200
DESCRIPTIONS = {
    "prices": "hear market prices",
    "stock": "hear my own stock",
    "advice": "hear hold-or-sell advice",
    "offers": "hear offers I received or sent",
    "orders": "hear my orders or deliveries",
    "accept": "accept a buyer's offer",
    "reject": "reject or decline an offer",
    "counter": "propose different terms on an existing offer",
    "movement": "record a stock weight change or a loss (rot, damage)",
    "register": "register a new lot of stock",
    "send_offer": "a buyer sends a new offer to buy",
    "transport": "request a truck or transport",
    "inspection": "ask someone to come and inspect stored onions",
    "support": "talk to a person or get help",
}
SYSTEM = (
    "You classify one request to PeyajFlow, an onion trading assistant used by "
    "Bangladeshi farmers and buyers. The request may be Bangla, Banglish or "
    "English. Choose exactly one command from this list, or none:\n"
    + "\n".join(f"- {name}: {text}" for name, text in DESCRIPTIONS.items())
    + "\nAnswer only with JSON: "
    '{"command": "<name or none>", "quantity": <number or null>, '
    '"unit": "kg" | "maund" | null, "loss": true | false}. '
    "Use none if the request is unclear, refuses or negates an action, asks "
    "whether to do something, mentions another crop, or asks for anything not "
    "in the list. Give a quantity only if the user said it, with its unit; "
    "never guess one. loss is true only for a stock loss such as rot or damage."
)

Ask = Callable[[str], dict | None]


def provider() -> str:
    return os.getenv("VOICE_MODEL_PROVIDER", "meta")


def configured(name: str) -> bool:
    if name == "meta":
        return bool(os.getenv("MODEL_API_KEY") and os.getenv("META_MODEL"))
    if name == "gemini":
        return bool(os.getenv("GEMINI_API_KEY"))
    return False


def enabled() -> bool:
    if os.getenv("VOICE_MODEL_FALLBACK") != "true":
        return False
    choice = provider()
    if choice == "both":
        return configured("meta") and configured("gemini")
    return configured(choice)


def model_name() -> str:
    choice = provider()
    names = {
        "meta": os.getenv("META_MODEL", ""),
        "gemini": os.getenv("GEMINI_MODEL", GEMINI_DEFAULT),
    }
    if choice == "both":
        return f"{names['meta']}+{names['gemini']}"
    return names.get(choice, "")


def parse(content: str | None) -> dict | None:
    """The first JSON object in the model's reply, if it has the right shape."""
    if not content:
        return None
    match = re.search(r"\{.*\}", content, re.S)
    if not match:
        return None
    try:
        answer = json.loads(match.group(0))
    except ValueError:
        return None
    if not isinstance(answer, dict) or not isinstance(answer.get("command"), str):
        return None
    return answer


def post(url: str, body: dict, headers: dict) -> dict | None:
    request = Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read(65536))
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        return None


def ask_meta(phrase: str) -> dict | None:
    data = post(
        os.getenv("MODEL_API_BASE", ENDPOINT),
        {
            "model": os.environ["META_MODEL"],
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": phrase},
            ],
            "max_completion_tokens": 600,
            "reasoning_effort": "low",
        },
        {"Authorization": f"Bearer {os.environ['MODEL_API_KEY']}"},
    )
    try:
        return parse(data["choices"][0]["message"].get("content")) if data else None
    except (KeyError, IndexError, TypeError):
        return None


def ask_gemini(phrase: str) -> dict | None:
    model = os.getenv("GEMINI_MODEL", GEMINI_DEFAULT)
    if not re.fullmatch(r"[a-z0-9.-]{1,64}", model):
        return None
    data = post(
        f"{GEMINI_ENDPOINT}/{model}:generateContent",
        {
            "systemInstruction": {"parts": [{"text": SYSTEM}]},
            "contents": [{"role": "user", "parts": [{"text": phrase}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0,
                "maxOutputTokens": 300,
            },
        },
        {"x-goog-api-key": os.environ["GEMINI_API_KEY"]},
    )
    try:
        return parse(data["candidates"][0]["content"]["parts"][0].get("text"))
    except (KeyError, IndexError, TypeError):
        return None


def same(first: dict | None, second: dict | None) -> dict | None:
    """One answer when two models agree on the command and the quantity."""
    if not first or not second:
        return None
    if first.get("command") != second.get("command"):
        return None
    if number(first.get("quantity")) != number(second.get("quantity")):
        return None
    return {**first, "loss": first.get("loss") is True or second.get("loss") is True}


def ask_model(phrase: str) -> dict | None:
    """Ask the configured provider; any failure returns None."""
    choice = provider()
    if choice == "meta":
        return ask_meta(phrase)
    if choice == "gemini":
        return ask_gemini(phrase)
    if choice == "both":
        with ThreadPoolExecutor(2) as pool:
            meta, gemini = pool.map(lambda ask: ask(phrase), (ask_meta, ask_gemini))
        return same(meta, gemini)
    return None


def number(value: object) -> Decimal | None:
    if isinstance(value, bool) or not isinstance(value, int | float | str):
        return None
    try:
        amount = Decimal(str(value))
    except InvalidOperation:
        return None
    return amount if amount.is_finite() and abs(amount) <= grammar.MAX_SPOKEN else None


def understand(phrase: str, ask: Ask | None = None) -> grammar.Interpretation:
    result = grammar.interpret(phrase)
    if result.status != "unknown" or result.reason != "no_match":
        return result  # the grammar decided, including every refusal
    if ask is None:
        if not enabled():
            return result
        ask = ask_model
    normalized = grammar.normalize(phrase)
    if not normalized or len(phrase) > MAX_PHRASE:
        return result
    # Defence in depth: never send a phrase with a negation or doubt.
    if grammar.NEGATION.search(normalized) or grammar.UNCERTAIN.search(normalized):
        return result
    answer = ask(phrase)
    tool = answer.get("command") if answer else None
    if tool not in grammar.TOOLS:
        return result
    loss = tool == "movement" and (
        answer.get("loss") is True or bool(re.search(grammar.LOSS, normalized))
    )
    if tool not in grammar.QUANTITY_TOOLS:
        return grammar.Interpretation("resolved", tool, match="model")
    pairs, _bare, unread, several = grammar.quantities(normalized)
    if unread or several or len(pairs) > 1:
        return grammar.Interpretation(
            "unknown", reason="number_words", candidates=(tool,)
        )
    amount, unit = number(answer.get("quantity")), answer.get("unit")
    heard = pairs[0] if pairs else None
    if amount is None and heard is None:
        return grammar.Interpretation("resolved", tool, match="model", loss=loss)
    # The amount must be one the user said and the grammar read.
    if heard is None or amount not in (None, heard[0]) or unit not in (None, heard[1]):
        return grammar.Interpretation(
            "unknown", reason="model_quantity", candidates=(tool,)
        )
    if heard[0] <= 0:
        return grammar.Interpretation(
            "unknown", reason="invalid_quantity", candidates=(tool,)
        )
    return grammar.Interpretation(
        "resolved", tool, heard[0], heard[1], match="model", loss=loss
    )
