"use server";

import { api, ApiError, json } from "../../../lib/workspace-api";

export type SimMessage = {
  id: string;
  direction: "in" | "out";
  body: string;
  created_at: string;
};
export type SimReply = {
  text: string;
  awaiting: "pin" | "code" | null;
  demo_code: string | null;
  end: boolean;
};
type Result<T> = { data?: T; error?: string };

async function attempt<T>(request: () => Promise<T>): Promise<Result<T>> {
  try {
    return { data: await request() };
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.code : "service_unavailable",
    };
  }
}

const thread = (response: { messages: SimMessage[] }) => response.messages;

export async function simInbox(): Promise<Result<SimMessage[]>> {
  return attempt(async () =>
    thread(await api<{ messages: SimMessage[] }>("/v1/simulator/sms")),
  );
}

export async function simSendSms(body: string): Promise<Result<SimMessage[]>> {
  const text = body.trim().slice(0, 300);
  if (!text) return { error: "voice_repeat" };
  return attempt(async () =>
    thread(
      await api<{ messages: SimMessage[] }>(
        "/v1/simulator/sms",
        json({ body: text }),
      ),
    ),
  );
}

export async function simPriceAlert(): Promise<Result<SimMessage[]>> {
  return attempt(async () =>
    thread(
      await api<{ messages: SimMessage[] }>("/v1/simulator/price-alert", {
        method: "POST",
      }),
    ),
  );
}

export async function simTestOffer(): Promise<Result<SimMessage[]>> {
  return attempt(async () =>
    thread(
      await api<{ messages: SimMessage[] }>("/v1/simulator/test-offer", {
        method: "POST",
      }),
    ),
  );
}

export async function simUssd(text: string): Promise<Result<SimReply>> {
  return attempt(() =>
    api<SimReply>("/v1/simulator/ussd", json({ text: text.slice(0, 120) })),
  );
}

export async function simCallStart(): Promise<Result<SimReply>> {
  return attempt(() =>
    api<SimReply>("/v1/simulator/call/start", { method: "POST" }),
  );
}

export async function simWorkspaceCallStart(): Promise<Result<{ id: string }>> {
  return attempt(() =>
    api<{ id: string }>("/v1/voice/calls", { method: "POST" }),
  );
}

export async function simCallTurn(body: string): Promise<Result<SimReply>> {
  const text = body.trim().slice(0, 300);
  if (!text) return { error: "voice_repeat" };
  return attempt(() =>
    api<SimReply>("/v1/simulator/call/turn", json({ body: text })),
  );
}

export async function simTranscribe(
  audio: string,
  mime: string,
): Promise<Result<string>> {
  if (audio.length > 1_400_000) return { error: "voice_too_long" };
  return attempt(async () => {
    const result = await api<{ text: string }>(
      "/v1/simulator/transcribe",
      json({ audio, mime, consent: true }),
    );
    return result.text;
  });
}
