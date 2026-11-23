# Retrieval & RAG

- ☑ Naive RAG (chunk + embed + retrieve)
- ☑ Vector Database (Pinecone, Weaviate, pgvector, etc.)
- ☑ Contextual RAG (Anthropic-style, +context per chunk)
- ☑ Hybrid Search (Keyword + Vector)
- ☑ Deterministic query rewriting (HyDE not implemented)

**RAG architecture details**

"Ask PeyajFlow" retrieves fifteen original bilingual first-party help guides with source URL, licence and date. External government/agronomy guides are not yet included. An operator CLI imports reviewed public PDF or Markdown manifests; PDF extraction requires selectable text and preserves page citations. No private account records are indexed.

Passages use a configurable cl100k_base BPE budget and an additional provider character bound. Optional strict contextual ingestion uses Ollama independently of answer generation, reuses unchanged context and refuses a partial commit on requested generation failure. Context is a retrieval hint; original passages supply citation evidence. PostgreSQL full-text and pgvector are combined with reciprocal-rank fusion after Banglish/trade-term expansion. This is deterministic expansion, not a generated HyDE document.

Extractive answers are the default. Optional model answering can select only verified quotations. Missing evidence abstains. Generated context coverage and retrieval results must be measured for the particular index; independent questions and human citation-support review remain pending. See [knowledge operations](docs/KNOWLEDGE_OPERATIONS.md) for ingestion, cache limits and cloud Ollama configuration.

# MCP (Model Context Protocol) Usage

- ☑ We built and/or used MCP servers / clients in this build

**Built: `peyajflow-mcp`**

- **Purpose:** read-only access to real PeyajFlow data for operators, field agents and analysts from any MCP client.
- **Transports:** stdio and Streamable HTTP.
- **Auth:** a per-user read-only API token. Each call has exactly that account's permissions, and write endpoints refuse these tokens.
- **Tools (9):** `get_market_prices`, `get_price_outlook`, `list_my_lots`, `get_lot_risk`, `get_hold_or_sell`, `list_offers`, `list_orders`, `market_data_health`, `ask_peyajflow`
- **Resources (2 static + 1 template):** `peyajflow://docs/ai-features`, `peyajflow://docs/glossary`, `peyajflow://series/{id}`
- **Prompts (2):** `weekly-market-brief`, `lot-review`
- **Reuse:** MCP and the LangGraph assistant share the scoped HTTP-read adapter; n8n calls the API directly. Neither requires the MCP server as its runtime transport.

# Workflow Automation

- ☑ n8n (self-hosted workflow automation)
- ☑ LangGraph

**Which workflows are automated?**

Four n8n templates are supplied for optional self-hosting: weekly price digests, data-freshness checks, dispute/payment alert routing, and CSV import staging. Jobs require scoped verified-operator credentials, audit receipts and idempotency keys. Import publication still requires operator approval. Schedules need deliberate activation; external email, Telegram and SMS delivery are not configured. Digests currently use in-app notifications.

LangGraph runs the bounded operator investigation and note-review graph with persistent checkpoints. It does not autonomously change business records. Independent API switches disable automation or graph mutations while leaving history and digest opt-out available.

# Local / On-device LLMs

**Runtimes**

- ☑ Ollama

**Local models you actually ran**

- ☑ Qwen 2 / 2.5
- ☑ Llama 3 / 3.1 / 3.2

**Hardware, quantization, why local vs cloud**

Ollama runs `qwen2.5:7b-instruct` and `llama3.1:8b-instruct` in 4-bit GGUF (`q4_K_M`), plus `bge-m3` for local embeddings. They can provide guarded optional voice fallback; bge-m3 supplies embeddings and Ollama supplies public-passage context. Inference runs on the API's connected server, not a farmer's device. This avoids paid cloud inference for those calls but still has compute costs and does not provide offline web access. A deployed API needs a reachable, secured Ollama endpoint. Hosting configuration has not been changed.

# Agentic Frameworks Used

- ☑ LangGraph: graph-based agent orchestration
- ☑ DSPy: prompt optimization experiment; candidate not promoted (held-out improvement gate failed)

# 5. Visualization (open source preferred)

- ☑ Recharts

**Visualization details**

Recharts charts in the Next.js app show:

- price history with the 7, 14 and 28-day forecast band;
- forecast backtest error by model;
- the storage-loss trend from verified weights;
- hold-or-sell scenario ranges;
- market data freshness;
- photo-model agreement.

Every chart has a data table and a text summary, bilingual labels, and colour is never the only signal.

**Dashboards & reports**

Operations pages cover data health, forecast diagnostics, disputes and audit.
