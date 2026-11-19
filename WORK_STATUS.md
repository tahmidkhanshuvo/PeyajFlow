# PeyajFlow work status

Last updated November 19, 2026 (Asia/Dhaka).

## Bangla assistant access for farmers and buyers (November 19, 2026)

- The workspace and API allow verified farmers and buyers and all enabled demo and showcase roles to use **বাংলা সহকারী**. Command preview, call start, and call history and actions share the same rule.
- On disposable PostgreSQL, all 90 API tests passed, including both verified roles with demo and showcase disabled and the keypad confirmation flow. Alembic and Ruff passed. Prettier, ESLint, TypeScript, web unit tests, and the production build passed. Edge also verified Bangla navigation and call start for newly registered, approved farmer and buyer accounts.
- After the owner selected all demo roles, the rebuilt local API verified call start and end for the demo farmer, buyer, agent, and operator. All 90 API tests and the Edge market and voice workflow passed with the expanded demo access. Web format, lint, typecheck, unit tests, and the production build passed.
- Added a **বাংলা সহকারী** shortcut to the dashboard header so the feature is visible on phones. The running local app showed the shortcut in the initial Edge viewport at 390 px. All five Edge workflows passed, including signing in as a newly approved farmer and starting a call from the shortcut at that viewport. Web format, lint, typecheck, unit tests, and the production build passed. The local `shanto` farmer account is approved, while `farmer1` has password access and still requires farmer verification.

## Verified farmer access to Bangla assistant (November 19, 2026)

- Verified farmers can open **Bangla assistant** and use the call simulator with demo and showcase disabled. Enabled demo and showcase sessions keep access. The API checks permission on command preview, call start, and existing call routes.
- Confirmed requests use the same read-back, keypad challenge, and workspace services. The simulator explains that confirmed changes are saved to a farmer's workspace.
- On disposable PostgreSQL, 90 API tests, Alembic metadata, Ruff, and both intent evaluation gates passed. Prettier, ESLint, TypeScript, four web unit tests, the web production build, five Edge workflows, and release smoke passed. In a separate Edge run with demo and showcase disabled, a newly registered and approved farmer opened the Bangla voice route, confirmed a support request by keypad, and saw the saved request.
- The running local Docker database was observed at `0016_vision` during this review. Its `farmer1` account had the farmer role and was unverified. The tests used the current schema on disposable PostgreSQL.

## Signup and account verification (November 19, 2026)

- The Bangla and English workspaces accept farmer and buyer registrations. PostgreSQL enforces unique account IDs, NIDs and signup phone numbers. Bangla and ASCII digits are stored in the same form, and passphrases keep their exact whitespace.
- New registrations can sign in after approval. Verified staff can process pending registrations, and demo users are isolated from the real queue. Operators can approve or reject from Operations. Rejecting a signup revokes its active sessions. Existing operator-provisioned accounts keep their access and market verification behavior.
- Revision `0018_signup` follows the existing draft revision `0017_signup_nid`. Fresh migration, downgrade to `0016_vision`, re-upgrade and Alembic metadata checks passed on disposable PostgreSQL 16. Upgrade fixtures confirmed that a legacy farmer could still sign in and a draft signup stayed pending after its NID was normalized.
- Ruff lint and formatting, 89 PostgreSQL API tests, both intent evaluation gates, Prettier, ESLint, TypeScript, four web unit tests, the production build, four Edge Playwright workflows and the release smoke check passed. Signup regressions cover concurrent signup and review, duplicate errors, staff permissions, session revocation and sensitive-field exclusion.
- The agent verification review confirmed API readiness on revision `0018_signup`. Staff identity-evidence review remains manual.

### Local signup recheck

- The local Docker API was serving the `0016_vision` build, which lacked the signup and verification routes. The database backup restored successfully into disposable PostgreSQL 16, and the restored database upgraded to `0018_signup` with no metadata drift.
- Rebuilt the local API and migrated the live local database to `0018_signup`. All eight users and two password credentials were preserved. The running API exposes the signup and verification routes, the local workspace renders the signup form, and demo sign-in and session revocation passed.
- Ruff, the migration rollback and re-upgrade, 90 PostgreSQL API tests, web format, lint, typecheck, unit tests, the production build, and all five Edge workflows passed. The browser workflows used disposable accounts and covered pending sign-in, staff approval and rejection, and sign-in after approval. The pre-upgrade backup is in the Git-ignored `.tools/local-db-backups` directory.

### Agent signup verification page

- Verified, non-demo agents can open **Signup verification** in either workspace language. The decision form accepts an empty reason and returns to the localized queue after approval or rejection. Pagination stays within the API's offset limit.
- An earlier local check found `rofiq` with the required agent role and verification flags. A separate Edge run against disposable PostgreSQL confirmed that an agent could approve a farmer without a reason, reject a buyer with a reason, and see both records leave the pending queue. The approved farmer could sign in, the rejected buyer was blocked, and a demo agent could not open the page.
- Prettier, ESLint, TypeScript, four web unit tests, the production build, five Edge workflows on a fresh disposable database, and the release smoke check passed.

#### Local agent access recheck

- The local `0018_signup` database has a manually provisioned, verified `rofiq` agent. Password sign-in and review-queue access passed. Reviewer verification was also enabled for the existing `agent1` account after the owner confirmed the account. The API confirmed that `agent1` could access the queue, which contained one pending registration.
- The verification link opens password sign-in and returns a verified agent directly to the review queue. An ineligible signed-in account gets a reviewer-specific message and a sign-out control.
- Confirmed the new sign-in entry point on the running local web app. All five Edge workflows on a disposable database passed, including direct reviewer sign-in and approval and rejection in both locales. Prettier, ESLint, TypeScript, web unit tests, the production build, and release smoke also passed.
- Added **Review pending registrations** as the main dashboard action for verified agents. In Edge at a mobile viewport, `rofiq` opened the Bangla queue from the live dashboard and saw one pending registration. The dashboard link and both review actions passed the disposable Edge regression. Web format, lint, typecheck, unit tests, and the production build passed.

## Completion of existing partial features (November 18, 2026)

This round completed features that already existed but were partial. No language model and no new product area were added. Branch `Ai-Native---Mahir`.

| Feature | Before | Now | Evidence |
| --- | --- | --- | --- |
| Bangla call commands | 30 exact phrases and one regex. Anything else failed. The form's selected command was never sent. The browser held a second copy of the rules. | `app/intent.py` resolves Bangla, Banglish, English and mixed commands. It normalizes spelling and digits, extracts kg or maund, refuses negated, ambiguous and out-of-scope requests, and checks the selected command. `POST /v1/voice/resolve` replaces the browser copy. Speech uses up to three alternatives. | Main dataset (239 rows): accuracy 0.360 → 1.000, quantity 0.212 → 1.000, wrong change commands 1 → 0. Challenge set written after the grammar (58 rows): 0.603 on first run with 2 wrong change commands, then 0.931 with none. Reports in `services/api/evals/results/` |
| Spoken quantities | Checked for acceptance only | Also checked for counteroffers, stock losses, lot registration and buyer offers | `tests/test_voice_commands.py` |
| Keypad confirmation | A lost code blocked the call for up to 2 minutes. No warning before the last attempt. | Pending changes can be cancelled. The last attempt and an automatic cancellation have their own messages. | API tests; browser test cancels, re-checks and confirms |
| Voice read commands | "Prices" read an arbitrary series. Spoken advice ignored the loss model. | Asks for a series when several exist. Uses the verified-weight loss trend when evidence exists and states the basis. | `tests/test_voice_commands.py` |
| Photo model and human review | Result shown once and discarded. Model reloaded for every photo. | Scores stored (`0016_vision`) for the pinned model and rule, label derived by the API, low-quality photos refused, suggestions shown after reload and as reviewer hints, and an agreement view under Operations → Photo model | `tests/test_photo_predictions.py`; browser test with a fixed-result worker; one real-model run in Edge abstained at top score 0.451 and was stored |
| Evaluation | Forecast backtests only | Reproducible intent evaluation with accuracy, per-command and macro precision, recall and F1, confusion matrix, quantity and unit accuracy, false actions and wrong change commands. Runs in CI with thresholds. | `services/api/evals/` |
| Agent guide | Only inside the handoff | Root `AGENTS.md` and `docs/AI_FEATURES.md` | — |

Checks run on November 18, 2026 against local PostgreSQL 16 and the production web build in Edge. All passed:

- Ruff lint and format, migrations, `alembic check`, and 0016 rollback and re-upgrade.
- 87 API tests (27 before this round).
- Both intent evaluations.
- Prettier, ESLint, typecheck, 4 web unit tests and the build.
- 3 Playwright workflows and the smoke check.

Still open:

- Native Bangla speakers should review and extend the intent datasets.
- Recorded speech across dialects is untested.
- No labelled photo set exists, so photo-model accuracy is unmeasured.
- The agreement view needs at least 20 real reviewed pairs before it shows a rate.

## Current priority: 48-hour AI pilot

Target a complete, working pilot on the existing deployment. Initial model accuracy can be modest. Show uncertainty and report when evidence is insufficient.

| Workflow | Pilot acceptance criteria |
| --- | --- |
| Price forecasting | Deployed and verified with a signed-in farmer on the seeded market series for 7, 14, and 28 days. Real-market validation remains pending. |
| Photo inspection | A browser model ranks visible rot or mold, sprouting, damage, and clear or uncertain images. Suggestions appear alongside private photos for human review. |
| Storage loss and hold or sell | An experimental trend fit uses comparable verified lot weights. The holding calculator combines the loss range with price scenarios when selected and uses entered assumptions when evidence is insufficient. |
| Bangla voice | The browser microphone fills an editable Bangla transcript. The simulator responds using the existing spoken read-back where a Bangla voice is available and requires keypad confirmation for changes. |
| Calls and SMS | Hosted showcase accounts can use the browser call simulator. Alerts has a labeled simulated SMS preview. Carrier delivery remains disabled on the free deployment. |
| Release | Exercise each workflow from input to result on the hosted site and record the outcome and limitations here. |

The price pattern model uses nearest-neighbor regression on recent price changes and seasonal timing. Forecast ranges use errors from historical replays. A labeled synthetic preview exercises the model on seeded prices. On approved real series, the model must beat the baseline on comparable replay dates and meet the coverage threshold before its forecast becomes the primary outlook.

The API suite and the price model selection regression passed. The production web build and browser flow passed through CSV import, approval, forecast rendering, and accessibility checks. The seeded sample returned a price model preview at each supported horizon.

The loss model needs at least three positive, comparable lot verifications on different dates, spanning at least the requested forecast horizon and no less than 14 days. The latest verification must be within seven days. A stock addition, correction, or dispatch starts a new comparison period. Experimental estimates support scenarios and need field validation.

The Bangla assistant uses the browser's speech service and keeps the transcript editable before submission. Browser checks used a controlled recognition result and verified that an offer was reserved only after keypad confirmation. The simulated SMS preview passed. The real CLIP worker downloaded its public model files, ran against a private seeded inspection image, and returned an uncertain result for human review. The loss model tests verified that comparable weights change the holding range and a later stock movement makes the model abstain.

The AI pilot frontend is live on Vercel and Render deployed the matching API. Production checks confirmed database readiness, the storage-loss API contract, the public vision worker, and the browser microphone permission policy. A signed-in farmer received all three forecast previews, compared holding scenarios using the manual fallback for sparse weight history, retrieved a private JPEG, and received a Bangla read-back in a simulated call. Anonymous photo retrieval was denied.

Field validation remains open for market forecasts, photo suggestions, storage measurements, and real microphone input across Bangla dialects. The browser inference and controlled microphone tests ran locally.

### Spoken quantities in words (November 20, 2026)

- **What changed.** `app/intent.py` now reads quantities said in words when they come directly before kg or maund:
  - Bangla 0 to 99.
  - Hundreds, such as দুইশো, পনেরোশো and একশো পঞ্চাশ.
  - Thousands and lakhs.
  - দেড়, আড়াই, সাড়ে, সোয়া and পৌনে.
  - English, such as "two hundred and fifty".
  - Common Banglish, such as "tin mon" and "dusho kg".
- **When it still abstains.** Irregular phrases and number words that are not the quantity still abstain with `number_words`. A number word next to টাকা is a price. Digit-only input uses the unchanged code path. The quantity still passes the form check, read-back and keypad confirmation.
- **Copy.** The `voice_say_quantity` text no longer asks for digits.
- **Checks, run on a disposable PostgreSQL 16:**
  - Ruff lint and format passed.
  - `alembic check` passed.
  - The full API suite passed: 129 tests, including 39 new intent tests and one end-to-end call test in which দেড় মণ reserves 60 kg only after keypad confirmation.
  - `evals.intent_eval --check` passed on both datasets. Main set, 259 rows (20 new number-word rows): accuracy 1.000. Challenge set: accuracy 0.948, up from 0.931, with zero wrong change commands. The results are saved as `intent-number-words` and `intent-challenge-number-words`.
- **Open.**
  - Row `challenge-018` states 200 kg, but its expected label had no quantity. It was corrected in a separate commit, which leaves 4 challenge failures (`intent-challenge-label-fix`).
  - The new rows were written by the same author as the rules.
  - Spoken numbers need review by native speakers and testing on recorded speech.

### Clause-scoped negation (November 20, 2026)

- **What changed.** A negation in an earlier clause no longer blocks a plain final command in typed text, such as "no thanks, reject it". The last clause must hold the only change command, with no negation or doubt of its own. No earlier clause may hold a change command or a quantity. Unpunctuated transcripts are never split.
- **Related fixes.** নাকি ("or") now marks the user as undecided, so the resolver abstains as ambiguous. বাদ দিন and নাকচ করে দিন now mean reject, not send an offer.
- **Checks, run on a disposable PostgreSQL 16:**
  - Ruff and `alembic check` passed.
  - The full API suite passed: 145 tests.
  - Both evaluations passed their gates: main set 271 rows (12 new), and challenge set 58 rows, both 1.000, with zero wrong change commands. The results are saved as `intent-clause-negation` and `intent-challenge-clause-negation`.
- **Open.** The challenge set has now been tuned against, so it is an upper bound. The next accuracy estimate needs a new set written by someone else and run once.

## Work completed

- Reviewed the master handoff, the supplied 311 × 59 transparent logo, and the existing workspace. The workspace started with those two files and no Git history or remote.
- Initialized Git on `chore/repo-foundation`. Preserved the owner files and used the handoff's dependency order below.
- Implemented the F00 source files for a pnpm Next.js workspace, a FastAPI API, PostgreSQL and a baseline Alembic revision, local Compose, environment examples, and CI.
- Connected the localized workspace to API readiness. It reports online, unavailable, unconfigured, and migration-required conditions based on server responses. There is no seeded business data in this slice.
- Integrated the unmodified interim lockup and a mark-only favicon. See [asset provenance](docs/BRAND_ASSET_PROVENANCE.md) for source and crop details.
- Audited the public demo at desktop and mobile sizes. See [demo audit](docs/DEMO_AUDIT.md).

### Portfolio redesign and deployment

- Replaced the infrastructure landing screen with a bilingual product page. Redesigned sign-in, role navigation, dashboard summaries, and responsive forms and panels.
- Seeded four named lots, four offers, two orders, freight quotes and booking, a reviewed inspection with private photos, settlement evidence, and a linked assistance request. The seeder uses stable request IDs and the existing business services.
- Removed the account badge and call simulator link from the normal workspace navigation. Local call testing remains available by its direct development route. The AI pilot (`98110dd`) later restored the simulator for demo and showcase accounts as **Bangla assistant**. Market pages retain source and provenance for illustrative prices.
- Created [tahmidkhanshuvo/PeyajFlow](https://github.com/tahmidkhanshuvo/PeyajFlow) as a public repository and merged the [hosted release smoke checks](https://github.com/tahmidkhanshuvo/PeyajFlow/pull/1) with API, container, and web checks passing.
- Deployed the Next.js frontend to Vercel Hobby and verified that both [the Vercel deployment](https://peyajflow.vercel.app/en) and [the custom domain](https://peyajflow.tahmidkhan.com.bd/en) serve the landing page over HTTPS. The Cloudflare DNS-only CNAME points to the project-specific Vercel record, and Vercel marks the domain valid.
- Deployed the [Render Free API](https://peyajflow-api.onrender.com/health/ready) with a dedicated Supabase Free PostgreSQL database and the private `inspections` bucket. After resetting the database password, Render ran migrations, seeded the workspace, and returned HTTP 200 from readiness.
- Passed the hosted smoke on the custom domain. It checked the locale redirect, API readiness, the required workspace access code, seeded inventory, inbox, private JPEG retrieval, anonymous and cross-farmer denial, and session revocation. Browser sign-in displayed the seeded farmer dashboard with a Secure, HttpOnly, SameSite=Lax session cookie.
- Restored a logical export of the hosted application schema into disposable PostgreSQL 17. Revision `0015_settlement` and counts matched the hosted source for six accounts, four lots, two orders, one payment report, and two inspection-photo records. The disposable container removed the export on exit.
- Verified 24 API tests, four web unit tests, three end-to-end workflows, the production build, and both hosting configuration schemas. The landing page and all four populated roles passed axe and horizontal overflow checks from 360 to 1440 px. Verified the seeded private inspection image in the browser and confirmed that running the seed twice preserved the original record counts.

### Pilot milestone F01–F07

| Feature | Delivered | Evidence |
| --- | --- | --- |
| F01 | Persisted users, organizations, role memberships, delegated agents, and expiring demo sessions | API tests cover role denial, revocation, expiry, and demo rejection in production |
| F02 | Lot registration and editing, stated kg-per-maund conversion, separate reported and verified quantities, and immutable movements | PostgreSQL tests cover access, duplicate requests, and competing losses |
| F03 | Buyer demand, eligible supply, verification labels, and filters and pagination | API tests cover private field projection, unlisted lots, grade filtering, verified stock, and pagination |
| F04 | Offers and counteroffers, versioned terms and history, acceptance, order receipts, dispatch, receipt confirmation, cancellation, dispute, and automatic expiry | PostgreSQL tests cover competing acceptances, exactly-once reservation, idempotent replay, expiry release, and cross-role order views |
| F05 | Structured inspections, consent, private uploads and gallery, sanitized image bytes, and review audit | Tests cover MIME and size rejection, EXIF removal, unauthorized image access, and persisted review records |
| F06 | Photo-quality checks with abstention, manual visible observations, owner corrections, and agent/operator review | Tests verify low-quality evidence and distinct submitted, corrected, and reviewed provenance |
| F07 | Evidence-based storage-risk checklist with reason codes, stale and missing-data handling, and inspection urgency | API and rule tests cover review-driven risk, missing measurements, freshness, and threshold boundaries |

### Market and call pilot F08–F12

| Feature | Delivered | Local evidence |
| --- | --- | --- |
| F08 | Role-scoped CSV staging, row-level validation and deduplication, review and approval, source records, unit conversion, and stale/synthetic labels | PostgreSQL tests cover invalid and duplicate rows, approval visibility, access, original units, and provenance |
| F09 | 7-, 14-, and 28-day forecasts with last-value, rolling-median and seasonal baselines, gated quantiles, and publication-aware backtests | Tests verify future-publication exclusion, sparse/stale abstention, baseline fallback and chronological evaluation |
| F10 | Same-quantity sell-now and hold scenarios with price provenance, loss, transport, fees, storage, finance, and cash needs | Tests cover downside and upside math, negative proceeds, hypothetical abstention, and partial sales at a verified offer |
| F11 | Ranked supply by coverage, user-entered landed costs, location, verification and grade. Persistent transport requests, recorded quotes and booking | PostgreSQL tests cover coverage ranking, landed costs, permission checks, capacity, replay and party visibility |
| F12 | Bangla typed-command simulator with optional device playback, read-back, expiring keypad confirmation, order receipts, and an agent request queue | PostgreSQL tests cover unknown intents, wrong lot, stated kg/maund quantity, wrong digits, expiry, disconnect, replay, agent access, and the shared reservation |

### Release milestone F13–F17

| Feature | Delivered | Local evidence |
| --- | --- | --- |
| F13 | Feature-gated Twilio callback adapter for a public keypad menu, signed status updates, and retry-safe event storage | Official signature fixture and API tests for invalid signatures, provider-account mismatch, retry replay, and terminal call states |
| F14 | Transactional inbox for offer, order, and transport events, read state, and optional Twilio SMS with verified contact, consent, Dhaka quiet hours, and STOP | API tests cover role and recipient scope, duplicate events, read state, bounded retry, delivery receipts, and opt-out using a mocked sender |
| F15 | Operator queues for account, lot, and market data verification, source freshness and forecast diagnostics, dispute resolution, and filtered audit | API tests cover operator access, dispute replay and state restoration, and audit privacy |
| F16 | Responsive alerts and operations, keyboard navigation, bilingual loading and error states, offline feedback, and preserved query filters on locale switch | Browser evidence is listed under verification |
| F17 | Provisioned production accounts, rate limits, sanitized request logging, serialized migrations, Render and Vercel configuration, release smoke, CI backup drill, and deployment runbook | Production build, provider configuration schema validation, migration rollback/re-upgrade, metadata check, API integration tests, and loopback smoke |

### End-to-end acceptance follow-up

| Workflow | Delivered |
| --- | --- |
| Delivery and settlement | After delivery, the buyer reports an off-platform payment reference for the goods total. An operator checks independent evidence and verifies or rejects it. Rejected reports stay in history. Both parties see the decision and receive an alert. References are excluded from the searchable audit projection |
| Farmer and agent | A farmer grants or revokes access using a verified agent’s shared ID. The agent can register unlisted lots on behalf of the farmer, weigh and inspect assigned lots, and respond to inspection requests. Listing and offer decisions remain with the farmer |
| Assistance | Signed-in users can request operator help. A farmer can request inspection help from a lot page. The web and the Bangla call simulator use the same role-scoped queue |
| Private object storage | The production S3 adapter was verified against a local Garage bucket. The uploaded and retrieved sanitized JPEG matched its stored checksum. Anonymous and cross-account reads were denied. The hosted bucket still requires acceptance testing |

## Verification and delivery

| Check | Status |
| --- | --- |
| Local Git | Foundation committed as `bd2271e902f637efc973b03db9b1b7300540074f` on `chore/repo-foundation` |
| Pilot Git | F01–F07 committed as `a92fea9425e339c62a197a54732878fb271ce77f` on `feat/pilot-f01-f07` |
| Market and call Git | F08–F12 committed as `4a205abfc38b0a05051abadc5820bc489f894486` on `feat/market-voice-f08-f12` |
| Release Git | The redesign and F00–F17 history are published on the public GitHub `main` branch |
| Web dependencies, format, lint, typecheck, unit tests, and production build | Frozen install, format, lint, typecheck, 4 unit tests, and production build passed |
| API dependencies, lint, format, and health tests | Locked sync, Ruff lint and formatting, and 3 API tests passed |
| PostgreSQL migration and readiness | One Alembic head. Upgrade, baseline rollback, and re-upgrade passed on disposable PostgreSQL 18.6. Alembic reported no metadata drift. The running API returned HTTP 503 before migration and HTTP 200 afterward |
| Docker Compose stack | Built the API and migration containers, initialized PostgreSQL 16, and verified API readiness on a disposable Compose project |
| Responsive browser smoke | Production build passed Edge/Playwright checks at 360, 390, 768, 1280, and 1440 px. Verified Bangla default, same-origin redirect, language switching, keyboard skip, status refresh, loaded logo, and no horizontal overflow. The 360 px run also verified the migration-required state |
| Accessibility and visual review | Automated axe checks reported zero violations at 360 and 1440 px. Sampled text pairs measured at least 5.47:1. [Mobile](docs/design-reviews/foundation-360.png) and [desktop](docs/design-reviews/foundation-1440.png) screenshots |
| Pilot API and database | Ten API tests passed with PostgreSQL 18.6. Alembic upgrade, rollback to the foundation, re-upgrade, and metadata-drift checks passed through `0007_offer_terms`. Ruff lint and formatting passed |
| Pilot browser flow | Production Next.js build, lint, formatting, typecheck, and four web unit tests passed. Playwright verified the farmer, buyer, and agent workflow against the real API and PostgreSQL, with zero automated axe violations on the checked screens. [Desktop order receipt](docs/design-reviews/pilot-order-desktop.png) and [Bangla mobile risk](docs/design-reviews/pilot-risk-mobile.png) |
| F08–F12 verification | Sixteen API tests, four web unit tests, and both Playwright workflows passed. The production build and migrations through `0010_voice` passed. Rollback to `0007_offer_terms`, re-upgrade, and Alembic metadata check passed on disposable PostgreSQL 18.6. Checked browser screens reported zero automated axe violations. [Price outlook](docs/design-reviews/pilot-price-outlook.png), [mobile call receipt](docs/design-reviews/pilot-voice-mobile.png), and [transport booking](docs/design-reviews/pilot-transport-quotes.png) |
| F13–F17 API and schema | 21 API tests passed on disposable PostgreSQL 18.6. Ruff lint and format, rollback from `0014_release` to `0010_voice`, re-upgrade, and Alembic metadata check passed. Render and Vercel configurations passed checks against the published schemas |
| F13–F17 web | Four web unit tests and three Edge/Playwright workflows passed with the production build. Checked screens reported zero automated axe violations and no horizontal overflow. The pilot verified that the inspection form sends a large photo batch within the upload budget. [360 px alerts](docs/design-reviews/release-alerts-360.png), [768 px Bangla audit](docs/design-reviews/release-audit-bn-768.png), and [1440 px operations](docs/design-reviews/release-operations-1440.png) |
| F17 release smoke and restore | Demo and production-mode loopback smoke passed. Browser sign-in used an operator-provisioned passphrase and an HTTP-only secure cookie. PostgreSQL 16 `pg_dump` and `pg_restore` into a separate database preserved revision `0014_release` and the seeded account count |
| Full project acceptance | 23 API tests, four web unit tests, three Playwright workflows, and the production build passed against the final source. Tested on a fresh PostgreSQL 16 Compose stack. Rerunning the demo seed preserved exactly 108 synthetic fixture observations. Axe reported zero violations on checked screens. [Mobile receipt with settlement](docs/design-reviews/completion-settlement-360.png) |
| Full project recovery | PostgreSQL 16 restore preserved `0015_settlement` and counts of lots, ledger events, orders, alerts, and verified reports. Rollback to `0014_release`, re-upgrade, and the Alembic metadata check passed on the restored copy |
| Full project production-mode smoke | A provisioned account could sign in and out with a secure, HTTP-only cookie. Demo login was disabled. Private Garage S3 upload, checksum, authorized retrieval, metadata removal, and denied anonymous and cross-account reads passed |
| GitHub CI | The redesign passed all checks on public `main` at `ec10343`. [GitHub Actions](https://github.com/tahmidkhanshuvo/PeyajFlow/actions/runs/43375155544) |
| Free hosting | Dedicated Supabase project and private `inspections` bucket provisioned. Render Blueprint and Vercel configuration prepared. Hosted sign-in, photo acceptance, and recovery verification pending a deployed API and frontend |
| Hosting rehearsal | The Render startup command migrated and seeded a fresh PostgreSQL 16 database with private S3-compatible Garage storage. The expanded release smoke passed with a required workspace code, a seeded JPEG, anonymous and cross-farmer read denial, and revocation of both sessions |
| Custom domain | Cloudflare serves DNS for `tahmidkhan.com.bd`. On November 16 `peyajflow.tahmidkhan.com.bd` had no address or CNAME, and GitHub had no deployment record |
| Pilot and field validation | Pending pilot participants and real market and storage evidence |

## Implementation queue

| ID | Work | State |
| --- | --- | --- |
| F00 | Monorepo, local database and API, CI, responsive workspace shell | Implemented and verified with the native stack, Docker Compose, and GitHub Actions |
| Brand | Owner-logo integration, responsive usage, contrast, and design evidence | Initial integration in F00. Standalone brand review, wider UI placements, and vector asset pending |
| F01 | Users, organizations, roles, safe demo sessions and authorization | Implemented in the local pilot |
| F02 | Farmer lots, quantity units, ownership and immutable stock ledger | Implemented in the local pilot |
| F03 | Buyer demand and search of eligible supply | Implemented in the local pilot |
| F04 | Buyer offers, farmer confirmation and atomic order reservation | Implemented in the local pilot |
| F05 | Inspection uploads and manual review | Implemented in the local pilot |
| F06 | Visible-condition assessment with abstention and evidence | Browser CLIP suggestions, image-quality rules, and human review are implemented. Field accuracy is pending |
| F07 | Storage-risk rules and missing-data handling | Implemented with a rule-based checklist |
| F08 | Dated market observations, CSV import and data quality | Implemented and verified locally |
| F09 | Forecast baselines, temporal backtests and uncertainty | Implemented and verified locally. Real-series validation pending |
| F10 | Hold/sell scenario comparisons and insufficient-data state | Implemented and verified locally |
| F11 | Matching, landed cost and logistics quote workflow | Implemented and verified locally with recorded quotes |
| F12 | Bangla call simulator with microphone input and confirmation through the same order transaction | Implemented and verified locally with a controlled transcript. Real speech acceptance is pending |
| F13 | Signed telephony callbacks and keypad menu | Implemented and verified with signed fixtures. Live carrier acceptance pending |
| F14 | In-app alerts and optional SMS adapter | Implemented and verified locally. Live SMS and carrier STOP verification pending |
| F15 | Admin operations, provenance, audit and disputes | Implemented and verified locally |
| F16 | Responsive design, accessibility and localization | Implemented and verified locally with bilingual feedback, responsive workspace screens, and axe checks |
| F17 | Production hardening, rollback, observability and deployment | Production-mode loopback, hosted PostgreSQL restore, and hosted release smoke passed. Vercel, Render, Supabase, and custom-domain HTTPS are live. Independent recovery of private storage objects remains to be verified |

## Decisions and risks

- F00 uses a single Alembic baseline so readiness can detect an empty or stale schema from the start. The identity feature introduces the first business tables.
- Next.js forwards authenticated requests server-side. The browser uses an HTTP-only cookie and same-origin actions. Production uses operator-provisioned accounts and passphrases. Production OTP enrollment awaits provider integration.
- Offers do not reserve stock until the recipient confirms. Confirmed stock is reserved for up to 48 hours. The operator can view the same order history as the parties. Settlement is a manual evidence workflow and does not initiate payments or escrow.
- Private photo storage retains metadata-stripped JPEG evidence. Both the filesystem and S3-compatible adapters were exercised locally. The configured hosted bucket requires its own privacy and restore checks.
- Image checks assess photo quality. The browser vision model adds experimental suggestions to the human review workflow. Storage risk remains a checklist, and the holding calculator can use the separate verified-weight trend. Both model outputs need field calibration.
- Early screens use the supplied raster. The owner vector master and field review of Bangla wording remain pending.
- Market forecasts use approved observations and original publication dates. The supplied sample is fictional and isolated by series. Forecast metrics are retrospective and real-series field validation is pending.
- Matching uses explicit buyer assumptions and operators record quotes received from transporters. Booking is recorded in PeyajFlow. Carrier-side confirmation and tracking remain external.
- The simulator accepts typed commands or browser-transcribed Bangla speech and has optional browser-provided Bangla playback. Web and simulated confirmations share the same transaction. Verified farmers and buyers and all enabled demo and showcase roles can use the simulator.
- The carrier adapter exposes a public keypad menu. The live caller identity link, Bangla prompts and speech recognition require carrier and language validation. SMS stores generic delivery state and is disabled until provider and consent setup is complete.
- The release uses Render Free in Singapore, Supabase Free in Singapore, and Vercel Hobby. Render can sleep after inactivity, which delays the next workspace request. The Supabase S3 key serves the private bucket in the dedicated project.
- Update this file after each feature with what changed, checks that ran, remaining work, and confirmed PR or deployment evidence when available.

## Remaining delivery and field work

- Rehearse recovery of the private inspection objects in an isolated bucket alongside the matching PostgreSQL export.
- Verify Twilio carrier calls, SMS delivery and STOP against approved numbers. Confirm live voice enrollment and Bangla prompts with pilot participants before enabling private actions.
- Collect real price and storage evidence, test Bangla wording and mobile workflows in the field, and obtain the owner’s vector artwork. Live forecasting and visual-risk calibration require representative independent evidence.
- The post-pilot roadmap includes licensed payment and carrier integrations, independent transporter tracking, sensors, and offline drafts. The demonstrated pilot uses manual settlement, recorded transport quotes, a labeled call simulator, and offline status feedback.
