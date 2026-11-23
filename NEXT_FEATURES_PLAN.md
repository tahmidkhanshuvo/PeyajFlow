# PeyajFlow: plan for the remaining AI-detail sections

This plan covers the six form sections that are still empty:

- Retrieval & RAG
- MCP
- Workflow Automation
- Local / On-device LLMs
- Agentic Frameworks
- Visualization

**Status (November 23, 2026):** the six core areas are implemented locally on `codex/ai-platform-features`. Release verification is recorded in `WORK_STATUS.md`; setup, measured results and limits are in [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md). This has not been merged or deployed. Local command candidates and the DSPy prompt were not promoted. Independent/field validation, live carrier acceptance and optional reranking/BI remain separate work.

Implementation adjustments: MCP has nine tools, two static resources and one resource template. Automation write scopes are separate from read-only scopes. The initial knowledge corpus is first-party help, without unlicensed external agronomy guides. Local inference still requires the API connection. The operator graph is a bounded investigation with durable note review. The existing challenge set is not independent; the DSPy holdout uses disjoint but previously evaluated wording. Planned inventories and checkbox tables below describe targets, not hosted-release claims.

## Ground rules for every item

Judges can check claims against the code, and `AGENTS.md` sets rules that must stay true. Every feature below therefore follows these rules:

1. **It solves a real PeyajFlow problem.** No box is ticked for a token integration.
2. **It is read-only or human-confirmed.** No model, agent, workflow or MCP tool changes data directly. Anything that would change data goes through the existing staging and PIN or code confirmation, or an operator approval.
3. **It is measured.** Each item has an evaluation or test, with results saved in the repository. Report only what was measured, with the dataset, commit and date.
4. **Boxes are ticked only after shipping.** A box is ticked after the feature is merged, tested and recorded in `WORK_STATUS.md`.

## Summary and order

Points are as shown on the form. "Data" means it also raises the Data Lifecycle score.

| # | Section | Points available | What we build | Effort | Order |
| --- | --- | --- | --- | --- | --- |
| 1 | MCP | 20 | A read-only PeyajFlow MCP server, with stdio and HTTP transports | 3–4 days | 1st |
| 2 | Retrieval & RAG | 12 + 5 details | "Ask PeyajFlow": cited answers from curated onion guides and PeyajFlow help | 4–5 days | 2nd |
| 3 | Local LLMs | 8 | Ollama as a private, offline provider for the command fallback and RAG embeddings | 2 days | 3rd |
| 4 | Visualization | Data | Recharts price, forecast, loss and operations charts | 2–3 days | 4th |
| 5 | Workflow Automation | 4 + 2 bonus | n8n workflows for scheduled price SMS, data freshness and alert routing | 2–3 days | 5th |
| 6 | Agentic Frameworks | Pre-judgment | A LangGraph operator assistant with human approval; DSPy to tune the fallback prompt | 3–4 days | 6th |

This order puts the most points per day first. It also builds shared pieces first: the MCP server's read tools are reused by the agent, and the RAG embeddings are reused by Ollama.

---

## 1. MCP (Model Context Protocol): up to 20 points

### What and why

PeyajFlow will provide a **PeyajFlow MCP server**, so operators, field agents and analysts can query real PeyajFlow data from any MCP client. Examples of clients are Claude Desktop, Claude Code and an IDE. Example questions:

- "Which market series are stale?"
- "Summarise Rahim's lots and open offers."
- "What does the 14-day outlook say for Pabna farmgate?"

### Design

- **Package:** `services/mcp/`, a separate small package using the official MCP Python SDK. It calls the existing FastAPI API over HTTP. It never touches the database or Python modules directly, so the API stays the single security boundary (rule 1).
- **Transports:**
  - stdio, for desktop clients;
  - Streamable HTTP, for remote use, behind authentication.
- **Authentication:** each user signs in with their PeyajFlow session token or a new **scoped read-only API token**. Every tool call then has exactly the permissions of that account: role checks, `is_demo` isolation, and 404 for other accounts' data.
- **Tools, all read-only:**

| Tool | Wraps | Who |
| --- | --- | --- |
| `get_market_prices` | `GET /v1/market/prices` | all |
| `get_price_outlook` | forecast endpoint | all |
| `list_my_lots` | `GET /v1/lots` | farmer, agent |
| `get_lot_risk` | storage risk endpoint | farmer, agent |
| `get_hold_or_sell` | advice endpoint | farmer |
| `list_offers` | `GET /v1/offers` | farmer, buyer |
| `list_orders` | `GET /v1/orders` | farmer, buyer |
| `market_data_health` | operations freshness | admin |
| `ask_peyajflow` | the RAG answer endpoint (section 2) | all |

- **Resources:** `peyajflow://docs/ai-features`, `peyajflow://docs/glossary` (Bangla trade terms), and `peyajflow://series/{id}`.
- **Prompts:** `weekly-market-brief` and `lot-review`.
- **No write tools.** Any change stays in the app, behind PIN or code confirmation.

### API work

- **Read-only tokens.** A new scoped token type: a `api_tokens` table with migration `NNNN_mcptoken`, created and revoked on the profile page. It is hashed like sessions, has an expiry, and is refused by every write endpoint.
- **Rate limits** per token.

### Tests and evidence

- **pytest:** each tool returns only data the token's account can see, and a token from another account gets 404s.
- **Write refusal:** a read-only token is refused by write endpoints.
- **MCP Inspector:** a recorded session listing tools, resources and prompts, saved as a screenshot in `docs/`.
- **Inventory table for the form:** server name, number of tools, resources and prompts, transports, and authentication.

### Form inventory

- **Built:** `peyajflow-mcp`, with 9 tools, 3 resources, 2 prompts, stdio and Streamable HTTP, and read-only token authentication.
- **Used:** list only MCP servers the team really uses during development, such as Playwright MCP for exploratory UI tests or the GitHub MCP. Don't list any that weren't used.

---

## 2. Retrieval & RAG: up to 12 points, plus 5 for details

### What and why

**"Ask PeyajFlow" (প্রশ্ন করুন)** answers farmers' and buyers' how-to and agronomy questions in Bangla, with citations. Example questions:

- "পেঁয়াজ কতদিন ঘরে রাখা যায়?" (How long can onions be kept in storage?)
- "মণে কত কেজি?" (How many kilograms are in a maund?)
- "অফার কিভাবে গ্রহণ করব?" (How do I accept an offer?)
- "Why is my forecast missing?"

It appears in three places:

- the Help page;
- the call simulator, as a read command ("প্রশ্ন: …");
- SMS ("প্রশ্ন …").

### Sources: curated, licensed, dated

- **PeyajFlow's own material:** README sections, FAQ, AI features, how-to pages and error explanations (from `workspace-copy.ts`).
- **Public extension material** whose licence allows reuse, each with a source URL and date. Examples: storage and curing guides from government agricultural bodies (DAE and BARI publications), and DAM market notes. Check the licence for each document before including it.
- **No private farmer data in the index.** Account data is answered by the existing scoped tools, not by RAG.

### Pipeline (`services/api/app/knowledge.py` plus an ingest script)

| Step | Technique | Form box |
| --- | --- | --- |
| Split Markdown or PDF text into passages by heading, with a token limit | chunk + embed + retrieve | ☑ Naive RAG |
| Store embeddings in PostgreSQL with the `pgvector` extension (Supabase supports it) | vector index | ☑ Vector Database |
| Prefix each chunk with a short, model-written context line describing its document and section, at ingest | context per chunk | ☑ Contextual RAG |
| Combine PostgreSQL full-text search with vector search using reciprocal-rank fusion | keyword + vector | ☑ Hybrid Search |
| Normalise Banglish to Bangla and expand trade terms (মণ, maund) before retrieval | query rewriting | ☑ Query Rewriting |
| Re-score the top 20 results with a reranker (Cohere Rerank or BGE reranker) | reranking | ☑ Rerankers (optional, a 5th technique) |

Four techniques reach the 12-point maximum. The reranker is a stretch goal, worth adding only if it improves the measured results.

- **Embeddings:** Gemini `gemini-embedding` (multilingual, handles Bangla) in the cloud, or `bge-m3` or `nomic-embed-text` through Ollama locally (section 3). Store the embedding model name with each vector.
- **Answering:** Muse Spark or Gemini, given only the retrieved passages. The model must cite passage IDs and must answer "জানা নেই" (not known) when retrieval confidence is below a threshold.
- **Schema:** a `knowledge_documents` table (source URL, licence, date, language) and a `knowledge_chunks` table (text, context line, `vector`, `tsvector`), in migration `NNNN_knowledge`.

### Safety

- The feature is read-only. An answer can never stage an action or change data.
- Every answer shows its sources and date, and abstains when the evidence is weak.
- Answers carry a "general information, not advice for your lot" notice, so they never override PeyajFlow's own advice or prices.

### Evaluation (`evals/rag_eval.py`)

- **Questions:** about 60 in Bangla, Banglish and English, each linked to the passage that answers it. A separate challenge set must be written by someone who did not build the system (rule 6).
- **Measures:** retrieval recall@5 and MRR; whether the answer is supported by the cited passages, checked by a human on a sample or by a judge model whose agreement with humans is reported; and the abstention rate on questions with no answer.
- **Comparisons:** keyword only, vector only, hybrid, and hybrid with reranking.
- **CI gate:** recall@5 must not drop.

### Details text for the form (fill in after measuring)

> pgvector in PostgreSQL 16; contextual chunking by heading with a token limit and a context line per chunk; embeddings from <model>; hybrid search combining PostgreSQL full-text and vector results with reciprocal-rank fusion; Bangla and Banglish query rewriting; <reranker>. Recall@5 = <measured> on <n> questions (commit, date).

---

## 3. Local / On-device LLMs: up to 8 points

### What and why

**Ollama** becomes a private, offline provider:

- **Command fallback:** `VOICE_MODEL_PROVIDER=ollama` keeps farmers' phrases on PeyajFlow's own machine.
- **RAG embeddings:** generated locally, so indexing costs nothing.

This matters for privacy and for low-connectivity field offices.

### Plan

- **Runtime:** Ollama, which earns 1 point plus the 2-point Ollama bonus.
- **Models, 2 points each:**
  - **Qwen 2.5 7B Instruct:** strong multilingual output and reliable JSON.
  - **Llama 3.1 8B Instruct**, as a comparison.
  - Optionally **Gemma 2 9B**.

  Two models already reach the 8-point maximum; a third gives a better comparison.
- **Code:** add an `ask_ollama` provider to `app/intent_model.py`, calling the local `/api/chat` endpoint with JSON output format. All existing guardrails apply unchanged.
- **Embeddings:** `bge-m3` or `nomic-embed-text` through Ollama's embeddings endpoint, for section 2.
- **Measure:** run `evals.intent_eval --fallback` on all three datasets for each local model. Compare with Muse Spark and Gemini, and report accuracy, wrong change commands and latency.
- **Hosting:** Render Free cannot run Ollama, so local models are for development, on-premise or field-office laptops. The form must say this.

### Form details text (fill in after measuring)

> Ollama on <CPU/GPU model, RAM>; models qwen2.5:7b-instruct-q4_K_M and llama3.1:8b-instruct-q4_K_M (GGUF, 4-bit). Used for private, offline command understanding and local embeddings. Accuracy <measured> vs Muse Spark <measured> on the 20 unmatched phrasings (commit, date).

---

## 4. Visualization: Data Lifecycle score

### What and why

The web app shows forecasts and errors as text and tables today. Charts make trends readable for farmers and operators.

### Plan

- **Library:** **Recharts**, open source, built for React and works with Next.js. Charts render on the client, inside a small client component.

| Chart | Page | Shows |
| --- | --- | --- |
| Price history with forecast band | Market prices | the 7, 14 and 28-day range |
| Backtest error by model | Operations → forecast diagnostics | MAE and coverage per baseline and candidate |
| Storage-loss trend | Lot → hold or sell | verified weights and the fitted trend |
| Hold or sell scenarios | Advice | proceeds now versus later, with the range |
| Data freshness | Operations | days since each series was last published |
| Photo model agreement | Operations → photo model | the agreement matrix, once 20 or more reviewed pairs exist |

- **Accessibility:** every chart has a data table and a text summary next to it. Colour is never the only signal, and labels are bilingual. Keep axe at 0 violations.
- **Optional operator dashboard:** **Grafana** or **Metabase**, read-only, connected to a read-only PostgreSQL role, for operator KPIs (orders, disputes, freshness). It runs as a Docker Compose profile.
- **Tests:** a unit test that each chart's data mapping matches the API response, and an axe check of each page that has a chart.

---

## 5. Workflow Automation: up to 4 points, plus the 2-point n8n bonus

### What and why

Recurring operator jobs are manual today. **n8n**, self-hosted and run as a Docker Compose profile, automates them.

### Workflows (exported as JSON to `automation/n8n/`)

1. **Weekly price SMS.** A schedule triggers the price-alert endpoint for consenting accounts. This uses the simulator in demo mode and real SMS only once Twilio passes its checks.
2. **Data freshness monitor.** A daily check of market-series freshness notifies operators by email or Telegram when a series is stale.
3. **Alert routing.** A new dispute or a rejected payment report notifies the operator on duty.
4. **Import intake.** A new DAM report file dropped in a watched folder or inbox is **staged** as an import. An operator must still approve it in PeyajFlow; n8n never approves.

### Safety

- **Service account.** n8n signs in with its own **service account** and a scoped token (from section 1), allowed only the endpoints listed above.
- **Data changes.** n8n cannot approve imports, accept offers or move stock.
- **Secrets.** All secrets live in n8n credentials, never in the exported workflow JSON.

### Other boxes

- **LangGraph** (section 6) also counts as orchestration here.
- Airflow, Temporal and the rest would duplicate n8n, so don't add them for points.

### Tests

- A smoke test runs each workflow once against the disposable stack.
- A pytest test checks that the n8n token is refused by every other endpoint.

---

## 6. Agentic Frameworks: pre-judgment score

### A. LangGraph operator assistant (main item)

- **Purpose:** an operator asks, for example, "Why did Pabna farmgate prices jump this week, and what should I check?" The agent works through it step by step:
  1. Check data freshness and recent imports.
  2. Compare against the forecast range.
  3. Search the knowledge base (section 2).
  4. Draft a note for the operator.
- **Tools:** only the read-only MCP tools from section 1.
- **Human approval:** any suggested follow-up, such as "reject import #42", is shown to the operator as a draft with an **approval interrupt** (LangGraph's `interrupt`). The operator performs it in the app. The agent cannot execute it.
- **State and logging:** each run is checkpointed in PostgreSQL. Every step is logged to the audit log.
- **Evaluation:** a set of about 20 scripted operator scenarios with expected tool sequences and facts. Measure task success, tool-call accuracy, and that the agent attempts zero write actions.

### B. DSPy prompt tuning for the command fallback (small, measurable)

- Use **DSPy** to optimise the fallback prompt in `app/intent_model.py` on the **development split only**.
- Measure on the held-out split and the challenge set. Adopt the new prompt only if it improves accuracy with zero wrong change commands.
- Save the before and after results with `--label`.

### Boxes to tick after shipping

- ☑ LangGraph
- ☑ DSPy

Don't add CrewAI, AutoGen or similar without a real use; a second framework doing the same job adds risk and no value.

---

## Shared groundwork, before any of the above

1. **Scoped API tokens:** read-only, plus a service account for n8n. MCP, n8n and the agent all need them.
2. **A provider layer in `intent_model.py`:** one `ask(provider, messages, json=True)` function shared by Meta, Gemini and Ollama, and reused by RAG answering and the agent.
3. **Cost and privacy settings:** a per-feature on/off switch, per-account limits, and a "phrase or question only, no account data" rule applied to every external model call.
4. **Documentation:** update `docs/AI_FEATURES.md`, `WORK_STATUS.md` and `HACKATHON_SUBMISSION.md` as each item ships, with measured figures only.

## Risks

| Risk | Mitigation |
| --- | --- |
| Ticking boxes before the feature works | Tick only after merge, tests and a `WORK_STATUS.md` entry |
| Low-quality or unlicensed RAG sources | Use a curated list with licence, URL and date stored per document; leave out anything unclear |
| An agent or tool changing data | Read-only tokens, no write tools, and human approval interrupts |
| Model costs | Per-account limits, the local Ollama option, and caching of answers to repeated questions |
| The free hosting tier is too small (pgvector, Ollama) | pgvector runs in Supabase; Ollama runs locally only, as stated on the form |
| Bangla quality | Evaluation sets reviewed by native speakers, plus a separately written challenge set for each feature |

## Expected form result once all six are shipped and measured

| Section | Boxes to tick |
| --- | --- |
| Retrieval & RAG | Naive RAG, Vector Database, Contextual RAG, Hybrid Search, Query Rewriting, and Rerankers if added, plus the details text |
| MCP | "We built and/or used MCP servers", with the inventory above |
| Workflow Automation | n8n, LangGraph |
| Local LLMs | Ollama; Qwen 2 / 2.5 and Llama 3 / 3.1 / 3.2, optionally Gemma 2; plus the hardware text |
| Agentic Frameworks | LangGraph, DSPy |
| Visualization | Recharts, optionally Grafana or Metabase |
