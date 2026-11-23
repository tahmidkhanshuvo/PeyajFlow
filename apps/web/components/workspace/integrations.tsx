import type { Locale } from "../../lib/copy";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import { Field } from "./fields";
import { FeatureForm } from "./feature-form";

type Token = {
  id: string;
  label: string;
  scopes: string[];
  expires_at: string;
  revoked_at: string | null;
};

export async function IntegrationPanel({
  locale,
  actor,
}: {
  locale: Locale;
  actor: Profile;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const tokens = await api<Token[]>("/v1/integrations/tokens");
  const scopes = [
    ["market:read", t("বাজারদর পড়া", "Read market data")],
    ["knowledge:read", t("সহায়িকা পড়া", "Read public help")],
    ["lots:read", t("অনুমোদিত মজুত পড়া", "Read authorized stock")],
    ["trade:read", t("অফার ও অর্ডার পড়া", "Read offers and orders")],
  ];
  if (actor.role === "admin" && actor.verified)
    scopes.push(
      ["operations:read", t("অপারেশনের তথ্য পড়া", "Read operations")],
      ["automation:run", t("সীমিত স্বয়ংক্রিয় কাজ", "Run limited automation")],
      ["imports:stage", t("আমদানি খসড়া জমা", "Stage imports")],
    );
  return (
    <section className="work-panel">
      <h2>{t("ইন্টিগ্রেশন প্রবেশাধিকার", "Integration access")}</h2>
      <p>
        {t(
          "MCP ক্লায়েন্টে তথ্য পড়ার জন্য সীমিত টোকেন তৈরি করুন। টোকেন দিয়ে স্টক বা অফারের সিদ্ধান্ত বদলানো যায় না।",
          "Create scoped tokens for an MCP client. Tokens cannot change stock or offer decisions.",
        )}
      </p>
      <FeatureForm
        locale={locale}
        operation="create-token"
        label={t("টোকেন তৈরি", "Create token")}
      >
        <Field label={t("নাম", "Label")}>
          <input name="label" required maxLength={80} />
        </Field>
        <Field label={t("মেয়াদ (দিন)", "Expiry (days)")}>
          <input
            name="days"
            type="number"
            min={1}
            max={90}
            defaultValue={30}
            required
          />
        </Field>
        <fieldset>
          <legend>{t("অনুমতি", "Permissions")}</legend>
          {scopes.map(([value, label]) => (
            <label className="work-check" key={value}>
              <input
                name="scopes"
                type="checkbox"
                value={value}
                defaultChecked={
                  value === "market:read" || value === "knowledge:read"
                }
              />{" "}
              {label}
            </label>
          ))}
        </fieldset>
      </FeatureForm>
      <h3>{t("আপনার টোকেন", "Your tokens")}</h3>
      {!tokens.length && <p>{t("কোনো টোকেন নেই।", "No tokens yet.")}</p>}
      {tokens.map((row) => (
        <article key={row.id} className="integration-token">
          <strong>{row.label}</strong>
          <p>{row.scopes.join(", ")}</p>
          <p>
            {t("মেয়াদ", "Expires")}: {row.expires_at.slice(0, 10)}
          </p>
          {row.revoked_at ? (
            <p>{t("বাতিল", "Revoked")}</p>
          ) : (
            <FeatureForm
              locale={locale}
              operation="revoke-token"
              label={t("টোকেন বাতিল", "Revoke token")}
            >
              <input name="id" type="hidden" value={row.id} />
            </FeatureForm>
          )}
        </article>
      ))}
      <details>
        <summary>{t("MCP সংযোগ", "MCP connection")}</summary>
        <p>
          {t(
            "নয়টি শুধুমাত্র-পাঠ টুল, দুটি স্থির রিসোর্স, একটি বাজারদর রিসোর্স টেমপ্লেট ও দুটি প্রম্পট।",
            "Nine read tools, two static resources, one market-series resource template and two prompts.",
          )}
        </p>
        <p>
          {t("স্থানীয় HTTP ঠিকানা", "Local HTTP endpoint")}:{" "}
          <code>http://127.0.0.1:8002/mcp</code>
        </p>
        <p>
          {t(
            "প্রতিটি অনুরোধে Bearer টোকেন লাগে।",
            "Every request requires a Bearer token.",
          )}
        </p>
      </details>
    </section>
  );
}
