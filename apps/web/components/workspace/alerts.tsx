import Link from "next/link";
import { operate } from "../../app/[locale]/workspace/operations-actions";
import type { Locale } from "../../lib/copy";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import { numberLabel, timeLabel } from "../../lib/workspace-values";
import { Details, Field } from "./fields";
import { WorkspaceForm } from "./form";
import { SmsDemo } from "./sms-demo";

type Inbox = {
  items: {
    id: string;
    kind: string;
    resource_type: string;
    resource_id: string;
    created_at: string;
    read_at: string | null;
  }[];
  unread: number;
  next_offset: number | null;
};
type Preferences = {
  sms_enabled: boolean;
  quiet_start: number;
  quiet_end: number;
  verified_phone: boolean;
  sms_provider_ready: boolean;
};
const titles: Record<string, [string, string]> = {
  "offer.sent": ["নতুন অফার এসেছে", "New offer received"],
  "offer.countered": ["পাল্টা অফার এসেছে", "Counteroffer received"],
  "offer.rejected": ["অফার প্রত্যাখ্যাত", "Offer declined"],
  "offer.withdrawn": ["অফার প্রত্যাহার করা হয়েছে", "Offer withdrawn"],
  "order.confirmed": ["অর্ডার নিশ্চিত হয়েছে", "Order confirmed"],
  "order.dispatched": ["অর্ডার পাঠানো হয়েছে", "Order dispatched"],
  "order.delivered": ["অর্ডার গ্রহণ করা হয়েছে", "Order received"],
  "order.cancelled": ["অর্ডার বাতিল হয়েছে", "Order cancelled"],
  "order.expired": ["সংরক্ষণের মেয়াদ শেষ", "Reservation expired"],
  "order.disputed": ["অর্ডারে বিরোধ জানানো হয়েছে", "Order disputed"],
  "order.dispute_resolved": [
    "অর্ডারের বিরোধ নিষ্পত্তি হয়েছে",
    "Order dispute resolved",
  ],
  "payment.reported": ["অর্থপ্রদানের তথ্য জমা হয়েছে", "Payment reported"],
  "payment.verified": ["অর্থপ্রদান যাচাই হয়েছে", "Payment verified"],
  "payment.rejected": [
    "অর্থপ্রদানের তথ্য প্রত্যাখ্যাত হয়েছে",
    "Payment report rejected",
  ],
  "logistics.requested": [
    "পরিবহনের দর চাওয়া হয়েছে",
    "Transport quotes requested",
  ],
  "logistics.quote_recorded": ["পরিবহনের নতুন দর", "New transport quote"],
  "logistics.booked": [
    "পরিবহনের দর বেছে নেওয়া হয়েছে",
    "Transport quote booked",
  ],
  "logistics.cancelled": ["পরিবহন অনুরোধ বাতিল", "Transport request cancelled"],
};

export async function AlertsPage({
  locale,
  base,
  offset,
  actor,
}: {
  locale: Locale;
  base: string;
  offset: number;
  actor: Profile;
}) {
  const [data, settings] = await Promise.all([
    api<Inbox>(`/v1/notifications?offset=${offset}`),
    api<Preferences>("/v1/notifications/preferences"),
  ]);
  const t = (bn: string, en: string) => local(locale, bn, en);
  return (
    <>
      <section className="work-panel">
        <div className="work-row">
          <h2>{t("প্রাপ্ত বিজ্ঞপ্তি", "Inbox")}</h2>
          <span className="work-tag">
            {numberLabel(locale, data.unread)} {t("অপঠিত", "unread")}
          </span>
          {data.unread > 0 && (
            <WorkspaceForm
              locale={locale}
              action={operate.bind(null, locale, "read-all", "")}
              label={t("সব পঠিত করুন", "Mark all read")}
            />
          )}
        </div>
        {!data.items.length && (
          <p>{t("এই পৃষ্ঠায় কোনো বিজ্ঞপ্তি নেই।", "No alerts on this page.")}</p>
        )}
        <ul className="work-history">
          {data.items.map((item) => {
            const href =
              item.resource_type === "offer"
                ? `${base}/offers/${item.resource_id}`
                : `${base}/orders/${item.resource_id}${item.resource_type === "logistics" ? "/logistics" : ""}`;
            return (
              <li key={item.id}>
                <div className="work-row">
                  <Link className="work-link" href={href}>
                    {t(...(titles[item.kind] ?? [item.kind, item.kind]))}
                  </Link>
                  <span className="work-tag">
                    {item.read_at ? t("পঠিত", "Read") : t("অপঠিত", "Unread")}
                  </span>
                </div>
                <time dateTime={item.created_at}>
                  {timeLabel(locale, item.created_at)}
                </time>
                {!item.read_at && (
                  <WorkspaceForm
                    locale={locale}
                    action={operate.bind(null, locale, "read-alert", item.id)}
                    label={t("পঠিত করুন", "Mark read")}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <div className="work-row">
          {offset > 0 && (
            <Link
              className="work-link"
              href={`${base}/alerts?offset=${Math.max(0, offset - 50)}`}
            >
              {t("আগের পৃষ্ঠা", "Previous page")}
            </Link>
          )}
          {data.next_offset !== null && (
            <Link
              className="work-link"
              href={`${base}/alerts?offset=${data.next_offset}`}
            >
              {t("পরের পৃষ্ঠা", "Next page")}
            </Link>
          )}
        </div>
      </section>
      <section className="work-panel">
        <Details label={t("এসএমএসের পছন্দ", "SMS preferences")}>
          {actor.is_demo && !settings.sms_provider_ready && (
            <SmsDemo locale={locale} />
          )}
          <p>
            {settings.verified_phone
              ? settings.sms_provider_ready
                ? t("এসএমএস সেবা চালু আছে।", "The SMS provider is available.")
                : t("এসএমএস সেবা এখন বন্ধ।", "The SMS provider is disabled.")
              : t(
                  "এসএমএসের জন্য অপারেটরের যাচাই করা ফোন নম্বর দরকার।",
                  "SMS requires an operator-verified phone.",
                )}
          </p>
          <WorkspaceForm
            locale={locale}
            action={operate.bind(null, locale, "preferences", "")}
            label={t("পছন্দ সংরক্ষণ করুন", "Save preferences")}
          >
            <label className="checkbox">
              <input
                type="checkbox"
                name="sms_enabled"
                defaultChecked={settings.sms_enabled}
                disabled={!settings.verified_phone}
              />
              {t("এসএমএস পেতে সম্মতি দিচ্ছি", "I opt in to SMS alerts")}
            </label>
            <div className="work-grid">
              <Field
                label={t(
                  "নীরব সময় শুরু (ঢাকা, ০–২৩)",
                  "Quiet hours start (Dhaka, 0–23)",
                )}
              >
                <input
                  name="quiet_start"
                  type="number"
                  min="0"
                  max="23"
                  defaultValue={settings.quiet_start}
                  required
                />
              </Field>
              <Field
                label={t(
                  "নীরব সময় শেষ (ঢাকা, ০–২৩)",
                  "Quiet hours end (Dhaka, 0–23)",
                )}
              >
                <input
                  name="quiet_end"
                  type="number"
                  min="0"
                  max="23"
                  defaultValue={settings.quiet_end}
                  required
                />
              </Field>
            </div>
            <p>
              {t(
                "সমান সময় দিলে নীরব সময় বন্ধ থাকে।",
                "Set the same start and end hour to disable quiet hours.",
              )}
            </p>
          </WorkspaceForm>
        </Details>
      </section>
    </>
  );
}
