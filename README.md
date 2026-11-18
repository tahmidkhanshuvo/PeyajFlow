<div align="center">
  <img src="apps/web/public/peyajflow-logo.png" alt="PeyajFlow" width="245" />
  <h1>PeyajFlow</h1>
  <p>From onion stock to a confirmed sale.</p>
  <p>
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-frontend-362142?style=flat-square" />
    <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-backend-674173?style=flat-square" />
    <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-database-815592?style=flat-square" />
    <img alt="Bangla and English" src="https://img.shields.io/badge/Languages-Bangla%20%2F%20English-4d704e?style=flat-square" />
  </p>
</div>

## 📖 Contents

[About](#about-the-project) · [Features](#key-features) · [Setup](#run-locally) · [Work tracker](WORK_STATUS.md) · [Deployment](docs/DEPLOYMENT.md) · [Decision-support features](docs/AI_FEATURES.md) · [Agent guide](AGENTS.md)

## About the project

PeyajFlow is a Bangladesh-first onion supply-chain platform built around the Pabna-to-Dhaka trade. It connects farmer inventory, storage inspections and market evidence to a buyer's order, delivery and payment review. The public portfolio uses an isolated workspace with illustrative records and market observations.

## Key features

| Workspace | Workflows |
| --- | --- |
| Farmer | Stock, measured quantities, photo inspections, storage risk, hold/sell comparisons, offers and orders |
| Buyer | Buying requirements, eligible supply, order negotiations, transport quotes, receipt and payment reporting |
| Field agent | Farmer-granted access, assisted lot registration, stock verification, inspections and support |
| Operations | Account verification, market data provenance, model health, disputes, payment review and audit history |

Next.js and React serve the bilingual workspace. FastAPI, SQLAlchemy and Alembic manage the workflows and PostgreSQL schema. Inspection photos can use a private S3-compatible bucket. Docker Compose runs the database and API, and Playwright checks multi-account workflows. See the [original handoff](PeyajFlow_Codex_Master_Handoff.md) for scope and architecture.

## Workspace preview

![PeyajFlow landing page](docs/design-reviews/portfolio-home.png)

| Farmer workspace | Buyer workspace |
| --- | --- |
| ![Farmer dashboard](docs/design-reviews/portfolio-farmer.png) | ![Buyer dashboard](docs/design-reviews/portfolio-buyer.png) |

[Bangla mobile workspace](docs/design-reviews/portfolio-farmer-bn-mobile.png) · [Operations workspace](docs/design-reviews/portfolio-operations.png)

## Run locally

Install Node.js 22 or later, pnpm 10.34.9, and Docker with Compose. Python 3.13 and uv are required for host-native API development. Copy `apps/web/.env.example` to `apps/web/.env.local` for the local HTTP session cookie setting.

```sh
docker compose up --build -d
docker compose exec api python -m app.seed_showcase
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:3000/bn/workspace` for Bangla or `http://localhost:3000/en/workspace` for English. The API serves OpenAPI at `http://127.0.0.1:8000/docs`. Its `/health/live` checks the process and `/health/ready` checks PostgreSQL and the current Alembic revision. Compose migrates before starting the API and persists PostgreSQL and private inspection photos in named volumes.

Compose defaults are for local development. Copy the root `.env.example` to `.env` to override ports or PostgreSQL credentials. For custom local passwords, use URL-safe characters because Compose interpolates the password into the connection URL. Copy `apps/web/.env.example` to `apps/web/.env.local` to change the server-side API address when running Next.js on the host. Neither port nor database credentials are needed in the browser.

### Run the API on the host

Use an existing local PostgreSQL instance or start PostgreSQL alone with `docker compose up -d db`. In `services/api`, copy `.env.example` to `.env` and adjust the connection URL if needed.

```sh
uv sync --locked
uv run --env-file .env python -m app.migrate
uv run --env-file .env python -m app.seed
uv run --env-file .env uvicorn app.main:app --reload
```

### Try the pilot

1. Sign in as **Rahim** and list a 1,000 kg lot in Pabna. Enter kilograms or enter maunds with the agreed kg-per-maund conversion.
2. Sign in as **Jalil** in a separate browser session and verify Rahim's stock. Jalil is assigned to Rahim's lots.
3. Sign in as **Nadia**, create a demand, find matching supply, and make an offer for 200 kg. As Rahim, review and confirm the offer. Both sessions see the same order and Rahim's lot shows the reservation.
4. As Rahim, submit a storage inspection with two to four photos and manual observations. As Jalil, review the evidence. Open **Storage risk** to see the reasons, missing evidence, and suggested inspection urgency.
5. As the demo operator, use **Market imports** to stage a CSV, inspect provenance and skipped rows, and approve the observations. Use **Market prices** to review the data and the 7-, 14-, or 28-day outlook. Open **Hold or sell** from a lot to compare proceeds under explicit loss, freight, storage, financing, and fee assumptions.
6. Use **Call simulator** as Rahim to accept a separate active offer. Select its lot and offer, review the Bangla terms, and enter the demo keypad code. The same order appears in the farmer and buyer workspaces. The party responsible for transport can request a quote from that order. The operator can record a quote received from a transporter, and the responsible party can select it.
7. Open **Alerts** to review activity on offers, orders, and transport. Sign in as the operator and open **Operations** to review verifications, market data health, open disputes, and audit events.
8. As Rahim, confirm dispatch. As Nadia, confirm receipt and enter a fictional transaction reference under **Settlement**. The operator can review independent evidence in **Operations → Settlements**. Both parties see the decision. The system records off-platform payment evidence and never moves funds.
9. As Jalil, copy the agent access ID from the workspace overview. Sign in as Salma and grant that ID access under **Agent access**. Jalil can register an unlisted lot for Salma. Salma can request an inspection from the lot page, follow the request under **Help**, and revoke access at any time.

### Market imports, forecasts, and call simulation

Use this CSV header in the displayed order:

```csv
observed_on,published_on,district,market,price_type,grade,unit,kg_per_maund,low,high,source_url,source_record
```

Use ISO dates, `farmgate`, `wholesale`, or `retail` for `price_type`, and `A`, `B`, `C`, or `ungraded` for `grade`. Use `kg` with an empty conversion field or `maund` with the source's recorded kg-per-maund conversion. Import in batches of up to 1,000 rows and 400 KB. Keep the source URL and report identifier, and preserve the original publication date for time-based evaluation. Mark fictional rows **Synthetic sample**. [Department of Agricultural Marketing price portal](https://market.dam.gov.bd/)

For a fictional weekly farmgate series, run `docker compose exec api python -m app.seed_market`. A host-native API can use `uv run --env-file .env python -m app.seed_market`. The sample is explicit demo data and has its own price series.

Forecast evaluation replays weekly origins using reports published by each origin. The service compares the last price, a rolling median, and a seasonal baseline where the history supports it. It displays absolute error, WAPE, empirical interval coverage, and pinball loss. The historical-change quantile candidate needs 24 comparable held-out origins, over 10% lower MAE, and 70–95% coverage to publish for a real series. Forecasts abstain with stale or insufficient evidence. These are retrospective checks. Field calibration and independent prospective evaluation remain pending.

Hold/sell comparisons use local farmgate data for the lot's district and grade, verified-buyer offer terms when supplied, and explicit user assumptions. Freight ranking displays landed cost only when the buyer enters price and freight assumptions. A recorded transporter quote is the basis for the order's freight comparison and local booking record.

The call simulator accepts spoken or typed commands in Bangla, Banglish, English or a mix, and supports optional device Bangla playback. For example, `অফার গ্রহণ ২০০ কেজি`, `200 kg offer accept koro` and `accept the 200 kg offer` all stage the same acceptance and check the stated quantity against the selected offer. Maunds use the selected lot's recorded conversion. A deterministic grammar resolves commands. Negated, ambiguous, out-of-scope requests and quantities without a unit are refused with a specific message instead of guessed. **Check command** shows what was understood before sending, and a pending change can be cancelled. See [decision-support features](docs/AI_FEATURES.md) for the grammar and measured results. A call lasts 10 minutes and a pending keypad challenge lasts up to 2 minutes. The challenge is bound to the exact action and cancellation or expiry leaves inventory unchanged. Inspection and support requests appear in the authorized operator or delegated agent's queue. The optional Twilio adapter provides a signed public keypad menu. Carrier verification and speech-to-text remain pending.

Demo accounts require `APP_ENV=development` or `test` together with `DEMO_MODE=true`. Farmers and buyers can register from the workspace and sign in with a passphrase after staff verification. Operators can review pending registrations under **Operations → Account verification**. Verified agents sign in with their passphrase and select **Signup verification**. The page uses `GET /v1/auth/verifications` to list pending registrations and `POST /v1/auth/verify` to record a decision. Staff review identity evidence independently. Operators can still provision accounts directly. Live OTP enrollment requires a provider integration. Cookie security defaults to HTTPS. Set `APP_COOKIE_SECURE=false` for a local HTTP preview only. [Account provisioning](docs/DEPLOYMENT.md#prepare-the-release)

Local photo mode requires `PHOTO_STORAGE=local` in development or test. Set `PHOTO_DIR` to override the private directory. Hosted photo storage uses `PHOTO_STORAGE=s3` and `S3_BUCKET`, with optional `S3_ENDPOINT` and `S3_REGION`. Use runtime AWS credentials or `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`. Configure a private bucket. Authorized clients retrieve sanitized JPEGs through the API. Uploads accept JPEG, PNG, and WebP with a 3 MiB and 12 megapixel limit per photo.

Storage risk is a checklist triage result. The current rules consider evidence freshness, reported moisture, odor and visible defects, curing, ventilation, measured humidity, and measured temperature. Photo rules flag evidence quality. People record and review visible defects. For photos that pass the quality checks, an experimental browser model can suggest a visible condition. The suggestion is saved, shown to reviewers as a hint, and compared with human review under **Operations → Photo model**. The pilot keeps the submitted observation and correction history. [UC Davis dry-onion handling reference](https://postharvest.ucdavis.edu/produce-facts-sheets/onions-dry)

### Checks

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cd services/api
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked pytest -q
uv run --locked python -m evals.intent_eval --check
```

For API integration tests, set both `DATABASE_URL` and `TEST_DATABASE_URL` to a disposable PostgreSQL database. Run `uv run --locked alembic upgrade head`, `uv run --locked alembic check`, and `uv run --locked pytest -q` against it. Tests create fictional records and exercise concurrent transactions.

With the seeded API and web workspace running against a disposable database, install Chromium with `pnpm --filter @peyajflow/web exec playwright-core install chromium` and run `pnpm test:e2e`. Use `E2E_WEB_ORIGIN` and `E2E_API_ORIGIN` to override the default loopback ports 3000 and 8000. Use `PLAYWRIGHT_CHANNEL=msedge` to run against installed Edge. To include the signup review test, provision an agent in the disposable database and set `E2E_AGENT_USERNAME` and `E2E_AGENT_PASSWORD` to the test account's credentials. Set `E2E_SCREENSHOT_DIR` for pilot captures and `RELEASE_SCREENSHOT_DIR` for alerts and operations captures. Run `pnpm smoke` for readiness and routing checks. Set `SMOKE_DEMO_ID=farmer` to exercise a demo session locally.
