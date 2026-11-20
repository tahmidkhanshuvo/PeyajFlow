"use server";

import { redirect } from "next/navigation";
import type { FormState } from "../../../components/workspace/form";
import { isLocale, type Locale } from "../../../lib/copy";
import type {
  Advice,
  VoiceCall,
  VoiceEntry,
  VoiceResolution,
} from "../../../lib/pilot-types";
import { api, ApiError, json } from "../../../lib/workspace-api";
import type { PhotoPrediction } from "../../../lib/workspace-types";
import { asciiDigits } from "../../../lib/workspace-values";

type PilotOp =
  | "import"
  | "review"
  | "transport"
  | "quote"
  | "book"
  | "cancel"
  | "start-call"
  | "resolve-task";
type AdviceState = FormState & { result?: Advice };
type VoiceState = FormState & {
  call?: VoiceCall;
  code?: string;
  pendingId?: string;
};

const errorCode = (error: unknown) =>
  error instanceof ApiError ? error.code : "service_unavailable";
const value = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const decimal = (form: FormData, key: string) => asciiDigits(value(form, key));
const fields = (form: FormData, ...keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, value(form, key)]));

export async function pilotMutate(
  locale: Locale,
  operation: PilotOp,
  id: string,
  secondary: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  if (!isLocale(locale)) return { error: "invalid_input" };
  const base = `/${locale}/workspace`;
  const resource = encodeURIComponent(id);
  let destination: string;
  try {
    switch (operation) {
      case "import": {
        const file = form.get("csv");
        if (!(file instanceof File) || !file.size || file.size > 400_000)
          return { error: "market_csv_limit" };
        const batch = await api<{ id: string }>(
          "/v1/admin/data-imports",
          json({
            label: value(form, "label"),
            synthetic: form.has("synthetic"),
            csv: await file.text(),
          }),
        );
        destination = `${base}/imports/${batch.id}`;
        break;
      }
      case "review":
        await api(
          `/v1/admin/data-imports/${resource}/review`,
          json({ decision: secondary }),
        );
        destination = `${base}/imports/${resource}`;
        break;
      case "transport":
        await api(
          "/v1/logistics/quote-requests",
          json({
            order_id: id,
            ...fields(form, "pickup_on", "handling", "request_key"),
          }),
        );
        destination = `${base}/orders/${resource}`;
        break;
      case "quote":
        await api(
          `/v1/logistics/quote-requests/${encodeURIComponent(secondary)}/quotes`,
          json({
            ...fields(form, "provider", "source_ref", "pickup_on"),
            capacity_kg: decimal(form, "capacity_kg"),
            freight_bdt: decimal(form, "freight_bdt"),
            handling_bdt: decimal(form, "handling_bdt") || "0",
            valid_hours: Number(decimal(form, "valid_hours")),
          }),
        );
        destination = `${base}/orders/${resource}/logistics`;
        break;
      case "book":
      case "cancel": {
        if (!form.has("confirm")) return { error: "confirmation_required" };
        const request = encodeURIComponent(secondary);
        const init =
          operation === "book"
            ? json({ quote_id: value(form, "quote_id"), confirm: true })
            : { method: "POST" };
        await api(`/v1/logistics/quote-requests/${request}/${operation}`, init);
        destination = `${base}/orders/${resource}/logistics`;
        break;
      }
      case "start-call": {
        const call = await api<VoiceCall>("/v1/voice/calls", {
          method: "POST",
        });
        destination = `${base}/voice/${call.id}`;
        break;
      }
      case "resolve-task":
        await api(`/v1/voice/tasks/${resource}/resolve`, { method: "POST" });
        destination = `${base}/voice`;
        break;
      default:
        return { error: "invalid_input" };
    }
  } catch (error) {
    return { error: errorCode(error) };
  }
  redirect(destination);
}

export async function startSimulatedCall(locale: Locale): Promise<void> {
  await pilotMutate(locale, "start-call", "", "", {}, new FormData());
}

export async function resolveVoiceTask(
  locale: Locale,
  taskId: string,
): Promise<void> {
  await pilotMutate(locale, "resolve-task", taskId, "", {}, new FormData());
}

export async function runAdvice(
  lotId: string,
  previous: AdviceState,
  form: FormData,
): Promise<AdviceState> {
  try {
    const nullable = [
      "quantity_kg",
      "manual_price_bdt_kg",
      "hypothetical_low",
      "hypothetical_middle",
      "hypothetical_high",
    ];
    const assumptions = [
      "loss_pct",
      "transport_now_bdt",
      "fees_now_bdt",
      "storage_bdt",
      "finance_bdt",
      "transport_later_bdt",
      "fees_later_bdt",
      "cash_need_bdt",
    ];
    const result = await api<Advice>(
      `/v1/lots/${encodeURIComponent(lotId)}/recommendation`,
      json({
        series: value(form, "series") || null,
        offer_id: value(form, "offer_id") || null,
        horizon_days: Number(value(form, "horizon_days")),
        assumptions_reviewed: form.has("assumptions_reviewed"),
        use_loss_model: form.has("use_loss_model"),
        ...Object.fromEntries(
          nullable.map((key) => [key, decimal(form, key) || null]),
        ),
        ...Object.fromEntries(
          assumptions.map((key) => [key, decimal(form, key) || "0"]),
        ),
      }),
    );
    return { result };
  } catch (error) {
    return { ...previous, error: errorCode(error) };
  }
}

function voiceParams(form: FormData): Record<string, unknown> {
  const command = value(form, "tool");
  const lot_id = value(form, "lot_id");
  const optional = Object.fromEntries(
    Object.entries({ lot_id, series: value(form, "series") }).filter(
      ([, item]) => item,
    ),
  );
  const qty = (key: string) => decimal(form, key) || null;
  const terms = {
    quantity_kg: qty("quantity_kg"),
    price_bdt_kg: qty("price_bdt_kg"),
  };
  const unit = value(form, "unit");
  const units = {
    unit,
    quantity: qty("quantity"),
    kg_per_maund: unit === "maund" ? qty("kg_per_maund") : null,
  };
  switch (command) {
    case "accept":
    case "reject":
    case "counter": {
      const [offer_id, offeredLot, version] = value(form, "offer").split("/");
      return {
        offer_id,
        lot_id: lot_id || offeredLot,
        version: Number(version),
        ...(command === "counter" ? terms : {}),
      };
    }
    case "movement":
      return { lot_id, ...units, ...fields(form, "event_type", "reason") };
    case "register":
      return {
        ...units,
        ...fields(
          form,
          "label",
          "district",
          "variety",
          "storage_type",
          "harvest_on",
          "stored_on",
          "grade",
        ),
        listed: form.has("listed"),
      };
    case "send_offer":
      return {
        ...terms,
        ...fields(form, "lot_id", "delivery_district", "transport"),
      };
    case "transport":
      return fields(form, "order_id", "pickup_on", "handling");
    case "inspection":
    case "support":
      return { lot_id: lot_id || null, note: value(form, "note") };
    default:
      return optional;
  }
}

export async function runVoice(
  callId: string,
  previous: VoiceState,
  form: FormData,
): Promise<VoiceState> {
  const path = `/v1/voice/calls/${encodeURIComponent(callId)}`;
  const mode = value(form, "mode");
  let code = previous.code,
    pendingId = previous.pendingId;
  try {
    if (mode === "confirm") {
      const entry = await api<VoiceEntry>(
        `${path}/confirm`,
        json({
          action_id: value(form, "action_id"),
          digits: value(form, "digits"),
        }),
      );
      if (entry.state !== "pending") {
        code = undefined;
        pendingId = undefined;
      }
    } else if (mode === "cancel") {
      await api(
        `${path}/actions/${encodeURIComponent(value(form, "action_id"))}/cancel`,
        { method: "POST" },
      );
      code = undefined;
      pendingId = undefined;
    } else if (mode === "end") {
      await api(path, { method: "DELETE" });
      code = undefined;
      pendingId = undefined;
    } else {
      const turn = await api<{ entry: VoiceEntry; demo_code: string | null }>(
        `${path}/intent`,
        json({
          phrase: value(form, "phrase"),
          params: voiceParams(form),
          tool: value(form, "tool") || null,
        }),
      );
      if (turn.demo_code) {
        code = turn.demo_code;
        pendingId = turn.entry.id;
      }
    }
    return { call: await api<VoiceCall>(path), code, pendingId };
  } catch (error) {
    const call = await api<VoiceCall>(path).catch(() => previous.call);
    if (
      call &&
      !call.entries.some(
        (entry) => entry.id === pendingId && entry.state === "pending",
      )
    ) {
      code = undefined;
      pendingId = undefined;
    }
    return { call, code, pendingId, error: errorCode(error) };
  }
}

export async function resolveVoice(
  phrases: string[],
): Promise<{ results?: VoiceResolution[]; error?: string }> {
  const candidates = phrases
    .map((phrase) => phrase.trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 3);
  if (!candidates.length) return { error: "voice_repeat" };
  try {
    return {
      results: await api<VoiceResolution[]>(
        "/v1/voice/resolve",
        json({ phrases: candidates }),
      ),
    };
  } catch (error) {
    return { error: errorCode(error) };
  }
}

export async function savePhotoPrediction(
  lot: string,
  photo: string,
  body: { model: string; rule: string; scores: Record<string, number> },
): Promise<{ prediction?: PhotoPrediction; error?: string }> {
  try {
    return {
      prediction: await api<PhotoPrediction>(
        `/v1/lots/${encodeURIComponent(lot)}/inspection-photos/${encodeURIComponent(photo)}/predictions`,
        json(body),
      ),
    };
  } catch (error) {
    return { error: errorCode(error) };
  }
}
