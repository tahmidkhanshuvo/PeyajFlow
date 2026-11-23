"""Operator-controlled switches, enforced at the API security boundary."""

import os

from fastapi import HTTPException


def enabled(name: str, default: bool = True) -> bool:
    return os.getenv(name, str(default)).casefold() in {"true", "1", "yes", "on"}


def require(name: str, detail: str) -> None:
    if not enabled(name):
        raise HTTPException(503, detail)
