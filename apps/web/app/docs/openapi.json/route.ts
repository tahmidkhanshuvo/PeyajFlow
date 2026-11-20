import { apiResponse, ApiError } from "../../../lib/workspace-api";

export async function GET() {
  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json",
    "Content-Disposition": 'attachment; filename="peyajflow-openapi.json"',
  };
  try {
    const contract = await apiResponse("/v1/docs/public/openapi");
    return new Response(contract.body, { headers });
  } catch (failure) {
    const forbidden = failure instanceof ApiError && failure.status === 403;
    return Response.json(
      { detail: "docs_unavailable" },
      {
        status: forbidden ? 403 : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
