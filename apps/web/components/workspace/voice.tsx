import Link from "next/link";
import { pilotMutate } from "../../app/[locale]/workspace/pilot-actions";
import type { Locale } from "../../lib/copy";
import type {
  PriceSeries,
  VoiceCall,
  VoicePinStatus,
  VoiceTask,
} from "../../lib/pilot-types";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type {
  Lot,
  Offer,
  Order,
  PageResult,
  Supply,
} from "../../lib/workspace-types";
import { timeLabel } from "../../lib/workspace-values";
import { WorkspaceForm } from "./form";
import { VoiceDesk } from "./voice-desk";

export async function VoicePage({
  locale,
  base,
  actor,
  id,
}: {
  locale: Locale;
  base: string;
  actor: Profile;
  id?: string;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  if (id) {
    const [call, lots, offers, orders, supply, series] = await Promise.all([
      api<VoiceCall>(`/v1/voice/calls/${id}`),
      actor.role !== "buyer" ? api<Lot[]>("/v1/lots") : Promise.resolve([]),
      actor.role !== "agent" ? api<Offer[]>("/v1/offers") : Promise.resolve([]),
      actor.role !== "agent" ? api<Order[]>("/v1/orders") : Promise.resolve([]),
      actor.role === "buyer"
        ? api<PageResult<Supply>>("/v1/matches").then((result) => result.items)
        : Promise.resolve([]),
      api<PriceSeries[]>("/v1/market/series"),
    ]);
    return (
      <>
        <Link className="work-link" href={`${base}/voice`}>
          {t("সিমুলেটরে ফিরুন", "Back to simulator")}
        </Link>
        <h1>{t("বাংলা কল সিমুলেটর", "Bangla call simulator")}</h1>
        <VoiceDesk
          locale={locale}
          base={base}
          initial={call}
          actor={actor}
          lots={lots}
          offers={offers}
          orders={orders}
          supply={supply}
          series={series}
        />
      </>
    );
  }
  const [tasks, pin] = await Promise.all([
    api<VoiceTask[]>("/v1/voice/tasks"),
    api<VoicePinStatus>("/v1/voice/pin"),
  ]);
  return (
    <>
      <h1>{t("বাংলা কল সিমুলেটর", "Bangla call simulator")}</h1>
      <section className="work-panel">
        <span className="work-tag">{t("সিমুলেশন", "Simulation")}</span>
        <p>
          {t(
            "বাংলায় বলুন বা লিখুন, শর্ত যাচাই করুন এবং কিপ্যাডে নিশ্চিত করুন।",
            "Speak or type your request in Bangla, review the read-back and confirm with the keypad.",
          )}
        </p>
        {!actor.is_demo && (
          <p>
            {t(
              "নিশ্চিত করা পরিবর্তন আপনার ওয়ার্কস্পেসে সংরক্ষিত হবে।",
              "Confirmed changes are saved to your workspace.",
            )}
          </p>
        )}
        <WorkspaceForm
          locale={locale}
          action={pilotMutate.bind(null, locale, "start-call", "", "")}
          label={t("সিমুলেটেড কল শুরু করুন", "Start simulated call")}
        />
      </section>
      {pin.required && (
        <section className="work-panel">
          <h2>{t("ভয়েস পিন", "Voice PIN")}</h2>
          <p>
            {pin.locked_until
              ? t(
                  "অনেকবার ভুল পিন দেওয়ায় পিন সাময়িকভাবে বন্ধ। পরে আবার চেষ্টা করুন।",
                  "Your PIN is locked after too many wrong attempts. Try again later.",
                )
              : pin.set
                ? t(
                    "পিন ঠিক করা আছে। পরিবর্তন নিশ্চিত করতে এই পিন দিন। পিন কখনো দেখানো হয় না।",
                    "Your PIN is set. Enter it to confirm changes. It is never displayed.",
                  )
                : t(
                    "পরিবর্তন নিশ্চিত করতে ৪–৬ অঙ্কের একটি গোপন পিন ঠিক করুন।",
                    "Set a secret 4–6 digit PIN to confirm changes.",
                  )}
          </p>
          <WorkspaceForm
            locale={locale}
            action={pilotMutate.bind(null, locale, "voice-pin", "", "")}
            label={
              pin.set
                ? t("পিন বদলান", "Change PIN")
                : t("পিন ঠিক করুন", "Set PIN")
            }
          >
            <label>
              {t("নতুন পিন (৪–৬ অঙ্ক)", "New PIN (4–6 digits)")}
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                minLength={4}
                maxLength={6}
                required
              />
            </label>
            <label>
              {t("আপনার পাসফ্রেজ", "Your passphrase")}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
          </WorkspaceForm>
        </section>
      )}
      <section className="work-panel">
        <h2>
          {t("পরিদর্শন ও সহায়তার অনুরোধ", "Inspection and support requests")}
        </h2>
        {!tasks.length && (
          <p>{t("এখনও কোনো অনুরোধ নেই।", "No requests yet.")}</p>
        )}
        <ul className="work-history">
          {tasks.map((task) => (
            <li key={task.id}>
              <strong>
                {task.kind === "inspection"
                  ? t("পরিদর্শন", "Inspection")
                  : t("সহায়তা", "Support")}
              </strong>
              <span>
                {task.note} ·{" "}
                {task.status === "resolved"
                  ? t("সম্পন্ন", "Resolved")
                  : t("খোলা", "Open")}{" "}
                · {timeLabel(locale, task.created_at)}
              </span>
              {task.lot_id && (
                <Link
                  className="work-link"
                  href={`${base}/stock/${task.lot_id}/inspections`}
                >
                  {t("মজুতের পরিদর্শন", "Lot inspections")}
                </Link>
              )}
              {task.can_resolve && (
                <WorkspaceForm
                  locale={locale}
                  action={pilotMutate.bind(
                    null,
                    locale,
                    "resolve-task",
                    task.id,
                    "",
                  )}
                  label={t("সম্পন্ন হিসেবে চিহ্নিত করুন", "Mark resolved")}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
