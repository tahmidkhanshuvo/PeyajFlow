"""Reproducible BPE budgets without breaking Unicode into invalid byte fragments."""

import os
from functools import lru_cache

import tiktoken

ENCODING = "cl100k_base"
CHUNK_VERSION = "bpe-v1"


@lru_cache(maxsize=1)
def tokenizer():
    return tiktoken.get_encoding(ENCODING)


def token_count(text: str) -> int:
    return len(tokenizer().encode(text, disallowed_special=()))


def chunk_budget() -> int:
    budget = int(os.getenv("KNOWLEDGE_CHUNK_TOKENS", "512"))
    if not 32 <= budget <= 2048:
        raise ValueError("KNOWLEDGE_CHUNK_TOKENS must be 32–2048")
    return budget


def split_passage(text: str, budget: int | None = None):
    budget = chunk_budget() if budget is None else budget
    if not 32 <= budget <= 2048:
        raise ValueError("Chunk token budget must be 32–2048")
    while text:
        # A second character bound keeps whole passages within provider payload
        # limits. The BPE budget is the primary bound, including for Bangla.
        end = min(len(text), 1800)
        if token_count(text[:end]) > budget:
            low, high = 1, end
            while low < high:
                middle = (low + high + 1) // 2
                if token_count(text[:middle]) <= budget:
                    low = middle
                else:
                    high = middle - 1
            end = low
        if end < len(text):
            boundary = max(text.rfind("\n", 0, end), text.rfind(" ", 0, end))
            if boundary >= end // 2:
                end = boundary + 1
        # Recheck because BPE token counts need not be monotone at every prefix.
        while token_count(text[:end]) > budget:
            end -= 1
        yield text[:end]
        text = text[end:]
