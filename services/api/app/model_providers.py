"""Bounded model calls. Callers send questions/public passages, never account records."""

import json
import math
import os
import re
from urllib.error import URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # An authenticated inference endpoint must never forward its secret to
        # a redirected host. Configure the final HTTPS proxy origin directly.
        return None


def ollama_json(path: str, body: dict | None = None, *, timeout: int = 2):
    headers = {"Content-Type": "application/json"}
    if os.getenv("OLLAMA_API_KEY"):
        headers["Authorization"] = "Bearer " + os.environ["OLLAMA_API_KEY"]
    try:
        request = Request(
            ollama_base() + path,
            headers=headers,
            data=json.dumps(body).encode() if body is not None else None,
        )
        with build_opener(NoRedirect()).open(request, timeout=timeout) as response:
            raw = response.read(2_000_001)
        value = json.loads(raw) if len(raw) <= 2_000_000 else None
        return value if isinstance(value, dict) else None
    except (URLError, OSError, ValueError, TimeoutError):
        return None


def post(url: str, body: dict, headers: dict | None = None, timeout: int = 30):
    try:
        request = Request(
            url,
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", **(headers or {})},
            method="POST",
        )
        with urlopen(request, timeout=timeout) as response:
            raw = response.read(2_000_001)
        return json.loads(raw) if len(raw) <= 2_000_000 else None
    except (URLError, OSError, ValueError, TimeoutError):
        return None


def ollama_base() -> str:
    return os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")


def ask(
    provider: str, system: str, question: str, *, model: str | None = None
) -> dict | None:
    if len(system) > 24000 or len(question) > 2000:
        return None
    if provider == "ollama":
        result = ollama_json(
            "/api/chat",
            {
                "model": model
                or os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct-q4_K_M"),
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": question},
                ],
                "format": "json",
                "stream": False,
                "options": {"temperature": 0, "num_predict": 600, "num_ctx": 4096},
            },
            timeout=60,
        )
        content = (result or {}).get("message", {}).get("content")
    elif provider == "gemini" and os.getenv("GEMINI_API_KEY"):
        model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
        if not re.fullmatch(r"[a-z0-9.-]{1,64}", model):
            return None
        result = post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            {
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": question}]}],
                "generationConfig": {
                    "temperature": 0,
                    "responseMimeType": "application/json",
                    "maxOutputTokens": 700,
                },
            },
            {"x-goog-api-key": os.environ["GEMINI_API_KEY"]},
        )
        try:
            content = result["candidates"][0]["content"]["parts"][0]["text"]
        except (TypeError, KeyError, IndexError):
            return None
    elif provider == "meta" and os.getenv("MODEL_API_KEY") and os.getenv("META_MODEL"):
        result = post(
            os.getenv("MODEL_API_BASE", "https://api.meta.ai/v1/chat/completions"),
            {
                "model": os.environ["META_MODEL"],
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": question},
                ],
                "max_completion_tokens": 700,
            },
            {"Authorization": "Bearer " + os.environ["MODEL_API_KEY"]},
        )
        try:
            content = result["choices"][0]["message"]["content"]
        except (TypeError, KeyError, IndexError):
            return None
    else:
        return None
    try:
        value = json.loads(content)
        return value if isinstance(value, dict) else None
    except (TypeError, ValueError):
        return None


def embedding_identity() -> str | None:
    provider = os.getenv("EMBEDDING_PROVIDER", "none")
    if provider == "ollama":
        model = os.getenv("OLLAMA_EMBED_MODEL", "bge-m3")
        try:
            installed = (ollama_json("/api/tags") or {}).get("models", [])
            digest = next(
                item["digest"]
                for item in installed
                if item["name"] in {model, model + ":latest"}
            )
            if not re.fullmatch(r"[0-9a-f]{64}", digest):
                return None
            return f"ollama/{model}@{digest}"
        except (URLError, OSError, ValueError, KeyError, TypeError, StopIteration):
            return None
    if provider == "gemini":
        return "gemini/" + os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
    return None


def embed(text: str) -> tuple[str, list[float]] | None:
    identity = embedding_identity()
    if not identity:
        return None
    provider, model = identity.split("/", 1)
    if provider == "ollama":
        model = model.split("@", 1)[0]
        data = ollama_json(
            "/api/embed",
            {"model": model, "input": text[:12000]},
            timeout=60,
        )
        try:
            vector = data["embeddings"][0]
        except (TypeError, IndexError, KeyError):
            return None
    else:
        if not re.fullmatch(r"[a-z0-9.-]{1,64}", model) or not os.getenv(
            "GEMINI_API_KEY"
        ):
            return None
        data = post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent",
            {
                "model": "models/" + model,
                "content": {"parts": [{"text": text[:12000]}]},
            },
            {"x-goog-api-key": os.environ["GEMINI_API_KEY"]},
        )
        try:
            vector = data["embedding"]["values"]
        except (TypeError, KeyError):
            return None
    if (
        not isinstance(vector, list)
        or not 16 <= len(vector) <= 4096
        or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in vector)
    ):
        return None
    return identity, vector
