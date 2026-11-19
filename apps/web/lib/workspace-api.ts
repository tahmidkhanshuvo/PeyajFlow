import { cookies } from "next/headers";

export const sessionCookie = "peyajflow_session";
export type Role = "farmer" | "buyer" | "agent" | "admin";
export type Profile = {
  membership_id: string;
  name: string;
  organization: string;
  district: string;
  language: "bn" | "en";
  role: Role;
  verified: boolean;
  is_demo: boolean;
};
export type DemoIdentity = { identity: string; name: string; role: Role };

export function canUseVoice(actor: Profile) {
  return (
    actor.is_demo ||
    (actor.verified && (actor.role === "farmer" || actor.role === "buyer"))
  );
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function apiResponse(path: string, init: RequestInit = {}) {
  const origin = process.env.API_INTERNAL_BASE_URL ?? "http://127.0.0.1:8000";
  const token = (await cookies()).get(sessionCookie)?.value;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(new URL(path, origin), {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(process.env.VERCEL === "1" ? 48_000 : 12_000),
    });
  } catch {
    throw new ApiError(503, "service_unavailable");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      typeof body.detail === "string" ? body.detail : "invalid_input",
    );
  }
  return response;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiResponse(path, init);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function json(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  };
}
