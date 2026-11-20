# PeyajFlow: full codebase map

A complete walk-through of the repository as it stands on branch `ai-rubayet` (HEAD `7767cf0`, checked 2026-11-20). It complements the existing [README.md](README.md) (quick start and pilot walkthrough), [AGENTS.md](AGENTS.md) (rules for coding agents) and [WORK_STATUS.md](WORK_STATUS.md) (dated delivery log).

How this was produced: every source file under `services/api/app`, `apps/web/app`, `apps/web/lib`, the config files, CI, Compose, Render and Vercel manifests, and all docs were read or searched. Test suites and evaluations were **not run** for this document. Where a number comes from `WORK_STATUS.md` rather than from the code, it says so.

---

## 1. What PeyajFlow is

A Bangla-first workspace for the **Pabna-to-Dhaka onion trade**. It follows one lot from storage to a confirmed sale:

1. A **farmer** registers a lot, records inspections and losses, checks storage risk and a hold-or-sell comparison.
2. A **buyer** posts demand, browses eligible supply and makes offers.
3. The two negotiate (offer, counter, accept). Acceptance creates an **order** and reserves stock for 48 hours.
4. Transport is quoted and booked, the farmer dispatches, the buyer confirms receipt, and the buyer reports an off-platform payment reference.
5. An **operator** verifies that payment evidence. **PeyajFlow never moves money.**
6. A **field agent** can act for farmers who grant access, and reviews pending signups.
7. A **Bangla call simulator** lets users read data and stage changes by voice or text. Every change needs a spoken read-back and a 4-digit keypad code.

Everything is labelled honestly: demo and synthetic data are marked, and forecasts, advice and photo suggestions abstain when evidence is thin.

### Roles

| Role | Created by | Can do |
| --- | --- | --- |
| `farmer` | Self signup, then verification by an agent or operator | Lots, stock movements, inspections, offers and orders, hold/sell, grant or revoke agent access, call simulator |
| `buyer` | Self signup, then verification | Demand, supply search, offers, orders, transport requests, payment reports, call simulator |
| `agent` | Provisioned by an operator (CLI), not self signup | Act on delegated farmers' lots, verify weights, review inspections, review pending signups (verified, non-demo only) |
| `admin` (operator) | Provisioned by CLI | Account/lot/market verification, market CSV imports, disputes, settlements, audit, data quality, photo-model review |

Signup is limited to `farmer` and `buyer`. Signup stays `pending` and sign-in returns `account_not_verified` until approved. Rejecting a signup revokes active sessions.

---

## 2. Technology and tooling

| Layer | Stack |
| --- | --- |
| Web | Next.js 16.4.6 App Router, React 19.2, Tailwind 4, TypeScript 5.9. Fonts Inter and Hind Siliguri. |
| API | FastAPI, Pydantic v2, SQLAlchemy 2.0 **Core** (no ORM), Alembic, psycopg 3, Pillow, boto3 |
| Database | PostgreSQL 16 (CI and Compose). Hosted on Supabase. |
| Photo storage | Local filesystem (dev/test only) or private S3-compatible bucket |
| Browser ML | CLIP ViT-B/32 (q8, WebAssembly) in a Web Worker |
| Tests | pytest (API), Node test runner (web unit), Playwright-core plus axe (end-to-end) |
| Package tools | pnpm 10.34.9 workspace (`apps/*`), uv 0.13.7, Python 3.13 (Ruff target 3.12), Node 22+ |
| Hosting | Vercel Hobby (web), Render Free (API, Singapore), Supabase Free (Postgres and bucket) |

The browser never calls the API. Server components and server actions call it with an HTTP-only cookie (`peyajflow_session`) turned into a `Bearer` token.

---

## 3. Repository layout

```text
PeyajFlow/
├─ AGENTS.md  README.md  WORK_STATUS.md  PeyajFlow_Codex_Master_Handoff.md  CODEBASE_README.md
├─ compose.yaml  render.yaml  package.json  pnpm-workspace.yaml  pnpm-lock.yaml
├─ .github/workflows/ci.yml
├─ .env.example  .editorconfig  .gitattributes  .gitignore
├─ peyajflow-logo-transparent-raster.png        (owner-supplied 311 x 59 logo)
├─ scripts/release-smoke.mjs
├─ docs/  AI_FEATURES.md  DEPLOYMENT.md  DEMO_AUDIT.md  BRAND_ASSET_PROVENANCE.md  design-reviews/*.png|jpg
├─ apps/web/                                    Next.js workspace
│  ├─ app/  (index)/route.ts  [locale]/{layout,page}.tsx  [locale]/workspace/...  globals.css  product.css
│  ├─ components/  brand-logo.tsx  refresh-status.tsx  workspace/*.tsx (24 files)
│  ├─ lib/  workspace-api.ts  workspace-copy.ts  workspace-types.ts  pilot-types.ts  workspace-values.ts  copy.ts  health.ts  inspection-upload.ts
│  ├─ public/  condition-model.js  onion-storage.webp  peyajflow-logo.png  peyajflow-icon.png
│  ├─ tests/  health.test.ts  index.test.ts  e2e/{pilot,market-voice,release}.test.mjs
│  └─ next.config.ts  vercel.json  eslint.config.mjs  postcss.config.mjs  tsconfig.json  package.json
└─ services/api/                                FastAPI service
   ├─ app/  (31 modules, about 8,950 lines)
   ├─ migrations/versions/  (18 revisions)
   ├─ evals/  intent_eval.py  metrics.py  data/*.jsonl  results/*.{json,md}
   ├─ tests/  (11 files)
   └─ Dockerfile  start-hosted.sh  alembic.ini  pyproject.toml  uv.lock  .env.example
```

Git: 23 commits. Local branches `ai-rubayet` (current), `authenticator--shanto`, `main`. Remote branches also include `Ai-Native---Mahir`, `Meem_v1.0` and `chore/hosting-release-audit`. Working tree was clean at the start of this review.

---

## 4. Backend (`services/api/app`)

### 4.1 Request pipeline ([main.py](services/api/app/main.py), [hardening.py](services/api/app/hardening.py), [database.py](services/api/app/database.py))

- `lifespan` requires **exactly one Alembic head** or refuses to start, then starts three background loops:
  - `expire_reservations` every 20 s releases stock for confirmed orders past their 48 h deadline.
  - `deliver_notifications` every 15 s sends queued SMS.
  - `prune_rate_limits` every 10 min deletes buckets older than a day.
- Health: `GET /health/live` (process) and `GET /health/ready` (database reachable **and** at the expected Alembic head, else HTTP 503 with `unconfigured`, `unreachable` or `migration_required`).
- Middleware: request body limits (12 KiB for webhooks, 16 KiB for `/v1/auth/*`, 13 MiB for inspection uploads, 2 MiB otherwise), `X-Request-ID`, `Cache-Control: no-store`, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and JSON request logging in production (route template, status, duration only).
- Errors are normalized: validation failures become `422 invalid_input`, database failures become `503 database_unavailable`.
- Engine: PostgreSQL via psycopg only. 3 s connect, 3 s statement timeout, `pool_pre_ping`, parameters hidden in logs.

### 4.2 Identity, sessions and credentials ([auth.py](services/api/app/auth.py), [credentials.py](services/api/app/credentials.py))

- Tables: `users`, `organizations`, `memberships`, `sessions`, `delegations`, `audit_log`, `account_credentials`.
- `users` holds `verified`, `verification_status` (`pending|verified|rejected`), unique `nid` and `phone`. `memberships.role` is constrained to the four roles.
- Sessions are opaque 43-character tokens, stored as SHA-256 hashes, valid for 8 hours. Every authenticated production request is also limited to 120 per minute per member.
- Passwords: scrypt (n=2^15, r=8, p=3), 14 to 256 characters, concurrency capped at two hashes at a time (`429 rate_limited` when saturated). Sign-in does a dummy hash for unknown accounts to avoid user enumeration. Account IDs are case-folded.
- Bangla digits in phone and NID are normalized to ASCII before storage.
- Unique-constraint violations map to `username_taken`, `nid_taken`, `phone_taken`.
- Demo accounts: six fixed identities (`farmer`, `farmer-two`, `buyer`, `buyer-two`, `agent`, `admin`) with deterministic UUIDs. They exist only when `APP_ENV` is `development` or `test` **and** `DEMO_MODE=true`, or in production behind `SHOWCASE_ACCESS_KEY` (20+ characters, compared in constant time, 30 attempts per minute per client). Demo data is isolated from real data by `is_demo` filters everywhere.
- Delegation: a farmer grants an agent access by the agent's membership ID (verified agents only), and can revoke it.
- CLI: `python -m app.credentials <username> --role ... --name ... --district ... --organization ... [--prompt-verified-phone] [--replace-password]` provisions or rotates accounts. It prompts for the passphrase.

### 4.3 Domain modules

| Module | What it does | Key rules |
| --- | --- | --- |
| [lots.py](services/api/app/lots.py) | Lots and an immutable stock ledger (`lots`, `lot_events`) | kg to 3 decimals. Maunds need an explicit kg-per-maund. Reported and verified quantity are separate. `available >= reserved >= 0` is enforced by DB check constraints. Movements are `WEIGHED_ADJUSTMENT` or `LOSS_REPORTED`. Create and move are idempotent through `request_key`. Grades `A/B/C/ungraded`. Agents can register lots for farmers who delegated. |
| [demand.py](services/api/app/demand.py) | Buyer requests and supply matching | Delivery window starts today or later. Minimum grade, price ceiling, transport party. `GET /v1/matches` ranks listed, eligible supply. Pages of 20. |
| [trade.py](services/api/app/trade.py) | Offers, counteroffers, orders | Offer actions `accept/reject/counter/withdraw`. Versioned terms and history. Active offer states `sent` and `countered`. Acceptance atomically reserves stock for 48 h. Order actions: `dispatch` (farmer, from `confirmed`), `receive` (buyer, from `dispatched`), `cancel` (from `confirmed`), `dispute` (from `dispatched` or `delivered`). Confirmation (`confirm: true`) is required. Expiry releases the reservation. Replays return the stored receipt (`idempotency_conflict` if the payload differs). |
| [inspection.py](services/api/app/inspection.py) | Structured inspections, private photos, reviews, model predictions | 1 to 4 photos, explicit consent, observation date between storage date and today. Photos: JPEG/PNG/WebP, 3 MiB and 12 MP each, re-encoded to JPEG without metadata (EXIF-rotated, max 1400 px). Quality flags `small_image`, `too_dark`, `too_bright`, `low_detail`. Reviews carry provenance `human_review` or `owner_correction`. A farmer cannot overwrite a human review (`review_locked`). Served with `Cache-Control: private, no-store`. |
| [condition.py](services/api/app/condition.py) | Image decoding and quality | Also holds the visible-flag enum: `no_obvious_defect`, `visible_rot_or_mold`, `sprouting`, `physical_damage`, `uncertain_or_low_quality` |
| [risk.py](services/api/app/risk.py) | Storage-risk checklist `storage-checklist-v1` | Bands `high/moderate/low/insufficient_data`, with reason codes and missing evidence. Inspection older than 7 days is stale. Strong triggers: visible rot, wet storage, off odor. Attention triggers: sprouting, damage, poor ventilation, uncured stock, humidity above 70% on cured stock, temperature extremes, long storage in the sprouting range. Reference: UC Davis dry-onion sheet. |
| [market_data.py](services/api/app/market_data.py) | CSV staging, validation, approval, price series | 12-column header enforced. Up to 1,000 rows and 400 KB per batch. Original publication date is kept so backtests exclude future reports. Maund prices need the source's conversion (1 to 100 kg). Rows older than 7 days are `stale`. Synthetic imports are flagged. A partial unique index prevents duplicate active observations. |
| [forecast.py](services/api/app/forecast.py) | 7/14/28-day outlook | Baselines `last_value`, `rolling_median`, `seasonal_naive`. Weekly replays using only reports published by each origin. Metrics: MAE, WAPE, interval coverage, pinball loss. Candidate `historical_change_quantiles` is promoted only after beating baselines by more than 10% MAE on at least 24 comparable replays with 70 to 95% coverage. Otherwise `baseline`, `insufficient_data` or `stale`. |
| [price_model.py](services/api/app/price_model.py) | Nearest-neighbour price model `lagged_price_neighbors` | Features: log price changes at 7/14/28-day lags plus yearly seasonality. 7 neighbours, at least 24 training examples, up to 78. Shown as a preview next to the gated forecast. |
| [loss_model.py](services/api/app/loss_model.py) | Storage-loss trend `verified_weight_trend` | Log-linear fit of verified weights. Needs at least 3 comparable readings, a span of at least max(14, horizon) days, latest reading within 7 days, and non-increasing weights. The trend restarts after stock additions, corrections or dispatch. Experimental. |
| [advice.py](services/api/app/advice.py) | Hold-or-sell comparison | Outputs `SELL`, `HOLD`, `SELL_PART`, `INSUFFICIENT_DATA` with confidence, reasons, loss, freight, storage, financing, fees and cash need. Sell-now price comes from a verified offer or user assumption, never silently from the market. Market series must match the lot's district, grade and be farmgate (`advice_market_mismatch`). |
| [logistics.py](services/api/app/logistics.py) | Transport quote requests, recorded quotes, booking | Only the party responsible for transport requests, selects or cancels. Operators record quotes received from transporters. Pickup must fall inside the reservation and delivery window. Computes buyer landed cost and seller net. One active request per order. |
| [settlement.py](services/api/app/settlement.py) | Manual payment evidence | Buyer reports an opaque reference for the full goods total after delivery. An operator verifies or rejects with an evidence reference. DB constraint ties status to reviewer fields. References are excluded from the searchable audit projection. |
| [notifications.py](services/api/app/notifications.py) | In-app inbox and optional SMS | Idempotent events (`kind:resource:version`). SMS requires a verified phone, recorded consent, an approved provider, and respects quiet hours (default 22:00 to 07:00 Asia/Dhaka). Up to 4 attempts with exponential backoff. STOP opts out. An uncertain send is never auto-retried. |
| [admin.py](services/api/app/admin.py) | Operations | Overview counters, account verification, data-quality view per series, photo-model agreement, filtered audit, dispute resolution (restores `dispatched` or `delivered`, with a note of at least 5 characters). |
| [voice.py](services/api/app/voice.py) | Call simulator | See section 6.1. |
| [intent.py](services/api/app/intent.py) | Deterministic command grammar | See section 6.1. |
| [telephony.py](services/api/app/telephony.py), [twilio.py](services/api/app/twilio.py) | Optional carrier adapter | Signature verification, provider-account check, retry fingerprints in `provider_events`, call states in `carrier_calls`. Public keypad menu only. |
| [rate_limits.py](services/api/app/rate_limits.py) | Postgres-backed fixed-window limiter | Hashed keys, atomic upsert, `429` with `Retry-After`. |
| [photo_storage.py](services/api/app/photo_storage.py) | Storage adapter | `local` only in development or test. `s3` needs `S3_BUCKET`. Failures return `503 photo_storage_unavailable`. |
| [seed.py](services/api/app/seed.py), [seed_market.py](services/api/app/seed_market.py), [seed_showcase.py](services/api/app/seed_showcase.py) | Demo data | `seed` creates demo accounts. `seed_market` creates a fictional weekly farmgate series. `seed_showcase` builds four lots, a demand, offers, orders, a quote and booking, a reviewed inspection and settlement evidence through the real services (idempotent via stable keys). |
| [migrate.py](services/api/app/migrate.py) | Migration runner | Takes a Postgres advisory lock so concurrent deploys cannot race. 60 s statement timeout. |

### 4.4 Database

33 application tables, all SQLAlchemy Core definitions declared next to their routers:

`users`, `organizations`, `memberships`, `sessions`, `delegations`, `audit_log`, `account_credentials`, `lots`, `lot_events`, `buyer_requests`, `offers`, `orders`, `trade_actions`, `inspections`, `inspection_photos`, `inspection_reviews`, `photo_predictions`, `market_imports`, `market_prices`, `logistics_requests`, `logistics_quotes`, `call_sessions`, `assistant_actions`, `assistant_tasks`, `carrier_calls`, `provider_events`, `verified_contacts`, `notification_preferences`, `notifications`, `sms_deliveries`, `rate_buckets`, `dispute_resolutions`, `order_payment_reports`, plus Alembic's `alembic_version`.

Migration chain (18 revisions, single head `0018_signup`):

```text
0001_foundation → 0002_identity → 0003_stock → 0004_demand → 0005_trade → 0006_inspection
→ 0007_offer_terms → 0008_market → 0009_logistics → 0010_voice → 0011_carrier
→ 0012_notifications → 0013_operations → 0014_release → 0015_settlement
→ 0016_vision → 0017_signup_nid → 0018_signup
```

### 4.5 HTTP API (about 85 endpoints, OpenAPI at `/docs`)

| Area | Endpoints |
| --- | --- |
| Health | `GET /health/live`, `GET /health/ready` |
| Identity | `GET/POST /v1/auth/demo`, `POST /v1/auth/password`, `POST /v1/auth/signup`, `GET /v1/auth/verifications`, `POST /v1/auth/verify`, `DELETE /v1/auth/session`, `GET/PATCH /v1/me`, `GET /v1/delegations`, `PUT/DELETE /v1/delegations/{agent_id}` |
| Stock | `GET/POST /v1/lots`, `POST /v1/lots/delegated/{farmer_id}`, `GET/PATCH /v1/lots/{id}`, `POST .../movements`, `POST .../verification` |
| Demand | `GET/POST /v1/buyer-requests`, `GET /v1/buyer-requests/{id}`, `POST .../close`, `GET /v1/matches` |
| Trade | `GET/POST /v1/offers`, `GET /v1/offers/{id}`, `POST .../respond`, `GET /v1/orders`, `GET /v1/orders/{id}`, `POST .../transition` |
| Inspection | `GET/POST /v1/lots/{id}/inspections`, `GET .../inspection-photos/{photo}`, `POST .../predictions`, `POST .../inspections/{id}/review` |
| Risk and advice | `GET /v1/lots/{id}/risk`, `GET/POST /v1/lots/{id}/recommendation` |
| Market | `GET /v1/market/series`, `GET /v1/market/prices`, `GET /v1/market/forecasts`, `GET/POST /v1/admin/data-imports`, `GET .../{batch}`, `POST .../{batch}/review` |
| Logistics | `GET /v1/orders/{id}/logistics`, `POST /v1/logistics/quote-requests`, `.../{id}/quotes`, `.../{id}/book`, `.../{id}/cancel` |
| Settlement | `GET/POST /v1/orders/{id}/settlement`, `POST .../settlement/{payment}/review`, `GET /v1/admin/settlements` |
| Voice | `POST /v1/voice/resolve`, `POST /v1/voice/calls`, `GET/DELETE /v1/voice/calls/{id}`, `POST .../intent`, `.../confirm`, `.../actions/{id}/cancel`, `GET/POST /v1/voice/tasks`, `POST .../tasks/{id}/resolve` |
| Notifications | `GET /v1/notifications`, `POST .../read-all`, `POST .../{id}/read`, `GET/PUT .../preferences` |
| Operations | `GET /v1/admin/overview`, `GET/PUT /v1/admin/verifications`, `GET /v1/admin/data-quality`, `GET /v1/admin/photo-model`, `GET /v1/admin/audit`, `GET /v1/admin/disputes`, `POST .../disputes/{order}/resolve` |
| Carrier and SMS webhooks | `POST /v1/webhooks/telephony/twilio` (and `/menu`, `/status`), `POST /v1/webhooks/messaging/twilio/status`, `POST .../opt-out` |

### 4.6 Rate limits in the code

| Scope | Limit |
| --- | --- |
| Authenticated member (production only) | 120 per 60 s |
| Password sign-in, per client / per account | 100 per 300 s / 8 per 900 s |
| Signup, per client | 20 per 300 s |
| Showcase login, per client | 30 per 60 s |
| Photo prediction, per member | 30 per 600 s |

### 4.7 Environment variables the API reads

`DATABASE_URL`, `APP_ENV`, `DEMO_MODE`, `SHOWCASE_ACCESS_KEY`, `PHOTO_STORAGE`, `PHOTO_DIR`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `PUBLIC_API_ORIGIN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_VOICE_GREETING_URL`. The provider flags `TELEPHONY_PROVIDER` and `SMS_PROVIDER` (value `twilio` or `disabled`) are read in `twilio.py`.

---

## 5. Frontend (`apps/web`)

### 5.1 Routes

| Route | Purpose |
| --- | --- |
| `/` | 307 to `/bn` |
| `/[locale]` (`bn` or `en`) | Public landing page with capability cards and a "How it works" section |
| `/[locale]/workspace/[[...section]]` | The whole signed-in app, rendered by one catch-all page. Signed-out visitors see demo account chooser (when enabled), password sign-in and signup. |
| `/[locale]/workspace/photos/[lot]/[photo]` | Route handler that proxies the private JPEG with the user's session |

Navigation is built per role in `destinations()`:

| Role | Pages |
| --- | --- |
| All | Overview, Market prices, Alerts, Help |
| Farmer | My stock, Offers, Orders, Agent access |
| Buyer | Demand, Browse supply, Offers, Orders |
| Agent | Stock, Signup verification (verified, non-demo) |
| Admin | Stock, Offers, Orders, Operations, Market imports |
| Voice (`Bangla assistant`) | Demo and showcase roles, plus verified farmers and buyers |

Deeper pages: `stock/{lot}`, `stock/{lot}/inspections`, `.../risk`, `.../advice`, `offers/{id}`, `orders/{id}`, `orders/{id}/logistics`, `imports/{id}`, `voice/{id}`.

### 5.2 Server actions

| File | Exports |
| --- | --- |
| `actions.ts` | `signIn`, `passwordSignIn`, `signupAction`, `signOut`, `mutate` (profile, lots, movements, verification, demand, offers, orders, inspections, reviews, signup verification) |
| `pilot-actions.ts` | `pilotMutate` (market import and review, transport request, quote, book, cancel, start call, resolve task), `runAdvice`, `runVoice`, `resolveVoice`, `savePhotoPrediction` |
| `operations-actions.ts` | `operate` (alerts, SMS preferences, account verification, dispute resolution, payment report and review, agent grant and revoke, help requests) |

Cookie: `httpOnly`, `sameSite=lax`, `secure` unless running on a loopback host with `APP_COOKIE_SECURE=false` and not on Vercel. API calls time out after 12 s locally and 48 s on Vercel.

### 5.3 Components (`components/workspace`)

`dashboard`, `stock`, `inspection` (and risk), `photo-model`, `market` (demand and supply), `trade` (offers and orders), `logistics`, `settlement`, `prices` (prices, forecasts and imports), `advice` and `advice-form`, `voice` and `voice-desk`, `speech-input`, `alerts`, `sms-demo`, `assistance`, `agents`, `verifications`, `operations`, plus shared `form`, `fields`, `icon`, `offline`. Top-level: `brand-logo`, `refresh-status`.

### 5.4 Localization and formatting

- Every user-facing string goes through `local(locale, bn, en)` (Bangla first). API error codes map to bilingual text in [workspace-copy.ts](apps/web/lib/workspace-copy.ts).
- [workspace-values.ts](apps/web/lib/workspace-values.ts) handles Bangla digits, Dhaka dates (`Asia/Dhaka`) and grouped numbers for `bn-BD` and `en-BD`.
- The language switch keeps the section and query string.

### 5.5 Browser photo model ([public/condition-model.js](apps/web/public/condition-model.js))

A module Web Worker that loads `@huggingface/transformers@3.8.1` from the site itself (copied and hash-checked into `public/vendor/` at build time by `scripts/vendor-photo-model.mjs`, under a worker-only CSP), runs `Xenova/clip-vit-base-patch32` pinned to revision `6b7c523…` (q8, WASM, one thread), and scores five prompts (rot or mold, sprouting, cuts or bruises, intact dry skin, no clear view). It abstains unless the top score is at least 0.58 **and** leads the second by at least 0.16 (`clip-margin-v1`). The constants must match `PHOTO_MODEL` and `PHOTO_RULE` in `inspection.py`.

### 5.6 Security headers ([next.config.ts](apps/web/next.config.ts))

`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: microphone=(self), geolocation=()`, and a CSP limited to `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`. Server-action bodies up to 13 MB. The `X-Powered-By` header is off.

---

## 6. The AI and decision-support features

Every claim below matches [docs/AI_FEATURES.md](docs/AI_FEATURES.md) and the code. Rule 1 of AGENTS.md holds: nothing from a model or parser runs SQL or changes data directly.

### 6.1 Bangla call simulator (deterministic, no language model)

- `intent.py` normalizes text (Unicode NFC, Bangla digits to ASCII, invisible joiners removed, spelling variants, digits split from units such as `২০০কেজি`) and matches 14 commands.
  - Reads: `prices`, `stock`, `advice`, `offers`, `orders`.
  - Changes: `accept`, `reject`, `counter`, `movement`, `register`, `send_offer`, `transport`, `inspection`, `support`.
- Quantities are read from digits (`২০০ কেজি`) or from words directly before kg or maund. Examples: দুইশো কেজি, দেড় মণ, সাড়ে তিন মণ, দুই হাজার পাঁচশো কেজি, "two hundred and fifty kg", "tin mon". Irregular or unattached number words abstain with `number_words`.
- Outcomes: `resolved` (exact or pattern), `ambiguous`, `negated`, `unknown`. Error codes: `voice_negated`, `voice_ambiguous`, `voice_say_quantity`, `voice_onion_only`, `voice_unsupported`, `voice_repeat`.
- A negation never becomes the opposite command. A change command outranks a read command in the same sentence. Negation does not block reads.
- `voice.py`: a call lasts 10 minutes and holds at most 60 actions. A change is staged with a Bangla read-back and a 4-digit code valid for up to 2 minutes (bound to the action ID). Three wrong attempts cancel it, with a warning before the last. Only one pending change per call. A spoken quantity must equal the form quantity after converting maunds with the lot's recorded conversion (`voice_quantity_mismatch`). A selected command must match the phrase (`voice_tool_mismatch`). Support and inspection requests go to an operator or delegated-agent queue (`assistant_tasks`).
- The web calls `POST /v1/voice/resolve` to preview what was understood. Browser speech recognition supplies up to three alternatives.
- Optional Twilio adapter provides a signed public keypad menu only. No carrier speech recognition or caller linking.

### 6.2 Photo condition suggestion

Runs in the user's browser, stores scores through `POST .../predictions` only for the pinned model and rule, and lets the API derive the label. Low-quality photos are refused (`photo_quality_insufficient`). Reviewer flags are never pre-filled. **Operations, Photo model** compares suggestions with human review and shows an agreement rate only after at least 20 comparable pairs.

### 6.3 Forecasts, loss trend and hold or sell

See the module table in 4.3. They abstain on stale or short evidence, label synthetic series, and expose backtest errors.

### 6.4 Evaluations ([services/api/evals](services/api/evals))

Run from `services/api`: `uv run --locked python -m evals.intent_eval --label <name> [--dataset ...] [--check]`.

| Dataset | Resolver | Accuracy | Wrong change commands | Source |
| --- | --- | --- | --- | --- |
| `intent.jsonl`, 239 rows | original exact match | 0.360 | 1 | `results/intent-before` |
| `intent.jsonl`, 239 rows | current resolver | 1.000 | 0 | `results/intent-after` |
| `intent-challenge.jsonl`, 58 rows | first run, before fixes | 0.603 | 2 | `results/intent-challenge-first-run` |
| `intent-challenge.jsonl`, 58 rows | after fixes | 0.931 | 0 | `results/intent-challenge-after` |
| `intent.jsonl`, 259 rows | with spoken numbers | 1.000 | 0 | `results/intent-number-words` |
| `intent-challenge.jsonl`, 58 rows | with spoken numbers | 0.948 | 0 | `results/intent-challenge-number-words` |

These are figures recorded in the repository's result files (commit `94554e9`, 2026-11-18), not re-run for this document. The main set was written by the same author as the grammar, so 1.000 is an upper bound. The challenge set is the better estimate. Both datasets are AI-written and need native Bangla speaker review. No labelled photo set exists, so photo-model accuracy is unmeasured. CI fails if any wrong change command appears, if accuracy drops below 0.95 (main) or 0.90 (challenge), or if quantity accuracy drops below 0.95.

---

## 7. Security model

- **Authorization lives in the API**: `require_role`, scoped queries (`scoped_lots`, `trade_scope`, `get_lot`), `is_demo` isolation, and `404 not_found` for out-of-scope resources.
- **Auth hygiene**: hashed session tokens, scrypt passwords, no user enumeration, KDF concurrency cap, per-IP and per-account rate limits, sign-out and rejection revoke sessions.
- **Idempotency and concurrency**: `request_key` plus request hashes, row locks (`with_for_update`), partial unique indexes, DB check constraints on stock balance and payment review state.
- **Auditing**: `audit()` writes to `audit_log`. Payment references are kept out of the audit projection.
- **Photos**: metadata stripped, re-encoded, private, authorized access only, anonymous and cross-account reads denied (verified in tests per WORK_STATUS).
- **Money**: never moved. Settlement is evidence recording only.
- **Telephony and SMS** are disabled by default (`TELEPHONY_PROVIDER=disabled`, `SMS_PROVIDER=disabled`) until provider, consent and opt-out checks pass.

---

## 8. Build, run and test

```sh
# local stack
docker compose up --build -d                       # PostgreSQL 16, migrate, API on 127.0.0.1:8000
docker compose exec api python -m app.seed_showcase
pnpm install --frozen-lockfile
pnpm dev                                           # http://localhost:3000/bn/workspace

# web checks (repo root)
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build

# API checks (services/api), against a disposable database
uv run --locked ruff check . && uv run --locked ruff format --check .
uv run --locked python -m app.migrate && uv run --locked alembic check
uv run --locked pytest -q
uv run --locked python -m evals.intent_eval --check
uv run --locked python -m evals.intent_eval --check --min-accuracy 0.9 --dataset evals/data/intent-challenge.jsonl

# end to end
pnpm --filter @peyajflow/web exec playwright-core install chromium
pnpm test:e2e
SMOKE_DEMO_ID=farmer pnpm smoke
```

Compose services: `db` (postgres:16, volume `postgres-data`), `migrate` (one-shot), `api` (`APP_ENV=development`, `DEMO_MODE=true`, local photo volume).

### Test inventory (static count)

| Suite | Files | Notes |
| --- | --- | --- |
| API pytest | `test_pilot`, `test_market_and_voice`, `test_release`, `test_voice_commands`, `test_completion`, `test_signup`, `test_intent`, `test_photo_predictions`, `test_eval_metrics`, `test_health`, `test_risk` | 45 test functions found in 11 files. WORK_STATUS reports **90** tests passing, which implies parametrization. Most need a disposable PostgreSQL (`TEST_DATABASE_URL`). |
| Web unit | `health.test.ts`, `index.test.ts` | 4 tests |
| Playwright (Edge or Chromium) | `pilot`, `market-voice`, `release` | Multi-account workflows with axe checks. The signup-review test needs `E2E_AGENT_USERNAME` and `E2E_AGENT_PASSWORD`. |
| Smoke | `scripts/release-smoke.mjs` | Liveness, readiness, locale redirect, headers, sign-in, inbox, photo access denial, session revocation. Needs an HTTPS origin or HTTP loopback. |

### CI ([.github/workflows/ci.yml](.github/workflows/ci.yml))

Three jobs on PRs and pushes to `main`:

1. **web**: format, lint, typecheck, unit tests, build, then migrate and seed a Postgres 16 service, start API and web, run Playwright and the smoke check.
2. **api**: Ruff, migrate, `alembic check`, pytest, both intent evaluations.
3. **container**: Compose build, readiness, seed, `pg_dump`, restore into a second database and compare Alembic head and user count.

---

## 9. Deployment

| Target | Config | Notes |
| --- | --- | --- |
| Render (API) | [render.yaml](render.yaml), [start-hosted.sh](services/api/start-hosted.sh) | Free Docker service, Singapore. Runs `app.migrate`, seeds the showcase if `SHOWCASE_ACCESS_KEY` is set, then starts uvicorn. Health check `/health/ready`. Auto-deploy off. `APP_ENV=production`, `DEMO_MODE=false`. |
| Vercel (web) | [apps/web/vercel.json](apps/web/vercel.json) | Root `apps/web`, Node 24, functions up to 60 s. Needs `API_INTERNAL_BASE_URL`, and `SHOWCASE_REQUIRE_CODE=true` for the private chooser. |
| Supabase | Runbook in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Postgres via session-mode pooler with `sslmode=require`, private `inspections` bucket. |

The runbook also covers production account provisioning, the carrier and SMS acceptance checks, `pg_dump`/`pg_restore` rehearsal, monitoring, rollback and settlement review. The deployed URLs recorded in WORK_STATUS are `peyajflow.vercel.app`, `peyajflow.tahmidkhan.com.bd` and `peyajflow-api.onrender.com`. Their current state was not checked here.

---

## 10. Documentation inventory

| File | Contents |
| --- | --- |
| [README.md](README.md) | Overview, run locally, pilot walkthrough, CSV format, checks |
| [AGENTS.md](AGENTS.md) | Rules for coding agents: repo map, commands, conventions, AI and decision rules, security, git and CI |
| [WORK_STATUS.md](WORK_STATUS.md) | Dated delivery log, F00 to F17 milestones, verification table, open risks |
| [docs/AI_FEATURES.md](docs/AI_FEATURES.md) | Decision-support features with measured results and limitations |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Release, carrier and SMS checks, backup and restore, rollback, settlement review |
| [docs/DEMO_AUDIT.md](docs/DEMO_AUDIT.md) | Audit of an external demo used as an interaction reference |
| [docs/BRAND_ASSET_PROVENANCE.md](docs/BRAND_ASSET_PROVENANCE.md) | Origin of the logo, icon and generated landing photograph |
| [PeyajFlow_Codex_Master_Handoff.md](PeyajFlow_Codex_Master_Handoff.md) | Original 947-line planning pack: PRD, architecture, backlog, design system, quality gates. Where it disagrees with the code, the code wins. |
| `docs/design-reviews/` | 19 review screenshots referenced by README and WORK_STATUS |

---

## 11. Observations worth knowing

These are findings from reading the code. None were changed.

1. **The simulator's keypad code is returned to the client.** `POST /v1/voice/calls/{id}/intent` returns `demo_code` in the response for every staged change, and the web server action surfaces it (`pilot-actions.ts`, around line 281). The code binds a change to a deliberate confirmation step, but it is not an independent factor. The API labels calls `mode: "simulation"`, and AGENTS.md and the docs describe it as a simulator. It would need a separate channel (for example carrier DTMF) before it counts as real authentication.
2. **Verified farmers and buyers can use the simulator**, not only demo accounts (`voice.gate`). This is intended and documented, and it means simulated-call changes now touch real data for those accounts.
3. **The photo worker's model weights come from Hugging Face at runtime** (pinned revision). Since November 20, 2026 the library and ONNX runtime are self-hosted and hash-checked at build time, and the worker has a script-limiting CSP. Builds therefore need access to the npm registry.
4. **The agent signup-review flow depends on manual identity checking.** The code records approve or reject, with a reason, and audits it. Nothing in the software checks the NID.
5. **Test count in docs versus code.** Static counting shows about 45 API test functions. Parametrized cases bring the total higher: the full suite ran 90 tests before the spoken-number change and 129 after it, on a disposable PostgreSQL 16 on November 20, 2026.
6. **Evaluation caveats already stated by the project**: the main intent set is author-written and not independent, the challenge set is small (58 rows), nothing has been evaluated on recorded speech, and the photo model has no accuracy figure.
7. **Field validation is open for every model**: forecasts, photo suggestions, storage-loss trend and Bangla speech across dialects.
8. **Branch and authorship**: recent commits (`d86c1cc`, `7767cf0`) are authored by `asifzaman`, earlier AI work by `mahir2995`, and the foundation by Tahmid Khan. The upstream repository is `tahmidkhanshuvo/PeyajFlow`.

---

## 12. Open work (from WORK_STATUS and the code)

- Native Bangla speaker review and extension of the intent datasets.
- A labelled photo set and at least 20 real reviewed pairs for the agreement view.
- Real market and storage evidence, and prospective evaluation of forecasts.
- Live carrier and SMS acceptance (Twilio) with approved numbers and consent checks.
- Recovery rehearsal for private photo objects alongside the database export.
- The owner's vector logo (the current logo is an interim raster).
- Post-pilot roadmap: licensed payment and carrier integrations, independent transporter tracking, sensors and offline drafts.
