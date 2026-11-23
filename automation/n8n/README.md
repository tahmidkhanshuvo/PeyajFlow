# PeyajFlow recurring operations

Start `docker compose --profile automation up -d n8n`. Open localhost port 5678 and complete n8n owner setup. Import the four JSON workflows. They are inactive until an operator enables them.

Create an expiring API token from a dedicated, verified operator account in **Profile → Integration access**, with `automation:run` for the three scheduled jobs. Configure an **HTTP Header Auth** credential named **PeyajFlow automation token**, header `Authorization`, value `Bearer <token>`, then select it in each HTTP node. Exported files contain credential references only, never secret values.

- Weekly prices runs Fridays at 09:00 Asia/Dhaka. It includes only digest subscribers in the service account's cohort. Real SMS still uses existing phone verification, consent, quiet-hour, STOP and provider checks. The simulator and in-app inbox work without a carrier.
- Freshness runs daily at 08:00 and routes stale-source attention to verified operators in the same cohort.
- Alert routing checks every 15 minutes for disputes, rejected settlements and delivery failures. No settlement reference leaves the API. The default destination is the existing operator inbox. An external email/Telegram destination is not configured or sent automatically.
- Import intake accepts a JSON report through a header-authenticated webhook. Use a separate `imports:stage` token and a separate intake webhook secret. A trusted folder/mail watcher can forward `{request_key, label, synthetic, csv}`. The API stages rows for human approval and never fetches an arbitrary URL or approves imports.

The scheduled request keys are stable within each schedule period, so n8n retries replay the same receipt. Import request keys must remain stable across retries. The API rejects reuse with changed contents. Expired or revoked credentials fail closed. The API denies all other write routes, including import approval, offers and stock.

All API URLs default to the Compose service `http://api:8000`. Change the URL when connecting n8n to a host-native API. Do not publish the n8n editor or its webhooks without the deployment authentication and TLS configuration.

For a local watched folder, set `N8N_IMPORT_WEBHOOK_URL` to the published import webhook and `N8N_INTAKE_SECRET` to its separate incoming secret. From `services/api`, run `uv run --locked python -m app.report_intake --folder <folder> --receipt <private-state-file>`. Add `--once` for a single scan or `--real` for real source reports. The default marks files synthetic. The watcher never deletes source files; it stores content receipts separately and retries the same request key after a lost response. Keep source files and receipts outside Git.
