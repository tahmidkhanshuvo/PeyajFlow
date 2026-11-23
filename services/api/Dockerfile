FROM ghcr.io/astral-sh/uv:0.13.7 AS uv
FROM python:3.13-slim

COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    TIKTOKEN_CACHE_DIR=/app/.tokenizers

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
RUN python -c "import tiktoken; tiktoken.get_encoding('cl100k_base')"
COPY alembic.ini ./
COPY migrations migrations
COPY app app
COPY --chmod=755 start-hosted.sh /app/start-hosted.sh

RUN useradd --system --uid 10001 peyajflow \
    && install -d -o peyajflow -g peyajflow /var/lib/peyajflow/photos
USER peyajflow
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\" --no-access-log"]
