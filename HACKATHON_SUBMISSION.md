# PeyajFlow: International AI Builders Congress submission answers

These are answers for the submission form's "AI Detail Usage", "Data Lifecycle" and "Build Provenance" pages. They were taken from the repository at commit `efe84a2` on November 20, 2026.

- **Who can submit:** only the team leader can edit and submit.
- **Unticked boxes:** boxes marked ☐ are for things PeyajFlow does not use. Leave them unticked.
- **[Confirm]:** items marked **[Confirm]** need a team member to check before ticking or submitting.
- **Figures:** every figure below was measured by a script in the repository, with the dataset and date stated.

---

## Page 1: AI Detail Usage

### Prompt Usage

PeyajFlow uses three prompts. Each is versioned in code and has a strict output contract.

1. **Photo condition (CLIP, in the browser).** Five onion-specific zero-shot labels:
   - "an onion bulb with visible rot or mold"
   - "…with green shoots sprouting"
   - "…with cuts or bruises"
   - "an intact onion bulb with dry clean skin"
   - "a scene without a clear view of an onion bulb"

   They use the template "A close-up photograph showing {}." Prompts and threshold are versioned as rule `clip-margin-v1`, with the model pinned to revision `6b7c523`. The API rejects scores from any other model or rule.
2. **Voice command fallback (Meta Muse Spark or Gemini).** A role prompt describes the 14 allowed commands and requires one JSON object: `{"command", "quantity", "unit", "loss"}`. It instructs the model to answer `none` for anything negated, uncertain, about another crop, or outside the list, and never to guess a quantity.
3. **Speech transcription (Gemini).** "Transcribe exactly as spoken; Bangla in Bangla script; keep numbers as spoken; output only the transcript."

The prompts are not trusted on their own. Code enforces each contract:

- The reply is parsed as strict JSON, and the command must be on an allowlist.
- A quantity is accepted only if the deterministic grammar read the same amount from the user's own words.
- Prompt and rule changes are reviewed in pull requests, with the coding-agent rules in `AGENTS.md`.

### Token Optimization

- **Rules first.** A deterministic Bangla, Banglish and English grammar handles every command it can at no token cost. On our evaluation sets it resolves all 337 rows in the main and challenge sets without a model call. The language model is called only when the grammar matched nothing, and never for phrases the grammar refused.
- **Small, bounded calls.** Only the phrase is sent, with no history or account data. Settings: `reasoning_effort: "low"` for Muse Spark, output caps of 300–600 tokens, and `temperature: 0`. Gemini uses JSON output mode, and transcription uses `gemini-3.5-flash-lite` or `gemini-3.5-transcribe`.
- **Limits.** Model calls are capped at 30 per account per 10 minutes, and transcription at 20. An 8-second timeout falls back to the grammar's answer.
- **On-device vision.** CLIP runs in the user's browser with 8-bit quantized weights, so there is no server inference cost.

### Token Optimization Tools & Methods

- ☑ Structured outputs / JSON mode
- ☐ Everything else.

### LLMs / Models Used

- ☑ **Claude**: Claude Code (Claude Opus) was a coding agent for development; commits are co-authored. The judges' demo UI was designed in Claude Design.
- ☑ **Gemini**: `gemini-3.5-flash-lite` (optional command fallback) and `gemini-3.5-transcribe` (Bangla speech-to-text fallback).
- ☐ **ChatGPT** **[Confirm]**: tick only if the team used Codex or ChatGPT. The planning file is named `PeyajFlow_Codex_Master_Handoff.md`.
- **Other models:**
  - Meta Muse Spark `muse-spark-1.3`, the default command fallback, through the Meta Model API;
  - OpenAI CLIP ViT-B/32 (Xenova ONNX port), in the browser.

### How & why did you use these LLMs?

- **Meta Muse Spark** helps with voice and SMS commands the deterministic grammar does not understand, such as "ওরা যা দিতে চাইল ওটাই রেখে দেন" ("keep what they offered"). We measured three setups on the same phrases, and Muse Spark scored best (results below), so it is the default.
- **Gemini** does what it is best at here: audio. `gemini-3.5-transcribe` turns Bangla speech into text for browsers that have no speech recognition, after the user consents.
- **CLIP** suggests visible photo conditions (rot, sprouting, damage) for human reviewers.
- **Claude** built and tested the software as a coding agent.

No model can change data. Every change still needs a spoken read-back and the user's PIN or keypad code.

### Retrieval & RAG

☐ None.

> No RAG. The product answers from its own PostgreSQL records through authorized, role-scoped queries.

### MCP (Model Context Protocol) Usage

☐ Leave unticked. No MCP servers were built or used for this project.

### Open Source Tools & Libraries

- **transformers.js 3.8.1 and ONNX Runtime Web:** CLIP inference in the browser. The runtime is self-hosted and SHA-384 checked at build time.
- **FastAPI, Pydantic v2, SQLAlchemy 2 Core and Alembic:** API, validation and migrations.
- **PostgreSQL 16:** the database.
- **Next.js 16, React 19 and Tailwind 4:** the bilingual web app and the phone simulator.
- **Pillow:** strips photo metadata and re-encodes photos.
- **boto3:** private S3-compatible photo storage.
- **Playwright and axe-core:** end-to-end and accessibility tests.
- **pytest, Ruff, uv and pnpm:** testing, linting and builds.

### Agent Frameworks & Orchestration

None in the product. Development used coding agents (Claude Code) guided by an `AGENTS.md` specification, with features on branches behind CI gates.

### Fine-tuning / Adaptation

None. All models are used zero-shot or through prompts. No labelled field data exists yet, so we did not train on unvalidated data.

### Evaluation & Quality Measurement

**Voice commands.** A reproducible script, `services/api/evals/intent_eval.py`, reports intent accuracy, macro F1, quantity accuracy, false actions and wrong change commands. Results are saved per run. These are the figures measured on November 20, 2026:

| Dataset | Grammar only | With Muse Spark fallback | With Gemini fallback | Both must agree |
| --- | --- | --- | --- | --- |
| Main, 279 rows | 1.000 | 1.000 | 1.000 | 1.000 |
| Challenge, 58 rows | 1.000 | 1.000 | 1.000 | 1.000 |
| Phrasings the grammar misses, 20 rows | — | **0.900** | 0.650 | 0.800 |
| Wrong change commands, all runs | 0 | 0 | 0 | 0 |

How to read these figures:

- **The main set is an upper bound.** It was written by the same author as the grammar.
- **The challenge set's honest estimate is 0.603.** That was its first run on unfamiliar wording; it has since been tuned against.
- **The 20-row fallback set is author-written.** It shows that the fallback helps, not field accuracy.
- **CI gates:** the build fails on any wrong change command, or on accuracy below 0.95 (main set) or 0.90 (challenge set).

**Photo model.** Agreement with human review is shown only after at least 20 real reviewed pairs. A harness (`apps/web/scripts/photo-eval.mjs`) reports per-class precision and recall, abstention, and problems called clear, once labelled photos exist. No accuracy is claimed yet.

**Forecasts.** Backtests use only data published by each replay date, and report MAE, WAPE, interval coverage and pinball loss. A candidate model is promoted over the baselines only if, over at least 24 replays, it has more than 10% lower MAE and 70–95% coverage.

**Software and attack testing:**

- 187 API tests on PostgreSQL 16, 9 web unit tests, and 5 Playwright workflows.
- 17 of 17 browser checks of the phone simulator, plus the release smoke test.
- An adversarial sweep of all 90 API operations at that time: about 2,000 hostile requests, with zero server errors and zero cross-account access.
- 15 simultaneous acceptances of one offer: exactly one succeeded.
- 30,000 resolver property checks, which found one gap (mixed crops). It is fixed.

### Guardrails, Safety & Privacy

- **Data changes.** No model or parser can change data. A resolved command only stages an action, then a Bangla read-back and confirmation follow.
- **Confirmation.** Real accounts confirm with a personal voice PIN: scrypt-hashed, never displayed, trivial PINs refused, locked for 15 minutes after 5 wrong entries. Demo accounts use a displayed one-time code.
- **Model guardrails.**
  - The model is never asked about a refused phrase and never sees a phrase containing a negation or "whether".
  - It may only pick from an allowlist and cannot introduce a quantity.
  - A negation never becomes the opposite command.
  - Two quantities, or a change naming another crop, are refused.
- **Sign-in.**
  - SMS one-time codes go only to operator-verified phones. They are single-use, rate-limited and give the same reply for unknown numbers.
  - Passphrases are scrypt-hashed, with brute-force limits.
  - Signup checks the NID format.
- **Privacy.**
  - Photos are re-encoded without metadata and private.
  - Speech is sent to Gemini only after explicit consent and is never stored. Only the phrase is sent to a model.
  - Keys are kept in environment files that are never committed.
- **Web security.** The browser model runtime is self-hosted and hash-checked under a strict worker CSP. Framing is same-origin only.
- **Honesty.** Synthetic data is labelled, the phone simulator is labelled a simulation, and PeyajFlow never moves money.

### Frontend AI / Visual App Builders

- ☐ **Claude Artifacts** **[Confirm]**: the judges' demo UI was designed in **Claude Design** (claude.ai/design) and handed off as a design pack. Tick this box only if the form accepts Claude Design under it; otherwise mention it in the text.
- ☐ Others: tick only if the team used Cursor, v0 or similar **[Confirm]**.

**How did you use these tools?**

> The judges' phone demo was designed with Claude Design: 14 screens, a basic-phone and smartphone flow chooser, and the Broadsheet design system. The production phone simulator recreates that feature-phone design in React and connects it to the real backend. The rest of the web app was written by a coding agent (Claude Code) and reviewed by the team.

### Workflow Automation

☐ None.

### Local / On-device LLMs

☐ None. The on-device model is CLIP, a vision model, not an LLM.

### Agentic Frameworks Used

☐ None.

### AI Development Lifecycle (AI-DLC)

- ☑ **AGENTS.md spec**

**Process notes:**

1. **Planning.** A master planning pack was split into milestones F00–F17, each built on a branch.
2. **Shared rules.** `AGENTS.md` gives every coding agent the repository map, commands and AI rules. Rule changes, such as allowing the model fallback, are approved by the owner and recorded there.
3. **Status log.** After each feature, `WORK_STATUS.md` records what changed, the checks run and their results, and what remains open.
4. **Evidence in commits.** Commit messages state the evidence for each change.
5. **CI gates.** CI runs the web build and Playwright, the API tests and evaluation gates, and a backup and restore drill.

### Build a Live /docs Module

☐ Tick only if the team will ship it. The API already publishes OpenAPI docs at `/docs`.

### Anything else about your AI usage?

- **Rules first, models second.** In a farmer-facing trade tool, a hallucinated quantity reserves real onions. The deterministic grammar decides first, and it reads Bangla number words such as দুইশো কেজি (200 kg), দেড় মণ (1.5 maund) and সাড়ে তিন মণ (3.5 maund). Models only help when it is stuck, and every change still needs the user's PIN.
- **A phone simulator instead of real phones.** The basic phone handles Bangla SMS (reply ১ to accept), a USSD menu (`*7392#`) and calls (`7392`) with spoken prompts and captions, on the same real data and confirmations as the web app. No carrier is used.

---

## Page 2: Data Lifecycle & Engineering

### 1. Data Sources

- ☑ Internal (own DB / app data)
- ☑ External APIs (paid/free): Meta Model API and Gemini API
- ☑ User Uploads / Bulk Import
- ☑ Synthetic / AI-generated Data
- ☐ Open Datasets: tick only if real DAM price data was imported **[Confirm]**

**Sources:**

- Lots, inspections, verified weights, offers, orders and simulated SMS threads, entered by farmers, buyers and field agents.
- Market prices from curated CSV imports modelled on Bangladesh Department of Agricultural Marketing reports, with source URL and publication date.
- A labelled synthetic demo price series.
- Inspection photos.
- Voice: the browser's speech recognition, or Gemini transcription after consent.

### 2. Acquisition Methods

- ☑ Bulk Upload: CSV
- ☑ Speech-to-Text: browser recognition, with `gemini-3.5-transcribe` as the fallback

**Bulk upload, flows and extraction:**

- **CSV staging:** operators stage up to 1,000 rows and 400 KB. Rows are validated and deduplicated, then approved before use.
- **Alerts:** real in-app alerts are mirrored once each into the simulated phone's SMS inbox.
- **Webhooks:** signed telephony and SMS webhooks exist but stay disabled until carrier and consent checks pass.

### 3. Parsing, Formats & Cleaning

Formats: ☑ CSV ☑ JSON ☑ JSONL ☑ Markdown ☑ Images ☑ Audio (transient, never stored)

- **Parsers:**
  - Python `csv` for imports;
  - Pillow for JPEG, PNG and WebP;
  - strict JSON parsing with an allowlist for model replies;
  - a deterministic grammar for Bangla, Banglish and English commands, including Bangla number words.
- **Data cleaning & enrichment:**
  - deduplication;
  - maund-to-kg conversion using the stated conversion;
  - stale and synthetic labels;
  - Unicode normalization and Bangla digit conversion.
- **Schema validation:**
  - Pydantic v2 (extra fields forbidden);
  - PostgreSQL check constraints;
  - an Alembic metadata check in CI.

### 4. Storage Targets

- ☑ Relational (PostgreSQL 16 on Supabase)
- ☑ Object Storage (private S3-compatible bucket)

The schema has 36 tables using SQLAlchemy Core, with 21 Alembic revisions and a single head enforced at startup. Constraints include an immutable stock ledger, balance checks, partial unique indexes for idempotency, and check constraints on PIN failures, OTP attempts and SMS direction.

### 5. Visualization

☐ None. No chart library is used.

Server-rendered ranges, tables and the phone simulator, all bilingual and checked with axe.

### 6. Insights: AI, ML & Non-AI

- ☑ Deep Learning: CLIP inference, in the browser
- ☑ LLM Inference: command-fallback classification
- ☑ Forecasting: custom Python
- ☑ Rule Engine / Heuristics
- ☑ Statistical Analysis

**AI / ML details:**

- **CLIP photo suggestions.** They abstain unless the top score is at least 0.58 and leads the next by at least 0.16.
- **LLM command fallback.** Muse Spark by default; results are in the table on Page 1.
- **Price outlook.** Baselines plus a nearest-neighbour model, with 7, 14 and 28-day ranges taken from replay errors.
- **Storage-loss trend.** A log-linear fit to verified weights. It abstains on sparse or stale evidence.

**Non-AI analytics:**

- the voice grammar;
- the storage-risk checklist;
- hold-or-sell scenarios (SELL / HOLD / SELL_PART / INSUFFICIENT_DATA);
- landed-cost ranking.

**How insights are delivered:**

- in-app pages and the alerts inbox;
- the Bangla read-back in the call simulator;
- simulated SMS, including the weekly price SMS built from the real outlook.

### 7. Pipelines & Orchestration

- **Orchestration:** none external.
- **Scheduling / triggers:** in-process background loops for order expiry (every 20 seconds), SMS delivery (every 15 seconds, when enabled) and rate-limit pruning (every 10 minutes).

### 8. Outbound: APIs & Distribution

- **Outbound APIs:** 97 versioned REST endpoints (FastAPI) plus health checks, with OpenAPI docs. They include the phone-simulator endpoints for SMS, USSD, calls and transcription. Authentication uses hashed, expiring sessions, with role checks and per-device and per-account rate limits.
- **Webhooks & exports:** none outbound. Signed inbound Twilio callbacks exist but are disabled.
- **Embeddings / model serving:** none. Models are called through provider APIs or run in the browser.

### 9. Open Source Stack

- **PostgreSQL 16:** system of record.
- **FastAPI, Pydantic and SQLAlchemy:** API, validation and data access.
- **Alembic:** schema migrations.
- **Pillow:** image sanitizing.
- **transformers.js and ONNX Runtime Web:** browser vision.
- **Next.js and React:** UI and phone simulator.
- **Playwright and axe-core:** end-to-end and accessibility tests.
- **pytest and Ruff:** API tests and linting.
- **Docker Compose:** local stack and the backup and restore drill.

### 10. Quality, Governance & Observability

- **Data quality:**
  - original publication dates preserved;
  - freshness checks make forecasts abstain;
  - synthetic data labelled;
  - CI fails on evaluation regressions.
- **Privacy & compliance:**
  - photos stripped of EXIF and served with `private, no-store`;
  - speech sent only after consent and never stored;
  - only the phrase sent to models;
  - payment references kept out of the audit search;
  - PeyajFlow never moves money;
  - SMS needs consent and supports STOP.
- **Lineage & observability:**
  - sanitized request logging;
  - an audit log, including model-assisted commands and transcriptions;
  - health checks;
  - a backup and restore drill in CI.
- **Cost & performance:**
  - free hosting tiers;
  - browser-side vision;
  - rules first, with the model called only on a miss;
  - per-account model limits.

### Anything else about your data stack?

The design is evidence-first:

- Self-reported and verified quantities are stored separately.
- Every market observation keeps its source and publication date.
- Every model output can abstain.
- The phone simulator writes to the same tables and transactions as the web app.

### Publish local environment to internet

☐ Leave unticked unless ngrok or a similar tool was used **[Confirm]**.

---

## Page 3: Build Provenance

### Data & AI Provenance

**Data sources:**

- user-entered lots, inspections, weights, offers and orders;
- inspection photos;
- curated DAM-style price CSVs;
- a labelled synthetic demo series;
- voice input through browser recognition or Gemini transcription, after consent.

**AI models:**

- Meta Muse Spark `muse-spark-1.3`: optional command fallback, the default provider;
- Google Gemini `gemini-3.5-flash-lite` (command fallback option) and `gemini-3.5-transcribe` (speech-to-text fallback);
- CLIP ViT-B/32 (`Xenova/clip-vit-base-patch32`, revision `6b7c523`), in the browser;
- Claude Code, a development coding agent;
- Claude Design, the demo UI design.

**Responsible AI:**

- Rules decide first, models only suggest, and people confirm every change with a PIN or code.
- Uncertain input abstains with a specific reason.
- Synthetic and simulated data is labelled.
- We report measured figures only, with caveats. For example, the photo model has no accuracy figure yet, and author-written datasets are disclosed as upper bounds.
- Field validation with farmers and native-speaker review of the Bangla are still open.

### Tooling & IDE

- **IDE / Editor:** VS Code **[Confirm]** for the other team members.
- **Deployment method:** Vercel (web), Render Docker in Singapore (API), Supabase (PostgreSQL and private storage), and Docker Compose locally.
- **Frameworks & libraries:** Next.js 16, React 19, Tailwind 4, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, transformers.js and ONNX Runtime Web, Pillow, Playwright.
- **Context / memory files:** `AGENTS.md`, `WORK_STATUS.md`, `PeyajFlow_Codex_Master_Handoff.md`, `docs/AI_FEATURES.md`, and the Claude Design handoff (`DESIGN_HANDOFF.md`).

### MCP Usage

Leave blank. None used.

### Prompt Library

Entries you can add:

1. **CLIP condition prompts (`clip-margin-v1`):** the five labels under Prompt Usage, with "A close-up photograph showing {}."
2. **Voice command fallback (`app/intent_model.py`, `SYSTEM`):** classify one request into one of 14 commands or none. The answer must be JSON `{command, quantity, unit, loss}`, and the model must refuse anything negated, uncertain, about another crop or outside the list, and never guess a quantity.
3. **Bangla transcription (`app/phone_sim.py`):** transcribe exactly as spoken, with Bangla in Bangla script and numbers kept as spoken. Output only the transcript.
4. **Coding-agent rules:** the "AI and decision rules" section of `AGENTS.md`.
5. **Development prompts from this round:**
   - "Implement the complete AI features section; make sure there are no bugs."
   - "Complete these things, then do a complete platform hard test."
   - "Make a total simulator system; we will not use any real phone device for calling."
