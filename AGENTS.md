# AGENTS.md: working on PeyajFlow

Instructions for coding agents (Codex, Claude Code and others) and for people reviewing their work. Read this file, the README and `WORK_STATUS.md` before changing code. The original planning pack is `PeyajFlow_Codex_Master_Handoff.md`. Where it disagrees with this file or the code, the code and this file are current.

## Product in one paragraph

PeyajFlow is a Bangla-first onion supply-chain workspace for the Pabna-to-Dhaka trade. Farmers record lots, inspections and losses. Buyers post demand and make offers. Field agents act for farmers who grant them access. Operators verify accounts, approve market data, resolve disputes and review settlements. A Bangla call simulator lets demo and showcase accounts read data and stage changes by voice or text, and every change needs a spoken read-back and a keypad code.

## Repository map

| Path | What it holds |
| --- | --- |
| `apps/web` | Next.js 16 App Router workspace (React 19, Tailwind 4). Server components and server actions call the API with the session cookie. The browser never calls the API directly. |
| `apps/web/app/[locale]/workspace` | Workspace routes and the server actions (`actions.ts`, `pilot-actions.ts`, `operations-actions.ts`) |
| `apps/web/components/workspace` | One file per area: stock, trade, inspection, voice desk, operations and others |
| `apps/web/lib` | API client (`workspace-api.ts`), bilingual copy and error text (`workspace-copy.ts`), types |
| `apps/web/public/condition-model.js` | Browser CLIP worker. It must stay in step with `PHOTO_MODEL` and `PHOTO_RULE` in `services/api/app/inspection.py` |
| `apps/web/tests` | Node unit tests and Playwright end-to-end tests (`tests/e2e`) |
| `services/api/app` | FastAPI application. One module per domain: `lots`, `trade`, `inspection`, `forecast`, `advice`, `voice`, `intent`, `admin` and others |
| `services/api/migrations` | Alembic revisions. Exactly one head is required at startup. |
| `services/api/tests` | pytest suites. Most need a disposable PostgreSQL database. |
| `services/api/evals` | Offline evaluations: datasets in `data/`, results in `results/` |
| `docs` | Deployment runbook, AI feature notes, design review screenshots |
| `scripts/release-smoke.mjs` | Readiness, routing and session smoke test |

## Commands

Tooling: Node.js 22 or later (CI uses 24), pnpm 10.34.9, Python 3.13, uv 0.13.7 and Docker with Compose.

```sh
# Local stack
docker compose up --build -d          # PostgreSQL 16 and the API on 127.0.0.1:8000
pnpm install --frozen-lockfile
pnpm dev                              # web on http://localhost:3000

# Web checks (repository root)
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build

# API checks (services/api), with a disposable database
export DATABASE_URL=postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/peyajflow_test
export TEST_DATABASE_URL="$DATABASE_URL"   # set after DATABASE_URL, not on the same line
uv run --locked ruff check . && uv run --locked ruff format --check .
uv run --locked python -m app.migrate && uv run --locked alembic check
uv run --locked pytest -q
uv run --locked python -m evals.intent_eval --check
uv run --locked python -m evals.intent_eval --check --min-accuracy 0.9 \
  --dataset evals/data/intent-challenge.jsonl
```

End-to-end tests need the migrated and seeded API, the production web build and Chromium (`pnpm --filter @peyajflow/web exec playwright-core install chromium`). Use `PLAYWRIGHT_CHANNEL=msedge` for an installed Edge. Use `E2E_WEB_ORIGIN` and `E2E_API_ORIGIN` when ports 3000 and 8000 are taken. Then run `pnpm test:e2e` and `SMOKE_DEMO_ID=farmer pnpm smoke`. Demo accounts require `APP_ENV=development` or `test` with `DEMO_MODE=true`.

## Conventions

- Formatting is enforced: Prettier for the web, Ruff (lint and format, Python 3.12 target) for the API. Indentation is two spaces, or four in Python. Files end with LF.
- The API uses SQLAlchemy Core tables declared next to their routers. Request bodies subclass `app.auth.Input` (extra fields forbidden, strings stripped). Errors are `HTTPException` with a short snake_case `detail` code. Every code shown to users needs Bangla and English text in `apps/web/lib/workspace-copy.ts`.
- Every user-facing string in the web app goes through `local(locale, bn, en)`. Write Bangla first.
- Schema changes need an Alembic revision named `NNNN_<feature>_<summary>.py` with revision id `NNNN_<feature>`, generated with `alembic revision --autogenerate --rev-id ...` and reviewed by hand. Check both upgrade and downgrade, and keep `alembic check` clean.
- Authorization lives in the API (`require_role`, scoped queries such as `lots.get_lot`). Never rely on the web app to hide something.
- Mutations are idempotent where clients retry (`request_key`), audited with `app.auth.audit`, and rate-limited where they are open to abuse (`app.rate_limits.enforce`).
- Prefer extending an existing module over adding a parallel one. Do not add dependencies without a concrete need.

## AI and decision rules

These rules describe the current system. Keep them true.

1. **The backend is the security boundary.** Nothing produced by a model or a language parser may run SQL or change data directly. Voice and web use the same services and transactions.
2. **Voice commands are resolved deterministically** by `services/api/app/intent.py`. There is no language model in the request path. A resolved change command only stages an action. The user then hears or reads the terms and confirms with a keypad code. A negation never becomes the opposite command. Uncertain input abstains with a specific error.
3. **The photo model only suggests.** CLIP runs in the user's browser. The API stores its scores only for the pinned model revision and rule, derives the label itself, refuses photos that failed quality checks, and never pre-fills a reviewer's flags. Agreement with human review is reported from real pairs only, with a minimum sample.
4. **Forecasts and advice abstain** when evidence is stale or insufficient. A candidate model replaces the baselines only after it beats them on held-out replays and meets the coverage gate.
5. **Label synthetic and demo data** wherever it appears. Never present simulated output as field-validated accuracy.
6. **Never invent evaluation results.** Report what a script measured, with its dataset, commit and date. If an author wrote both a rule set and its test data, say so and keep a separately written challenge set.

When you change the resolver, update `evals/data` only to add cases. Never edit expected labels to match new behaviour without stating why in the commit. Run both evaluations, save results with `--label`, and keep CI thresholds honest. See [docs/AI_FEATURES.md](docs/AI_FEATURES.md).

## Security and privacy

- Never commit `.env` files, credentials or real personal data. Use the `.env.example` files.
- Inspection photos are private. They are re-encoded without metadata and served only to authorized accounts with `Cache-Control: private, no-store`.
- Settlement references are opaque identifiers. PeyajFlow records evidence and never moves funds.
- Telephony and SMS stay disabled until provider, consent and opt-out checks pass (see `docs/DEPLOYMENT.md`).

## Git, CI and delivery

- Work on a feature branch and keep `main` releasable. Commit subjects are short imperative sentences, such as "Add a reproducible Bangla command evaluation". The body explains what changed, why, and the evidence.
- CI (`.github/workflows/ci.yml`) runs three jobs: the web job (format, lint, typecheck, unit tests, build, Playwright and smoke against PostgreSQL), the API job (Ruff, migrations, `alembic check`, pytest and the intent evaluations), and the container job (Compose build plus a backup and restore drill). Keep all of them green.
- Push and open pull requests only when the owner asks. Do not change hosting, DNS or provider settings without authorization.
- After each feature, update `WORK_STATUS.md` with what changed, the checks that ran and their results, and what remains open.
