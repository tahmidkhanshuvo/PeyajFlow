# PeyajFlow MCP

The implementation shares the API's locked Python environment and HTTP-only read adapter. It does not import business services or query PostgreSQL.

Create a scoped token in **Profile → Integration access**. Set `PEYAJFLOW_API_TOKEN` in the desktop client's secret environment and `MCP_API_BASE_URL` to the API origin. From `services/api`, run `uv run --locked python -m app.mcp_server` for stdio. Do not put tokens in committed configuration.

For Streamable HTTP run the Compose `integrations` profile. Connect to `http://127.0.0.1:8002/mcp` with `Authorization: Bearer <scoped token>`. All protocol requests require API authentication; tool requests also enforce exact endpoint scopes, current role, delegation and demo isolation. Each HTTP client's bearer is forwarded independently; the server never uses a shared HTTP identity. Use a TLS reverse proxy and explicit host/origin allowlists before exposing this service remotely.

Inventory: nine read tools, two static resources and one series resource template, two prompts. No write tools. The operator graph uses the same HTTP read adapter.
