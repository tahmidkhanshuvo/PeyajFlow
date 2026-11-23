# Retrieval & RAG

- ☑ Naive RAG (chunk + embed + retrieve)
- ☑ Vector Database (Pinecone, Weaviate, pgvector, etc.)
- ☑ Contextual RAG (Anthropic-style, +context per chunk)
- ☑ Hybrid Search (Keyword + Vector)
- ☑ Query Rewriting / HyDE

**RAG architecture details**

"Ask PeyajFlow" answers Bangla, Banglish and English questions about onion storage, units, trading and how to use PeyajFlow, with citations. It indexes curated, licence-checked sources: PeyajFlow help and FAQ, government storage and curing guides, and DAM market notes. Each source is stored with its URL, licence and date, and no private farmer data is indexed. Documents are split by heading with a token limit, and each chunk gets a model-written context line. Embeddings are stored in pgvector inside PostgreSQL 16. Retrieval combines PostgreSQL full-text and vector search with reciprocal-rank fusion, after Banglish-to-Bangla normalisation and expansion of trade terms (মণ ↔ maund). The model answers only from the retrieved passages, cites them, and says "জানা নেই" (not known) below a confidence threshold. It is read-only and never stages an action.

# MCP (Model Context Protocol) Usage

- ☑ We built and/or used MCP servers / clients in this build

**Built: `peyajflow-mcp`**

- **Purpose:** read-only access to real PeyajFlow data for operators, field agents and analysts from any MCP client.
- **Transports:** stdio and Streamable HTTP.
- **Auth:** a per-user read-only API token. Each call has exactly that account's permissions, and write endpoints refuse these tokens.
- **Tools (9):** `get_market_prices`, `get_price_outlook`, `list_my_lots`, `get_lot_risk`, `get_hold_or_sell`, `list_offers`, `list_orders`, `market_data_health`, `ask_peyajflow`
- **Resources (3):** `peyajflow://docs/ai-features`, `peyajflow://docs/glossary`, `peyajflow://series/{id}`
- **Prompts (2):** `weekly-market-brief`, `lot-review`
- **Reuse:** the LangGraph operator assistant and the n8n workflows use the same server.

# Workflow Automation

- ☑ n8n (self-hosted workflow automation)
- ☑ LangGraph

**Which workflows are automated?**

Self-hosted n8n runs as a Docker Compose profile, signed in with a scoped service-account token. It automates four workflows:

1. A weekly price SMS to consenting accounts.
2. A daily data-freshness check that alerts operators when a market series goes stale.
3. Alert routing for new disputes and rejected payment reports.
4. Import intake: new DAM report files are staged as imports, and an operator approves each one in PeyajFlow.

LangGraph orchestrates the operator assistant.

# Local / On-device LLMs

**Runtimes**

- ☑ Ollama

**Local models you actually ran**

- ☑ Qwen 2 / 2.5
- ☑ Llama 3 / 3.1 / 3.2

**Hardware, quantization, why local vs cloud**

Ollama runs `qwen2.5:7b-instruct` and `llama3.1:8b-instruct` in 4-bit GGUF (`q4_K_M`), plus `bge-m3` for local embeddings. They serve as a selectable provider for the voice-command fallback, with the same guardrails, and generate the RAG embeddings. We run them locally for privacy, because farmers' phrases stay on our own machine, for zero cost per call, and for offline use in field offices.

# Agentic Frameworks Used

- ☑ LangGraph: graph-based agent orchestration
- ☑ DSPy: programmatic prompt optimization

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
