"""Bounded per-worker TTL cache: hashed keys and public-source answers only."""

import hashlib
import json
import os
import threading
from collections import OrderedDict
from copy import deepcopy
from time import monotonic

from app.features import enabled

_entries = OrderedDict()
_lock = threading.Lock()


def settings() -> tuple[int, int]:
    try:
        ttl = max(0, min(3600, int(os.getenv("KNOWLEDGE_CACHE_TTL_SECONDS", "300"))))
        size = max(1, min(1024, int(os.getenv("KNOWLEDGE_CACHE_MAX_ENTRIES", "128"))))
    except ValueError:
        return 0, 128
    return (ttl if enabled("KNOWLEDGE_CACHE_ENABLED") else 0), size


def key(parts: list) -> str:
    return hashlib.sha256(
        json.dumps(parts, ensure_ascii=False, default=str, sort_keys=True).encode()
    ).hexdigest()


def get(cache_key: str) -> dict | None:
    ttl, size = settings()
    with _lock:
        if not ttl:
            _entries.clear()
            return None
        while len(_entries) > size:
            _entries.popitem(last=False)
        row = _entries.get(cache_key)
        if row is None:
            return None
        created, expires, answer = row
        now = monotonic()
        if now >= expires or now - created >= ttl:
            del _entries[cache_key]
            return None
        _entries.move_to_end(cache_key)
        return deepcopy(answer)


def put(cache_key: str, answer: dict) -> None:
    ttl, size = settings()
    # Do not prolong missing-evidence or provider outages with cached abstentions.
    if not ttl or answer.get("status") != "answered":
        return
    with _lock:
        now = monotonic()
        _entries[cache_key] = (now, now + ttl, deepcopy(answer))
        _entries.move_to_end(cache_key)
        while len(_entries) > size:
            _entries.popitem(last=False)
