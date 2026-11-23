"""Allowlisted HTTP reads shared by MCP and the operator graph."""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import UUID

TOOLS = {
    "get_market_prices": "/v1/market/prices",
    "get_price_outlook": "/v1/market/forecasts",
    "list_my_lots": "/v1/lots",
    "get_lot_risk": "/v1/lots/{lot_id}/risk",
    "get_hold_or_sell": "/v1/lots/{lot_id}/recommendation",
    "list_offers": "/v1/offers",
    "list_orders": "/v1/orders",
    "market_data_health": "/v1/admin/data-quality",
    "ask_peyajflow": "/v1/knowledge/answer",
}


def read_tool(name: str, token: str, **params):
    if name not in TOOLS:
        raise ValueError("Read tool is not allowed")
    path = TOOLS[name]
    if "{lot_id}" in path:
        path = path.format(lot_id=UUID(str(params.pop("lot_id"))))
    allowed = {"series", "horizon", "limit", "offset", "question", "locale"}
    if not set(params) <= allowed:
        raise ValueError("Unexpected tool arguments")
    url = os.getenv("MCP_API_BASE_URL", "http://127.0.0.1:8000").rstrip("/") + path
    if params:
        url += "?" + urlencode({k: v for k, v in params.items() if v is not None})
    request = Request(url, headers={"Authorization": "Bearer " + token})
    try:
        with urlopen(request, timeout=15) as response:
            raw = response.read(1_000_001)
        return (
            json.loads(raw)
            if len(raw) <= 1_000_000
            else {"error": "response_too_large"}
        )
    except HTTPError as error:
        return {
            "error": "api_read_denied"
            if error.code in (401, 403, 404)
            else "api_read_failed",
            "status": error.code,
        }
    except (URLError, OSError, ValueError):
        return {"error": "service_unavailable"}
