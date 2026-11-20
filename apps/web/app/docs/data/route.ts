import { api, ApiError } from "../../../lib/workspace-api";

export async function GET(request: Request) {
  const version = new URL(request.url).searchParams.get("version");
  const query =
    version && /^\d{1,9}$/.test(version) ? `?known_version=${version}` : "";
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return Response.json(await api(`/v1/docs/public${query}`), { headers });
  } catch (failure) {
    const forbidden = failure instanceof ApiError && failure.status === 403;
    return Response.json(
      { available: false },
      { status: forbidden ? 403 : 503, headers },
    );
  }
}
