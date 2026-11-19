"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "../../../components/workspace/form";
import { isLocale, type Locale } from "../../../lib/copy";
import { api, ApiError, json, sessionCookie } from "../../../lib/workspace-api";
import { asciiDigits } from "../../../lib/workspace-values";

function errorState(error: unknown): FormState {
  if (error instanceof ApiError) return { error: error.code };
  throw error;
}

async function saveSession(session: { token: string; expires_at: string }) {
  const jar = await cookies();
  if (jar.has(sessionCookie))
    await api("/v1/auth/session", { method: "DELETE" }).catch(() => {});
  const host = (await headers()).get("host") ?? "";
  const loopback = /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/i.test(host);
  jar.set(sessionCookie, session.token, {
    expires: new Date(session.expires_at),
    httpOnly: true,
    sameSite: "lax",
    secure: !(
      loopback &&
      process.env.APP_COOKIE_SECURE === "false" &&
      process.env.VERCEL !== "1"
    ),
    path: "/",
  });
}

export async function signIn(
  locale: Locale,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  if (!isLocale(locale)) return { error: "invalid_input" };
  try {
    const session = await api<{ token: string; expires_at: string }>(
      "/v1/auth/demo",
      json({
        identity: String(form.get("identity") ?? ""),
        access_key: String(form.get("access_key") ?? ""),
      }),
    );
    await saveSession(session);
  } catch (error) {
    return errorState(error);
  }
  redirect(`/${locale}/workspace`);
}

export async function passwordSignIn(
  locale: Locale,
  returnTo: "" | "verifications",
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  if (!isLocale(locale)) return { error: "invalid_input" };
  try {
    const session = await api<{ token: string; expires_at: string }>(
      "/v1/auth/password",
      json({
        username: String(form.get("username") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      }),
    );
    await saveSession(session);
  } catch (error) {
    return errorState(error);
  }
  redirect(
    `/${locale}/workspace${returnTo === "verifications" ? "/verifications" : ""}`,
  );
}

export async function signupAction(
  locale: Locale,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  if (!isLocale(locale)) return { error: "invalid_input" };
  try {
    await api(
      "/v1/auth/signup",
      json({
        name: String(form.get("name") ?? ""),
        district: String(form.get("district") ?? ""),
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
        phone: String(form.get("phone") ?? ""),
        nid: String(form.get("nid") ?? ""),
        role: String(form.get("role") ?? ""),
      }),
    );
  } catch (error) {
    return errorState(error);
  }
  redirect(`/${locale}/workspace?signed_up=1`);
}

export async function signOut(locale: Locale): Promise<FormState> {
  if (!isLocale(locale)) return { error: "invalid_input" };
  try {
    await api("/v1/auth/session", { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401))
      return errorState(error);
  }
  (await cookies()).delete(sessionCookie);
  redirect(`/${locale}/workspace`);
}

export async function logoutAction(locale: Locale): Promise<void> {
  await signOut(locale);
}

type Operation =
  | "profile"
  | "lot-create"
  | "lot-create-delegated"
  | "lot-edit"
  | "movement"
  | "verify"
  | "demand"
  | "demand-close"
  | "offer"
  | "offer-reply"
  | "order"
  | "inspection"
  | "review"
  | "verify-signup";

export async function mutate(
  locale: Locale,
  operation: Operation,
  id: string,
  secondary: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  if (!isLocale(locale)) return { error: "invalid_input" };
  const resource = encodeURIComponent(id);
  const sub = encodeURIComponent(secondary);
  const base = `/${locale}/workspace`;
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const decimal = (key: string) => asciiDigits(text(key));
  const fields = (...keys: string[]) =>
    Object.fromEntries(keys.map((key) => [key, text(key)]));
  const lot = `/v1/lots/${resource}`;
  const stock = `${base}/stock/${resource}`;
  const terms = () => ({
    quantity_kg: decimal("quantity_kg"),
    price_bdt_kg: decimal("price_bdt_kg"),
  });
  const units = () => ({
    quantity: decimal("quantity"),
    unit: text("unit"),
    kg_per_maund:
      text("unit") === "maund" ? decimal("kg_per_maund") || null : null,
  });
  let destination: string;
  try {
    switch (operation) {
      case "profile":
        await api(
          "/v1/me",
          json(fields("name", "district", "language"), "PATCH"),
        );
        destination = `${base}/profile`;
        break;
      case "lot-create":
      case "lot-create-delegated":
      case "lot-edit": {
        const details = {
          ...fields(
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
        if (operation !== "lot-edit") {
          const result = await api<{ id: string }>(
            operation === "lot-create"
              ? "/v1/lots"
              : `/v1/lots/delegated/${encodeURIComponent(text("farmer_id"))}`,
            json({
              ...details,
              ...units(),
              request_key: text("request_key"),
            }),
          );
          destination = `${base}/stock/${result.id}`;
        } else {
          await api(lot, json(details, "PATCH"));
          destination = stock;
        }
        break;
      }
      case "movement": {
        const event = text("event_type");
        const quantity = units();
        if (event === "LOSS_REPORTED" && !quantity.quantity.startsWith("-")) {
          quantity.quantity = `-${quantity.quantity}`;
        }
        await api(
          `${lot}/movements`,
          json({
            ...quantity,
            event_type: event,
            ...fields("reason", "request_key"),
          }),
        );
        destination = stock;
        break;
      }
      case "verify":
        await api(
          `${lot}/verification`,
          json({ verified_kg: decimal("verified_kg") }),
        );
        destination = stock;
        break;
      case "demand":
        await api(
          "/v1/buyer-requests",
          json({
            ...fields(
              "variety",
              "minimum_grade",
              "delivery_district",
              "delivery_from",
              "delivery_to",
              "transport",
            ),
            quantity_kg: decimal("quantity_kg"),
            price_ceiling_bdt_kg: decimal("price_ceiling_bdt_kg") || null,
          }),
        );
        destination = `${base}/demand`;
        break;
      case "demand-close":
        await api(`/v1/buyer-requests/${resource}/close`, { method: "POST" });
        destination = `${base}/demand`;
        break;
      case "offer":
        await api(
          "/v1/offers",
          json({
            ...terms(),
            ...fields("delivery_district", "transport", "request_key"),
            lot_id: id,
            buyer_request_id: secondary || null,
            delivery_on: secondary ? null : text("delivery_on") || null,
            valid_hours: Number(decimal("valid_hours")),
          }),
        );
        destination = `${base}/offers`;
        break;
      case "offer-reply": {
        const result = await api<{ order_id: string | null }>(
          `/v1/offers/${resource}/respond`,
          json({
            action: secondary,
            version: Number(text("version")),
            request_key: text("request_key"),
            confirm: form.has("confirm"),
            ...(secondary === "counter" ? terms() : {}),
          }),
        );
        destination = result.order_id
          ? `${base}/orders/${result.order_id}`
          : `${base}/offers`;
        break;
      }
      case "order":
        await api(
          `/v1/orders/${resource}/transition`,
          json({
            action: secondary,
            request_key: text("request_key"),
            confirm: form.has("confirm"),
          }),
        );
        destination = `${base}/orders/${resource}`;
        break;
      case "inspection": {
        const images = form
          .getAll("images")
          .filter(
            (value): value is File => value instanceof File && value.size > 0,
          );
        if (images.length < 2 || images.length > 4)
          return { error: "photos_required" };
        if (images.some((file) => file.size > 3 * 1024 * 1024))
          return { error: "image_too_large" };
        if (!form.has("consent")) return { error: "confirmation_required" };
        const payload = new FormData();
        payload.set("consent", "true");
        payload.set(
          "observations",
          JSON.stringify({
            ...fields(
              "observed_on",
              "curing",
              "ventilation",
              "moisture",
              "odor",
              "notes",
            ),
            temperature_c: decimal("temperature_c") || null,
            humidity_pct: decimal("humidity_pct") || null,
            sample_kg: decimal("sample_kg") || null,
            visible_flags: form.getAll("visible_flags"),
          }),
        );
        for (const file of images) payload.append("images", file, file.name);
        await api(`${lot}/inspections`, { method: "POST", body: payload });
        destination = `${stock}/inspections`;
        break;
      }
      case "review":
        await api(
          `${lot}/inspections/${sub}/review`,
          json({
            flags: form.getAll("visible_flags"),
            reason: text("reason"),
          }),
        );
        destination = `${stock}/inspections`;
        break;
      case "verify-signup": {
        if (!form.has("confirm")) return { error: "confirmation_required" };
        const decision = text("verified");
        if (decision !== "true" && decision !== "false")
          return { error: "invalid_input" };
        await api(
          "/v1/auth/verify",
          json({
            user_id: resource,
            action: decision === "true" ? "verify" : "reject",
            reason: text("reason"),
          }),
        );
        destination = `${base}/verifications`;
        break;
      }
      default:
        return { error: "invalid_input" };
    }
  } catch (error) {
    return errorState(error);
  }
  redirect(`${destination}?saved=1`);
}
