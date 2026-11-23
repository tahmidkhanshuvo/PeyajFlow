# PeyajFlow deployment and recovery

The free portfolio deployment uses a Render Docker service, Supabase Free for PostgreSQL and private S3-compatible storage, and Vercel Hobby for the Next.js workspace. Render can cold-start after inactivity, Supabase can pause an inactive project, and Vercel Hobby is for personal non-commercial use. Use a dedicated Supabase project for the portfolio. [Render Free](https://render.com/docs/free) · [Supabase pricing](https://supabase.com/pricing) · [Vercel Hobby](https://vercel.com/docs/plans/hobby)

## Prepare the release

1. Run the web and API checks, then verify the container and restore jobs in CI against the intended commit. Record the tested image or commit and Alembic revision.
2. Create the Supabase project, disable its Data API for this application, and create a private `inspections` storage bucket. Use a session-mode pooler connection string with `sslmode=require` for `DATABASE_URL`. Add the project's server-only S3 endpoint, region and access keys to Render's secret settings. [Supabase connection strings](https://supabase.com/docs/guides/database/connecting-to-postgres) · [Supabase S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication)
3. Import `render.yaml` as a free Docker web service from the approved repository. It selects Singapore and uses external PostgreSQL. Keep `APP_ENV=production` and `DEMO_MODE=false`. For the private account chooser, set `SHOWCASE_ACCESS_KEY` to a randomly generated value of at least 20 characters. Keep carrier and SMS disabled until the provider checks below pass. [Render Blueprint specification](https://render.com/docs/blueprint-spec)
4. The Docker start command runs the serialized migration before serving requests. It also seeds the isolated portfolio accounts when the access key is configured. Check `/health/live` and `/health/ready` after the deploy. Readiness returns `migration_required` when the running API and schema are on different revisions. Back up and test changes on a restored database before applying changes to field data.
5. In Vercel, set the project root to `apps/web`, include source files outside the root so the build sees the pnpm workspace and lockfile, and use Node.js 24. Set server-side `API_INTERNAL_BASE_URL` to the deployed Render HTTPS origin, and set `SHOWCASE_REQUIRE_CODE=true` when the private account chooser is enabled. Keep the secure cookie default. Add `peyajflow.tahmidkhan.com.bd` in Vercel Domains and create the CNAME value that Vercel assigns in the existing DNS provider. The browser compresses large inspection batches to 3 MB before sending the form. [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json) · [Vercel Function limits](https://vercel.com/docs/functions/limitations) · [Vercel custom domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
6. After the first smoke and recovery checks pass, configure production deployments from protected `main`. Point Vercel previews at a staging API and keep preview writes separate from pilot data. Enable Render's CI-gated deploy trigger after verifying the required GitHub checks. [Render deploy settings](https://render.com/docs/deploys)

Provision a production account through an authorized terminal that has database access. Use an operator identity for administration and a dedicated least-privilege account for recurring smoke tests. The CLI prompts for the passphrase. Use `--prompt-verified-phone` only when the operator has independently verified a phone number, then have the account holder opt in through Alerts. OTP enrollment is pending provider integration.

```sh
/app/.venv/bin/python -m app.credentials release-operator --role admin \
  --name 'Release Operator' --district Pabna --organization PeyajFlow
/app/.venv/bin/python -m app.credentials release-operator --replace-password
```

Run the release smoke from the repository root. Supply `SMOKE_USERNAME` and `SMOKE_PASSWORD` as environment secrets for the optional signed-in checks. The smoke verifies liveness, readiness, locale redirect, response headers, sign-in, profile and inbox access, and session revocation. After deployment, sign in through the HTTPS workspace and verify one sanitized private photo upload and retrieval with consent, including a retrieval denial from a different account. Record the date, deploy IDs, and observed results.

```sh
SMOKE_API_ORIGIN=https://api.example.invalid \
SMOKE_WEB_ORIGIN=https://app.example.invalid \
SMOKE_EXPECT_PRODUCTION=1 pnpm smoke
```

For the portfolio deployment, provide `SMOKE_SHOWCASE_ACCESS_KEY` from your secret store and omit `SMOKE_USERNAME` and `SMOKE_PASSWORD`. The check expects Vercel to prompt for the code and rejects anonymous sign-in. It retrieves the seeded JPEG as the owner, checks that anonymous requests and the other farmer cannot read it, and revokes both sessions. Set `SMOKE_READY_WAIT_SECONDS=120` to allow a Render cold start.

## Check hosted environment and documentation access

The core Render configuration is `APP_ENV=production`, `DEMO_MODE=false`, a working `DATABASE_URL`, and `PHOTO_STORAGE=s3` with all five S3 settings in `render.yaml`. `SHOWCASE_ACCESS_KEY` enables the isolated account chooser when it contains at least 20 characters. Keep `TELEPHONY_PROVIDER=disabled` and `SMS_PROVIDER=disabled` for the simulator-only deployment. The Next.js server uses `API_INTERNAL_BASE_URL` and `SHOWCASE_REQUIRE_CODE` in Vercel, not Render.

The floating chatbot uses server actions for authorized workspace reads and cited public help. Extractive help and browser dictation do not require a paid model key; provider-backed generation and embeddings are optional. See [INTEGRATIONS.md](INTEGRATIONS.md) for knowledge, pgvector, Ollama and MCP setup. Deploy the matching API with migrations `0023_integrations` and `0024_digest` before using the new web screens. Backend voice-model assistance is optional. For Gemini, configure `VOICE_MODEL_FALLBACK=true`, `VOICE_MODEL_PROVIDER=gemini`, and `GEMINI_API_KEY`. `GEMINI_MODEL` can select a model supported by that account. The Meta alternative requires `VOICE_MODEL_PROVIDER=meta`, `MODEL_API_KEY`, and `META_MODEL`. Browser-independent simulator transcription additionally requires `VOICE_TRANSCRIPTION=true` and `GEMINI_API_KEY`, with `GEMINI_TRANSCRIBE_MODEL` selecting the audio model. These backend settings do not change the floating chatbot's dictation behavior.

Documentation visibility is stored in PostgreSQL, not an environment variable. A ready API returning `403 docs_unavailable` from `/v1/docs/public` is enforcing the publishing gate. Sign in with a verified, non-demo admin account at `/docs/manage` and select visibility On or adjust the schedule. The initial window is June 10–14, 2027 in Asia/Dhaka. An anonymous `401 sign_in_required` from `/v1/docs/admin` is expected. Provision an administrator with the credentials CLI above if needed. There is no `DOCS_ENABLED` or admin-password environment setting.

## Verify the carrier and SMS services

Set `PUBLIC_API_ORIGIN` to the exact public HTTPS origin Twilio uses in its callback URLs. Store `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in Render. Send signed form-encoded POSTs to the paths below. PeyajFlow verifies the signature and account and records a fingerprint to handle retries. [Twilio request validation](https://www.twilio.com/docs/usage/security)

| Feature | Configuration and acceptance |
| --- | --- |
| Carrier | Set `TELEPHONY_PROVIDER=twilio`. Point the inbound number at `/v1/webhooks/telephony/twilio` and its status callback at `/v1/webhooks/telephony/twilio/status`. The inbound response sends keypad selections to `/v1/webhooks/telephony/twilio/menu`. Optionally set `TWILIO_VOICE_GREETING_URL` to an authorized HTTPS recording. Test inbound, menu selection, no input, disconnect, and duplicate status. The default public menu is in English. Live caller identification, account linking, speech recognition, and private actions are outside this adapter. The Bangla demo simulator remains the acceptance path for voice trades. [Twilio Gather](https://www.twilio.com/docs/voice/twiml/gather) |
| SMS | Set `SMS_PROVIDER=twilio` and `TWILIO_MESSAGING_SERVICE_SID` to a service approved for the destination. Configure signed Advanced Opt-Out callbacks to `/v1/webhooks/messaging/twilio/opt-out`. Outbound sends specify `/v1/webhooks/messaging/twilio/status`. Verify consent, quiet hours in Asia/Dhaka, a delivery receipt, and STOP with an approved test number. STOP disables further queued SMS. A message already being sent cannot be recalled. [Twilio message resource](https://www.twilio.com/docs/messaging/api/message-resource) · [Twilio Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out) |

During an incident, set the affected provider flag to `disabled` and redeploy the API. The in-app inbox remains available. Use Operations to check pending sends, sends needing review, and recent carrier callbacks. Reconcile `unknown` sends with the provider before contacting a user again. A send with an uncertain outcome is excluded from automatic retries.

## Back up and restore

Keep an encrypted PostgreSQL export accessible to the recovery operator. Supabase Free requires manual database exports. Back up the private inspection objects separately and record the matching timestamps and Alembic revision. Restore tests need an isolated database and bucket with outbound integrations disabled. Use the provider's PostgreSQL client connection string via `PGDATABASE` and secure credentials, or configure the standard `PG*` variables. The commands below assume a new empty restore database and PostgreSQL client tools compatible with the server. [Supabase backups](https://supabase.com/docs/guides/platform/backups) · [PostgreSQL `pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html) · [PostgreSQL `pg_restore`](https://www.postgresql.org/docs/current/app-pgrestore.html)

```sh
pg_dump -Fc --no-owner -f peyajflow.dump
pg_restore --dbname="$RESTORE_DATABASE" --exit-on-error --single-transaction \
  --no-owner peyajflow.dump
psql "$RESTORE_DATABASE" -Atc 'SELECT version_num FROM alembic_version'
```

Verify the restored revision, representative inventory balances and order history, payment reports, inbox records, and a private photo retrieved from the matching bucket backup. Then run readiness and the smoke command against the isolated restore. Use fictitious data for rehearsals when possible. The CI container job exercises the PostgreSQL dump and restore path with disposable data.

## Monitor and roll back

- Monitor readiness, 5xx and 429 rates, provider queue counts, and the age of the last verified backup. The API includes `X-Request-ID` and logs production request method, route template, status, and duration. Record request IDs when investigating an incident.
- Before switching back to a previous web or API deployment, compare its expected API and Alembic revisions. Use the previous API image only when compatible with the current schema. For incompatible changes, pause writes and decide whether a reviewed forward migration or a coordinated database and photo restore is appropriate. Identify records accepted after the restore point and reconcile them before reopening trades.
- Re-run release smoke and verify a known order, inbox, and private photo after recovery. Record the restored revisions and any unresolved delivery or order state.

## Review settlement evidence

After receipt, the buyer can report a reference for the full goods total. A reported payment stays unverified until an operator checks independent evidence of the amount and receipt, such as an authorized statement or separately confirmed receipt. Enter an internal evidence reference under **Operations → Settlements**. Reference fields should contain opaque identifiers. Keep bank account details and statements in the authorized evidence system. A rejected report stays in history, and the buyer can submit a corrected reference. Verification records the operator’s decision and alerts both parties. Automated settlement and transfers require a separate provider integration.
