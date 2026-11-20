"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "../../../components/workspace/form";
import { isLocale, type Locale } from "../../../lib/copy";
import { api, ApiError, json } from "../../../lib/workspace-api";

type Operation =
  | "read-alert"
  | "read-all"
  | "preferences"
  | "verify"
  | "resolve"
  | "report-payment"
  | "review-payment"
  | "grant-agent"
  | "revoke-agent"
  | "request-help"
  | "resolve-help";

export async function operate(
  locale: Locale,
  operation: Operation,
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  if (!isLocale(locale)) return { error: "invalid_input" };
  const resource = encodeURIComponent(id);
  const value = (name: string) => String(form.get(name) ?? "").trim();
  let destination = "alerts";
  try {
    switch (operation) {
      case "read-alert":
        await api(`/v1/notifications/${resource}/read`, { method: "POST" });
        break;
      case "read-all":
        await api("/v1/notifications/read-all", { method: "POST" });
        break;
      case "preferences":
        await api(
          "/v1/notifications/preferences",
          json(
            {
              sms_enabled: form.has("sms_enabled"),
              quiet_start: Number(value("quiet_start")),
              quiet_end: Number(value("quiet_end")),
            },
            "PUT",
          ),
        );
        break;
      case "verify": {
        if (!form.has("confirm")) return { error: "confirmation_required" };
        const decision = value("verified");
        if (decision !== "true" && decision !== "false")
          return { error: "invalid_input" };
        await api(
          `/v1/admin/verifications/${resource}`,
          json({ verified: decision === "true" }, "PUT"),
        );
        destination = "operations?view=accounts";
        break;
      }
      case "resolve":
        if (!form.has("confirm")) return { error: "confirmation_required" };
        await api(
          `/v1/admin/disputes/${resource}/resolve`,
          json({ note: value("note"), confirmed: true }),
        );
        destination = "operations?view=disputes";
        break;
      case "report-payment":
        if (!form.has("confirm")) return { error: "confirmation_required" };
        await api(
          `/v1/orders/${resource}/settlement`,
          json({
            reference: value("reference"),
            request_key: value("request_key"),
            confirm: true,
          }),
        );
        destination = `orders/${resource}`;
        break;
      case "review-payment":
        if (!form.has("confirm")) return { error: "confirmation_required" };
        await api(
          `/v1/orders/${resource}/settlement/${encodeURIComponent(value("payment_id"))}/review`,
          json({
            decision: value("decision"),
            evidence_reference: value("evidence_reference"),
            confirm: true,
          }),
        );
        destination = "operations?view=settlements";
        break;
      case "grant-agent":
      case "revoke-agent":
        if (!form.has("confirm")) return { error: "confirmation_required" };
        await api(
          `/v1/delegations/${resource || encodeURIComponent(value("agent_id"))}`,
          {
            method: operation === "grant-agent" ? "PUT" : "DELETE",
          },
        );
        destination = "agents";
        break;
      case "request-help":
        await api(
          "/v1/voice/tasks",
          json({
            kind: value("kind"),
            note: value("note"),
            lot_id: resource || null,
          }),
        );
        destination = "help";
        break;
      case "resolve-help":
        await api(`/v1/voice/tasks/${resource}/resolve`, { method: "POST" });
        destination = "help";
        break;
      default:
        return { error: "invalid_input" };
    }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: error.code };
  }
  redirect(
    `/${locale}/workspace/${destination}${destination.includes("?") ? "&" : "?"}saved=1`,
  );
}

export async function markAlertRead(
  locale: Locale,
  alertId: string,
): Promise<void> {
  if (!isLocale(locale)) return;
  try {
    await api(`/v1/notifications/${encodeURIComponent(alertId)}/read`, {
      method: "POST",
    });
    revalidatePath(`/${locale}/workspace`, "page");
  } catch {
    // Ignore error
  }
}

export async function markAllAlertsRead(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  try {
    await api("/v1/notifications/read-all", { method: "POST" });
    revalidatePath(`/${locale}/workspace`, "page");
  } catch {
    // Ignore error
  }
}
