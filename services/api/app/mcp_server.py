"""PeyajFlow MCP. Per-request credentials are never shared across HTTP users."""

import argparse
import os

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.server import Context
from mcp.server.transport_security import TransportSecuritySettings

from app.integration_reads import read_tool

mcp = FastMCP(
    "peyajflow-mcp",
    host=os.getenv("MCP_HOST", "127.0.0.1"),
    port=8002,
    stateless_http=True,
    json_response=True,
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=["localhost:*", "127.0.0.1:*", "mcp:*"],
        allowed_origins=["http://localhost:*", "http://127.0.0.1:*"],
    ),
)


def token(ctx: Context) -> str:
    request = ctx.request_context.request
    if request is not None:
        value = request.headers.get("authorization", "")
        if not value.startswith("Bearer pf_"):
            raise ValueError("A scoped PeyajFlow API token is required")
        return value.removeprefix("Bearer ")
    value = os.getenv("PEYAJFLOW_API_TOKEN", "")
    if not value.startswith("pf_"):
        raise ValueError("Set PEYAJFLOW_API_TOKEN to a scoped API token")
    return value


@mcp.tool()
def get_market_prices(ctx: Context, series: str | None = None, limit: int = 30) -> dict:
    """Read approved, account-visible market observations; synthetic labels are retained."""
    return {
        "data": read_tool("get_market_prices", token(ctx), series=series, limit=limit)
    }


@mcp.tool()
def get_price_outlook(ctx: Context, series: str, horizon: int = 7) -> dict:
    """Read an outlook (7, 14 or 28 days), including abstention and uncertainty."""
    return {
        "data": read_tool(
            "get_price_outlook", token(ctx), series=series, horizon=horizon
        )
    }


@mcp.tool()
def list_my_lots(ctx: Context, offset: int = 0) -> dict:
    """Read only owned or delegated stock allowed by the API."""
    return {"data": read_tool("list_my_lots", token(ctx), offset=offset)}


@mcp.tool()
def get_lot_risk(ctx: Context, lot_id: str) -> dict:
    """Read the evidence-based risk checklist for an authorized lot."""
    return {"data": read_tool("get_lot_risk", token(ctx), lot_id=lot_id)}


@mcp.tool()
def get_hold_or_sell(ctx: Context, lot_id: str) -> dict:
    """Read default hold/sell comparison; insufficient evidence stays explicit."""
    return {"data": read_tool("get_hold_or_sell", token(ctx), lot_id=lot_id)}


@mcp.tool()
def list_offers(ctx: Context, offset: int = 0) -> dict:
    """Read scoped offers. This cannot accept, reject or counter an offer."""
    return {"data": read_tool("list_offers", token(ctx), offset=offset)}


@mcp.tool()
def list_orders(ctx: Context, offset: int = 0) -> dict:
    """Read account-scoped orders without settlement references."""
    return {"data": read_tool("list_orders", token(ctx), offset=offset)}


@mcp.tool()
def market_data_health(ctx: Context) -> dict:
    """Read operator-only market data freshness; API enforces the admin role."""
    return {"data": read_tool("market_data_health", token(ctx))}


@mcp.tool()
def ask_peyajflow(ctx: Context, question: str, locale: str = "bn") -> dict:
    """Retrieve public help with citations. It cannot stage or execute changes."""
    return {
        "data": read_tool("ask_peyajflow", token(ctx), question=question, locale=locale)
    }


@mcp.resource("peyajflow://docs/ai-features")
def ai_features() -> str:
    return "Deterministic voice commands stage changes for read-back and PIN confirmation. Photo models suggest only. Forecasts abstain on stale or insufficient evidence. No payment is moved."


@mcp.resource("peyajflow://docs/glossary")
def glossary() -> str:
    return "পেঁয়াজ = onion; মণ = maund (use the lot's agreed kg conversion); মজুত = stock; অফার = offer; যাচাই = verification."


@mcp.resource("peyajflow://series/{series}")
def series_resource(series: str, ctx: Context) -> str:
    import json

    return json.dumps(
        read_tool("get_market_prices", token(ctx), series=series),
        default=str,
        ensure_ascii=False,
    )


@mcp.prompt(name="weekly-market-brief")
def weekly_market_brief() -> str:
    return "Read market_data_health and get_market_prices. Summarize freshness, sources and synthetic labels. Read get_price_outlook only for an available series. Never invent a price or cause."


@mcp.prompt(name="lot-review")
def lot_review(lot_id: str) -> str:
    from uuid import UUID

    return f"Review authorized lot {UUID(lot_id)} with get_lot_risk and get_hold_or_sell. State missing evidence. Suggest actions for the user to review in the app; never execute changes."


class AuthenticatedHTTP:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            value = headers.get(b"authorization", b"").decode("latin1")
            # Authenticate before protocol discovery as well as tool calls.
            from urllib.error import URLError
            from urllib.request import Request, urlopen

            from starlette.concurrency import run_in_threadpool
            from starlette.responses import JSONResponse

            def valid():
                if not value.startswith("Bearer pf_"):
                    return False
                try:
                    req = Request(
                        os.getenv("MCP_API_BASE_URL", "http://127.0.0.1:8000").rstrip(
                            "/"
                        )
                        + "/v1/me",
                        headers={"Authorization": value},
                    )
                    with urlopen(req, timeout=8) as response:
                        return response.status == 200
                except (URLError, OSError):
                    return False

            if not await run_in_threadpool(valid):
                await JSONResponse(
                    {"error": "invalid_token"},
                    status_code=401,
                    headers={"WWW-Authenticate": "Bearer"},
                )(scope, receive, send)
                return
        await self.app(scope, receive, send)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--http", action="store_true")
    args = parser.parse_args()
    if args.http:
        import uvicorn

        uvicorn.run(
            AuthenticatedHTTP(mcp.streamable_http_app()),
            host=os.getenv("MCP_HOST", "127.0.0.1"),
            port=8002,
            log_level="warning",
        )
    else:
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
