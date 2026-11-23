# Knowledge and integration tools

Implemented locally on `codex/ai-platform-features`, November 21–22, 2026. This is not a hosted deployment or an independent field-validation claim.

## Web entry points

| Page | Capability |
| --- | --- |
| Help | Bangla, Banglish and English questions, dated citations, full source passages and authorized assistance requests/resolution |
| Chatbot | Scoped workspace reads and sourced help; fixed sample prices, stock and the fictional hotline were removed |
| Profile → Integration access | Create a scoped token, copy it once, list expiry and revoke it |
| Workspace tools | Digest consent, operator investigations, note review, automation receipts, source age and local model previews |
| Market prices | Historical price ranges, forecast intervals and replay MAE charts |
| Hold or sell | Comparable verified weights, a gated experimental fit and net-proceeds charts |
| Operations → Photo model | Recorded prediction/reviewer pairs, subject to the existing minimum sample |

Charts include accessible tables. Missing evidence stays missing. The fitted weight history uses the same comparable readings as the loss model; stock additions, corrections and dispatch reset the comparison period. The restored dialer and its existing chatbot entry remain in place.

The dialer creates an authorized simulator session at 7392 and opens the existing read-back/keypad interface. Sourced help in that session is read-only. Stock overview prices and hold/sell labels now use actual API evidence; invented fallback prices and automatic acknowledgement of scenario assumptions were removed.

The prices page also uses approved observations in place of the static regional table, omits invented forecast defaults, identifies experimental candidate ranges and exposes actual replay metrics. Demand-specific supply matching and stock risk/scenario links are available in the current layout.

Dashboard comparisons select actual series and leave absent districts empty. The transport modal links to the full quote and booking page. Dialer clock hydration is stable across timezones, and calling waits for client readiness.

## Running locally

This machine uses web **3005**, API **8010**, PostgreSQL **5544**, MCP **8002** and n8n **5678**, because another project occupies the default ports. Non-secret local Compose overrides are saved in the ignored root `.env`. No hosting settings were changed.

Compose and CI now use `pgvector/pgvector:0.8.1-pg16`. Revisions `0023_integrations` and `0024_digest` add tokens, public knowledge, consent, job receipts, graph persistence and notification summaries. Deploy those before their web screens.

```sh
docker compose --profile integrations --profile automation up --build -d
docker compose exec api python -m app.seed_showcase
docker compose exec api python -m app.knowledge_seed
pnpm --filter @peyajflow/web dev --port 3005
```

Set the web's server-side `API_INTERNAL_BASE_URL` to the selected API origin. Preserve the existing cookie configuration. Never forward a session to another project's API.

The current API container uses the existing native Ollama runtime at `http://host.docker.internal:11434`. The optional `ai` profile supplies a separate runtime: choose an unused host port and set the container API's model origin to `http://ollama:11434` when using it. Local inference runs on the server, not a farmer's device. It does not make the web/API available offline.

After a workstation restart, start the installed Ollama app before using local-model previews or vector queries. When that runtime is unavailable, cited help falls back to keyword retrieval and previews report unavailability. The saved local model experiments below were run with Ollama available; they do not imply it is always running.

## Tokens and MCP

Tokens are hashed, expiring, revocable and rate limited. Scopes narrow the account's existing role, verification, delegation and demo-cohort permissions; they never grant another account's data. Tokens cannot read private photos, change profiles, accept offers, move stock or approve imports.

| Scope | Permission |
| --- | --- |
| `market:read` | Series, approved prices and forecasts |
| `lots:read` | Authorized lots, risk and default advice |
| `trade:read` | Scoped offer/order lists |
| `knowledge:read` | Public help and sources |
| `operations:read` | Operator freshness, overview and disputes |
| `automation:run` | Three allowlisted jobs; verified operators only |
| `imports:stage` | Stage a CSV; verified operators only |

The final two are automation permissions, distinct from read-only MCP scopes. Use a dedicated verified operator identity for scheduled work.

The official MCP SDK server is `services/api/app/mcp_server.py`, using the locked API environment. It calls HTTP endpoints, never PostgreSQL. HTTP forwards each request's bearer independently; stdio takes a scoped credential from its client's secret environment. Setup is in `services/mcp/README.md`. SDK checks exercised both transports, public resources, prompts, reads and role/anonymous denials. The recorded inventory is `docs/design-reviews/integrations/mcp-inventory.json`: nine tools, two static resources, one resource template and two prompts.

## Knowledge retrieval

The corpus contains fifteen original bilingual help documents, permitted for first-party application retrieval. No private account records or unlicensed external extension guides are indexed. It does not establish a safe onion-storage duration or replace lot-specific evidence.

Ingestion preserves headings, bounds passages, records source/licence/date and optionally generates a model-written context prefix. Retrieval combines PostgreSQL full-text search and pgvector with reciprocal-rank fusion and trade-term expansion. Tokenization preserves Bangla vowel signs and conjuncts. Embedding spaces are separated by provider, model digest and dimensions. Re-ingesting without a provider preserves existing vectors; changed source content invalidates them.

`KNOWLEDGE_PROVIDER=extractive` works without generation credentials. Configured generators may select exact source extracts; invented quotations and unknown citation IDs are refused. Answers show dated citations and a general-information notice. `KNOWLEDGE_ENABLED=false` disables the answer endpoint. `প্রশ্ন …` and `ask …` also read help in the simulated phone channels, after any pending confirmation is resolved or cancelled.

```sh
# In services/api, with DATABASE_URL configured:
uv run --locked python -m app.knowledge_seed
# For vectors: EMBEDDING_PROVIDER=ollama, OLLAMA_EMBED_MODEL=bge-m3.
# For model context also select KNOWLEDGE_PROVIDER and OLLAMA_MODEL.
uv run --locked python -m app.knowledge_seed --contextual
uv run --locked python -m evals.rag_eval --check --min-recall 0.95 --label local
```

`rag-final-hybrid.json` records 60 answerable development questions and five out-of-scope questions: keyword recall@5 **0.983**, vector-only **0.783**, hybrid **1.000**, hybrid MRR **0.983**, and abstention on all five out-of-scope questions. The local index has fifteen vectors and three model-written context prefixes. These are same-author development measurements. Independent challenge questions and human support/relevance review remain open. No reranker has been adopted.

## Local command models and DSPy

`VOICE_MODEL_PROVIDER=ollama` adds local inference, while command fallback remains off by default. Deterministic refusals win. Crop/quantity-only fragments do not reach a model; quantities must agree with the grammar; changes still require read-back and PIN/code confirmation. The web preview cannot stage anything.

Qwen 2.5 7B and Llama 3.1 8B were downloaded and evaluated. The original 20-row unmatched-phrase experiments measured **0.800** and **0.750**, respectively. Broader experiments exposed false actions, so these candidates were not enabled for live command fallback. Failed reports remain beside later guard checks; expected labels were not changed. The machine has about 16 GB RAM and no suitable dedicated GPU, so sequential model evaluation is preferable during builds.

`evals/dspy_tune.py` uses DSPy bootstrap/random search with explicit disjoint development, validation and holdout files. It checks the runtime before optimization, scores through existing guardrails and exports a candidate, metrics and prompt artifact. The recorded Gemma 3 4B experiment did not improve its two-row holdout; no prompt was promoted. Those phrases were previously evaluated material, not independent evidence.

`VOICE_DSPY_PROMPT_FILE` is explicit opt-in. The artifact must match the base-prompt hash, improve measured accuracy and have zero wrong change commands; otherwise the existing prompt remains. Parser, quantity and confirmation checks always apply.

## Automation and operator investigations

The four exports under `automation/n8n/` cover weekly digest, daily freshness, operator alert routing and authenticated report intake. All four were exercised locally. Schedules start inactive; an operator controls activation. The authenticated intake webhook was published for its synthetic smoke test. No external email/Telegram destination was configured and no carrier message was sent.

Digest consent is separate from SMS consent. The existing delivery pipeline still enforces phone verification, quiet hours, STOP and provider state. Simulator mirroring keys on alert IDs. Jobs and imports use stable retry keys and payload checks; staging and its replay receipt commit together. Only an operator can approve a report. `app.report_intake` supplies the bounded folder watcher, receipts and retry handling, preserving original files. See the n8n README for setup.

The LangGraph assistant is a bounded investigation, not autonomous causal reasoning. Shared HTTP tools read freshness, the latest observation, a 14-day outlook and public help. Operational records stay local. It distinguishes observed prices from future scenarios, persists checkpoints in Alembic-owned tables, audits steps and pauses at a real `interrupt`. Approval saves the note only; business actions remain in the app. A new graph instance can resume a paused run.

`evals/agent_eval.py` checks twenty same-author synthetic scenarios using controlled read responses and real PostgreSQL checkpoints. It measures orchestration, unavailable evidence, interrupts, resume and absence of business writes—not model reasoning or field success.

## Remaining external work

- Owner merge/release and matching hosted API/web deployment; no push, PR or deployment was performed.
- Independent Bangla/Banglish evaluation, human answer review and field evidence.
- Carrier/provider delivery and STOP acceptance before live channels are enabled.
- Operator schedule activation and rotation of the expiring local demo credentials.
- Optional reranking or a separate BI dashboard only after a measured need and a suitable authorization design.
