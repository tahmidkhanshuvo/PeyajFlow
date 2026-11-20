import type { Locale } from "../../lib/copy";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type { SimMessage } from "../../app/[locale]/workspace/simulator-actions";
import { BasicPhone } from "./basic-phone";

export async function SimulatorPage({
  locale,
  base,
  actor,
}: {
  locale: Locale;
  base: string;
  actor: Profile;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const [inbox, transcription] = await Promise.all([
    api<{ messages: SimMessage[] }>("/v1/simulator/sms"),
    api<{ available: boolean }>("/v1/simulator/transcribe"),
  ]);
  return (
    <>
      <h1>{t("ফোন সিমুলেটর", "Phone simulator")}</h1>
      <section className="work-panel">
        <span className="work-tag">{t("সিমুলেশন", "Simulation")}</span>
        <p>
          {t(
            "কোনো আসল ফোন, এসএমএস বা কল ব্যবহার হয় না। বাঁয়ে সাধারণ ফোন: এসএমএস, *৭৩৯২# মেনু ও ৭৩৯২ নম্বরে কল। ডানে স্মার্টফোনে আপনার ওয়ার্কস্পেস। দুটিই একই আসল তথ্যে চলে, আর প্রতিটি পরিবর্তন পিন বা কোড দিয়ে নিশ্চিত করতে হয়।",
            "No real phone, SMS or call is used. Left: a basic phone with SMS, the *7392# menu and calls to 7392. Right: your workspace on a smartphone. Both use the same real data, and every change needs your PIN or the code.",
          )}
        </p>
        {!actor.is_demo && (
          <p>
            {t(
              "নিশ্চিত করা পরিবর্তন আপনার আসল অ্যাকাউন্টে সংরক্ষিত হবে। পেঁয়াজফ্লো কখনো টাকা পাঠায় না।",
              "Confirmed changes are saved to your real account. PeyajFlow never moves money.",
            )}
          </p>
        )}
      </section>
      <div className="sim-stage">
        <figure className="sim-figure">
          <figcaption>{t("সাধারণ ফোন", "Basic phone")}</figcaption>
          <BasicPhone
            locale={locale}
            initial={inbox.messages}
            canTestOffer={actor.is_demo && actor.role === "farmer"}
            transcription={transcription.available}
          />
        </figure>
        <figure className="sim-figure">
          <figcaption>{t("স্মার্টফোন", "Smartphone")}</figcaption>
          <div className="sim-smartphone">
            <div className="sim-notch" />
            <iframe
              title={t("স্মার্টফোনে ওয়ার্কস্পেস", "Workspace on a smartphone")}
              src={base}
              loading="lazy"
            />
          </div>
        </figure>
      </div>
    </>
  );
}
