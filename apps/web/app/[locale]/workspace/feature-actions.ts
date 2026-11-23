"use server";

import { revalidatePath } from "next/cache";
import type { Locale } from "../../../lib/copy";
import { api, ApiError, json } from "../../../lib/workspace-api";
import { errorText } from "../../../lib/workspace-copy";

export type FeatureResult = { data?: unknown; error?: string };

export async function featureAction(
  locale: Locale,
  operation: string,
  form: FormData,
): Promise<FeatureResult> {
  const text = (key: string) => String(form.get(key) ?? "");
  try {
    let data: unknown;
    switch (operation) {
      case "chat":
        data = await api(
          `/v1/assistant/chat?${new URLSearchParams({ question: text("question"), locale })}`,
        );
        break;
      case "local-preview":
        data = await api("/v1/integrations/local-preview", {
          ...json({ phrase: text("phrase"), model: text("model") || null }),
          signal: AbortSignal.timeout(90_000),
        });
        break;
      case "ask":
        data = await api(
          `/v1/knowledge/answer?${new URLSearchParams({ question: text("question"), locale })}`,
        );
        break;
      case "create-token":
        data = await api(
          "/v1/integrations/tokens",
          json({
            label: text("label"),
            days: Number(text("days")),
            scopes: form.getAll("scopes").map(String),
          }),
        );
        break;
      case "revoke-token":
        data = await api(
          `/v1/integrations/tokens/${encodeURIComponent(text("id"))}`,
          { method: "DELETE" },
        );
        break;
      case "subscribe":
        data = await api(
          "/v1/automation/subscription",
          json(
            {
              enabled: form.get("enabled") === "on",
              series: text("series") || null,
            },
            "PUT",
          ),
        );
        break;
      case "job": {
        const job = text("job");
        if (!["weekly-prices", "freshness", "alert-routing"].includes(job))
          throw new ApiError(422, "invalid_input");
        data = await api(
          `/v1/automation/jobs/${job}`,
          json({ request_key: text("request_key") }),
        );
        break;
      }
      case "investigate":
        data = await api("/v1/operator-assistant/runs", {
          ...json({
            question: text("question"),
            series: text("series") || null,
          }),
          signal: AbortSignal.timeout(
            process.env.VERCEL === "1" ? 45_000 : 75_000,
          ),
        });
        break;
      case "review":
        data = await api(
          `/v1/operator-assistant/runs/${encodeURIComponent(text("id"))}/review`,
          json({ decision: text("decision") }),
        );
        break;
      default:
        throw new ApiError(422, "invalid_input");
    }
    revalidatePath(`/${locale}/workspace`, "layout");
    return { data: data ?? { saved: true } };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: errorText(locale, error.code) };
  }
}
