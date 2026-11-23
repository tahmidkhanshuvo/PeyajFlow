# Public knowledge, cost controls and Ollama

Implemented November 23, 2026. These are application capabilities and configuration instructions; they do not provision or change cloud hosting. External agronomy sources remain deferred.

## Import a PDF or Markdown guide

Imports are an operator-run CLI, not a public upload endpoint. Review publication rights, extracted text and agronomy content before indexing. Only explicitly public material belongs here; never import account records or personal data. PDF extraction supports selectable text, not OCR. Encrypted PDFs, empty/scanned pages, files over 10 MB, more than 25 pages, oversized extracted content and extraction over 30 seconds are refused. Extraction uses a separate process; Linux containers also impose memory/CPU limits. Layout and Bangla font mappings can affect extraction accuracy, so validate the actual document.

Place files beside a UTF-8 JSON manifest. All fields below are required; unknown fields and paths outside that folder are rejected. This example is illustrative, not an imported agronomy source:

```json
[
  {
    "id": "reviewed-public-guide",
    "title": "Reviewed public guide",
    "source_url": "https://example.org/guide.pdf",
    "licence": "Replace with the actual permission or licence",
    "updated_on": "2026-11-23",
    "language": "bn",
    "path": "guide.pdf",
    "public": true
  }
]
```

From `services/api`, with the locked environment installed:

```sh
uv run --locked python -m app.knowledge_import --manifest /path/to/manifest.json --validate-only
# Review extraction without a database write:
uv run --locked python -m app.knowledge_import --extract /path/to/guide.pdf
# DATABASE_URL must point to the intended application database.
uv run --locked python -m app.knowledge_import --manifest /path/to/manifest.json --contextual --require-context
```

The validation command checks parsing/provenance and reports counts; it does not certify the facts or licence. PDF citations retain page numbers; Markdown citations retain headings. Reusing a document ID replaces that document when its source or chunk configuration changes. Imports are atomic: `--require-context` refuses to commit if any requested Ollama context fails. Imports do not delete unrelated documents.

## Token budgets and context generation

`KNOWLEDGE_CHUNK_TOKENS=512` bounds passages using tiktoken `cl100k_base` BPE tokens, preserving original Unicode and headings. Accepted budgets are 32–2048, with an additional 1,800-character provider payload cap. This is a reproducible reference tokenizer, not Ollama's model-specific tokenizer. The tokenizer vocabulary is fetched and hash-checked during Docker image build, then available offline at runtime.

Context generation always calls Ollama with `OLLAMA_CONTEXT_MODEL` (default `qwen2.5:7b-instruct-q4_K_M`), independently of `KNOWLEDGE_PROVIDER=extractive`. Only public passages/title/heading are sent. The generated line is a retrieval hint; answers still cite original passages. Model output is not independently verified agronomy evidence. Unchanged generated context is reused. After changing weights under an existing model tag, use `--refresh-context` explicitly.

On small machines, avoid alternating the chat and embedding models on every chunk. Run two passes, sequentially:

```sh
# First pass: generate all context using the chat model, without embeddings.
EMBEDDING_PROVIDER=none uv run --locked python -m app.knowledge_seed --contextual --require-context
# Second pass: preserve that context and generate vectors with bge-m3.
EMBEDDING_PROVIDER=ollama uv run --locked python -m app.knowledge_seed
```

For imported documents, use `app.knowledge_import --manifest ...` with the same two-pass approach. Re-index after changing chunk budgets. Source/context changes invalidate vectors. Regenerate embeddings before evaluating vector or hybrid retrieval.

## Connect a cloud API to Ollama

A cloud API's `127.0.0.1` means that cloud container. `host.docker.internal` is for a workstation Docker host; it does not make a laptop reachable from a cloud deployment. Use a stable, reachable Ollama server on a private network or behind an authenticated HTTPS reverse proxy. Provisioning that server/network is deferred.

Set these **on the API service and the operator's ingestion environment**, using the platform's secret store for the key:

```dotenv
OLLAMA_BASE_URL=https://ollama.your-domain.example
OLLAMA_API_KEY=replace-with-your-proxy-bearer-secret
OLLAMA_CONTEXT_MODEL=qwen2.5:7b-instruct-q4_K_M
OLLAMA_MODEL=qwen2.5:7b-instruct-q4_K_M
OLLAMA_EMBED_MODEL=bge-m3
EMBEDDING_PROVIDER=ollama
KNOWLEDGE_PROVIDER=extractive
```

The origin must be the final URL: authenticated requests refuse redirects. The shared transport sends the Bearer credential to `/api/tags`, `/api/chat` and `/api/embed`. `OLLAMA_API_KEY` authenticates your proxy; it does not enable authentication inside native Ollama. Configure the proxy to verify that credential and forward only the required inference routes. Keep native port 11434 bound to loopback/private networking. Never expose the credential through `NEXT_PUBLIC_*`, the browser, source control or logs. Private-network HTTP is supported where network access is already restricted; use HTTPS across public networks.

On the inference host, install/pull the selected tags. Verify connectivity from the API environment using the operator-only `/v1/integrations/models` endpoint: `available=true` and the expected model names/digests. Then run strict contextual ingestion, generate embeddings and run the saved retrieval evaluation. The ordinary readiness endpoint does not certify Ollama or seeded knowledge. A missing runtime causes keyword fallback or context-import refusal; it must not be described as working vector retrieval.

Official references: [Ollama network/proxy configuration](https://github.com/ollama/ollama/blob/main/docs/faq.mdx), [pypdf extraction limits](https://github.com/py-pdf/pypdf/blob/main/docs/user/extract-text.md), [tiktoken](https://github.com/openai/tiktoken/blob/main/README.md).

## Independent cost switches

| API environment variable      | Default | Effect when false                                                                      |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `KNOWLEDGE_ENABLED`           | `true`  | Refuses knowledge answers, including cached answers                                    |
| `KNOWLEDGE_CACHE_ENABLED`     | `true`  | Bypasses answer caching                                                                |
| `AUTOMATION_ENABLED`          | `true`  | Refuses jobs, CSV staging and new digest consent; opt-out and history remain available |
| `OPERATOR_ASSISTANT_ENABLED`  | `true`  | Refuses new investigations and review/resume; history remains available                |
| `LOCAL_MODEL_PREVIEW_ENABLED` | `true`  | Refuses local-model previews                                                           |
| `VOICE_MODEL_FALLBACK`        | `false` | Keeps optional model fallback off; deterministic voice handling continues              |

The knowledge cache is bounded, in memory, per API worker: default 300-second TTL and 128 entries (`KNOWLEDGE_CACHE_TTL_SECONDS`, maximum 3600; `KNOWLEDGE_CACHE_MAX_ENTRIES`, maximum 1024). It caches answered public-source replies only. Account/cohort, locale, question hash, source/context revision and configured answer-provider/model names and installed embedding identity separate entries. Authorization and rate limits run on hits. Abstentions are not cached. Private workspace reads are not cached here. Restarts clear the cache; workers do not share it, and simultaneous misses can still each compute an answer.

## Automation status

The existing four n8n workflow templates remain available: weekly digest, freshness check, alert routing and CSV intake. They call scoped API endpoints; retries use audited idempotency keys. The switch is enforced by the API even when a scheduler continues firing. Configure a dedicated verified operator credential and activate schedules only after choosing timing and recipients. Weekly digests currently create in-app notifications. External email/Telegram delivery and carrier SMS are not configured; no channel or recipient was supplied for this task. Hosting and external delivery setup remain deferred.
