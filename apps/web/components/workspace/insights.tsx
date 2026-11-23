import Link from "next/link";
import { randomUUID } from "node:crypto";
import type { Locale } from "../../lib/copy";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type { PriceSeries } from "../../lib/pilot-types";
import { DataChart } from "./data-chart";
import { FeatureForm, AnswerView, type Answer } from "./feature-form";
import { Field } from "./fields";
import { LocalModelsPanel } from "./local-models";

type Run = {
  id: string;
  status: string;
  question: string;
  result: {
    steps?: string[];
    note?: {
      checked_series: number;
      stale_series: number;
      outlook_status: string;
      knowledge: Answer;
      latest_observation?: {
        observed_on: string;
        published_on: string;
        low_bdt_kg: string;
        high_bdt_kg: string;
        synthetic: boolean;
      } | null;
      outlook?: {
        target_on: string;
        low_bdt_kg: string | null;
        high_bdt_kg: string | null;
        synthetic: boolean;
      };
    };
  };
};
type JobRun = {
  id: string;
  job: string;
  created_at: string;
  result: { sent: number; issues: number; status?: string };
};

export async function InsightsPage({
  locale,
  actor,
  base,
}: {
  locale: Locale;
  actor: Profile;
  base: string;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const now = new Date().getTime();
  const [series, subscription] = await Promise.all([
    api<PriceSeries[]>("/v1/market/series"),
    api<{ enabled: boolean; series: string | null }>(
      "/v1/automation/subscription",
    ),
  ]);
  const isOperator = actor.role === "admin" && actor.verified;
  const [runs, jobs, health] = isOperator
    ? await Promise.all([
        api<Run[]>("/v1/operator-assistant/runs"),
        api<JobRun[]>("/v1/automation/runs"),
        api<
          {
            market: string;
            district: string;
            latest_on: string;
            synthetic: boolean;
            status: string;
          }[]
        >("/v1/admin/data-quality"),
      ])
    : [[], [], []];
  return (
    <>
      <section className="work-panel">
        <p className="eyebrow">
          {t("প্রমাণ ও সংযোগ", "Evidence and integrations")}
        </p>
        <h2>{t("সহায়ক টুল", "Workspace tools")}</h2>
        <div className="work-row">
          <Link className="work-link" href={`${base}/help`}>
            {t("উৎসসহ প্রশ্নের উত্তর", "Ask with sources")}
          </Link>
          <Link className="work-link" href={`${base}/profile`}>
            {t("MCP টোকেন", "MCP tokens")}
          </Link>
          <Link className="work-link" href={`${base}/prices`}>
            {t("দরের চিত্র", "Price charts")}
          </Link>
        </div>
        <p>
          {t(
            "সব পরিবর্তন অ্যাপের অনুমোদিত প্রক্রিয়াতেই হয়। সহায়ক টুল মজুত বা পেমেন্টের সিদ্ধান্ত নেয় না।",
            "Changes use the app's authorized workflows. These tools do not decide stock or payment actions.",
          )}
        </p>
      </section>
      <section className="work-panel">
        <h2>{t("সাপ্তাহিক দরের খবর", "Weekly price digest")}</h2>
        <p>
          {t(
            "এই বাজারের সাপ্তাহিক খবর পেতে সম্মতি দিন। সিমুলেটরের খবর বাস্তব এসএমএস নয়। বাস্তব পাঠানোর জন্য আলাদা যাচাইকৃত নম্বর ও এসএমএস সম্মতি লাগে।",
            "Opt in to a weekly digest for this market. Simulator messages are not carrier SMS. Real delivery also requires a verified phone and separate SMS consent.",
          )}
        </p>
        <FeatureForm
          locale={locale}
          operation="subscribe"
          label={t("পছন্দ সংরক্ষণ", "Save preference")}
        >
          <label className="work-check">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={subscription.enabled}
            />
            {t("সাপ্তাহিক দরের খবর চাই", "Send me the weekly digest")}
          </label>
          <Field label={t("বাজার", "Market")}>
            <select name="series" defaultValue={subscription.series ?? ""}>
              <option value="">{t("বাজার বেছে নিন", "Choose a market")}</option>
              {series.map((row) => (
                <option value={row.series} key={row.series}>
                  {row.market} · {row.district}
                  {row.synthetic ? t(" · কাল্পনিক", " · Synthetic") : ""}
                </option>
              ))}
            </select>
          </Field>
        </FeatureForm>
      </section>
      {isOperator && (
        <>
          <section className="work-panel">
            <h2>{t("অপারেটর অনুসন্ধান", "Operator investigation")}</h2>
            <p>
              {t(
                "তথ্যের সতেজতা, পূর্বাভাস ও সহায়িকা পরীক্ষা করে একটি নোট তৈরি হয়। কারণ প্রমাণিত না হলে তা বলা হয়। অনুমোদন শুধু নোট সংরক্ষণ করে; ব্যবসায়িক পরিবর্তন হয় না।",
                "Checks freshness, forecasts and public help to prepare a note. Unproven causes stay unproven. Approval records the note and makes no business changes.",
              )}
            </p>
            <FeatureForm
              locale={locale}
              operation="investigate"
              label={t("অনুসন্ধান করুন", "Investigate")}
            >
              <Field label={t("কী পরীক্ষা করবেন?", "What should be checked?")}>
                <textarea
                  name="question"
                  minLength={3}
                  maxLength={500}
                  required
                />
              </Field>
              <Field label={t("দরধারা (ঐচ্ছিক)", "Market series (optional)")}>
                <select name="series">
                  <option value="">
                    {t("শুধু সতেজতা পরীক্ষা", "Freshness only")}
                  </option>
                  {series.map((row) => (
                    <option key={row.series} value={row.series}>
                      {row.market}
                      {row.synthetic ? t(" · কাল্পনিক", " · Synthetic") : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </FeatureForm>
            {runs.map((run) => (
              <article key={run.id} className="integration-token">
                <h3>{run.question}</h3>
                <p>
                  {t("অবস্থা", "Status")}: {run.status}
                </p>
                {run.result.note && (
                  <>
                    <p>
                      {t("পরীক্ষিত দরধারা", "Series checked")}:{" "}
                      {run.result.note.checked_series} · {t("পুরোনো", "Stale")}:{" "}
                      {run.result.note.stale_series}
                    </p>
                    <p>
                      {t(
                        "দর পরিবর্তনের কারণ প্রমাণিত নয়। উৎস ও প্রকাশের তারিখ অ্যাপে যাচাই করুন।",
                        "The cause of a price change is not established. Review sources and publication dates in the app.",
                      )}
                    </p>
                    {run.result.note.knowledge?.answer && (
                      <>
                        {run.result.note.latest_observation && (
                          <p>
                            {t("সর্বশেষ পর্যবেক্ষণ", "Latest observation")}:{" "}
                            {run.result.note.latest_observation.low_bdt_kg}–
                            {run.result.note.latest_observation.high_bdt_kg}{" "}
                            {t("টাকা/কেজি", "BDT/kg")} ·{" "}
                            {run.result.note.latest_observation.observed_on} ·{" "}
                            {t("প্রকাশিত", "Published")}{" "}
                            {run.result.note.latest_observation.published_on}
                            {run.result.note.latest_observation.synthetic
                              ? t(" · কাল্পনিক", " · Synthetic")
                              : ""}
                          </p>
                        )}
                        {run.result.note.outlook?.low_bdt_kg != null && (
                          <p>
                            {t("ভবিষ্যতের পরিসর", "Future range")}:{" "}
                            {run.result.note.outlook.low_bdt_kg}–
                            {run.result.note.outlook.high_bdt_kg}{" "}
                            {t("টাকা/কেজি", "BDT/kg")} ·{" "}
                            {run.result.note.outlook.target_on}
                            {run.result.note.outlook.synthetic
                              ? t(" · কাল্পনিক", " · Synthetic")
                              : ""}
                            .{" "}
                            {t(
                              "এটি ভবিষ্যতের পরিস্থিতি; অতীতের দর পরিবর্তনের কারণ নয়।",
                              "This is a future scenario, not a cause of a past price change.",
                            )}
                          </p>
                        )}
                        <AnswerView
                          locale={locale}
                          answer={run.result.note.knowledge}
                        />
                      </>
                    )}
                  </>
                )}
                <ol>
                  {run.result.steps?.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {run.status === "awaiting_review" && (
                  <div className="work-grid">
                    {["approve", "dismiss"].map((decision) => (
                      <FeatureForm
                        key={decision}
                        locale={locale}
                        operation="review"
                        label={
                          decision === "approve"
                            ? t("নোট অনুমোদন", "Approve note")
                            : t("বাদ দিন", "Dismiss")
                        }
                      >
                        <input name="id" type="hidden" value={run.id} />
                        <input name="decision" type="hidden" value={decision} />
                      </FeatureForm>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </section>
          <section className="work-panel">
            <h2>{t("নিয়মিত কাজ", "Recurring operations")}</h2>
            <p>
              {t(
                "এখন একবার চালিয়ে দেখুন। নির্ধারিত সময়ে চালাতে n8n-এ রপ্তানিকৃত কার্যপ্রবাহ ও সীমিত টোকেন ব্যবহার করুন।",
                "Run a job once here. For schedules, use the exported n8n workflows with a scoped automation token.",
              )}
            </p>
            <div className="work-grid">
              {[
                ["weekly-prices", t("সাপ্তাহিক দর পাঠান", "Send weekly digest")],
                ["freshness", t("পুরোনো দর পরীক্ষা", "Check freshness")],
                ["alert-routing", t("অপারেটরের খবর", "Route operator alerts")],
              ].map(([job, label]) => (
                <FeatureForm
                  locale={locale}
                  operation="job"
                  label={label}
                  key={job}
                >
                  <input name="job" type="hidden" value={job} />
                  <input
                    name="request_key"
                    type="hidden"
                    value={randomUUID()}
                  />
                </FeatureForm>
              ))}
            </div>
            <ul>
              {jobs.map((job) => (
                <li key={job.id}>
                  {job.job} · {job.created_at.slice(0, 16)} ·{" "}
                  {t("খবর", "Notices")}: {job.result.sent ?? 0} ·{" "}
                  {t("মনোযোগ প্রয়োজন", "Needs attention")}:{" "}
                  {job.result.issues ?? 0}
                </li>
              ))}
            </ul>
          </section>
          <section className="work-panel">
            <DataChart
              locale={locale}
              title={t("উৎসের বয়স", "Source age")}
              summary={t(
                "দর পর্যবেক্ষণের তারিখ থেকে দিনের হিসাব। কাল্পনিক দর আলাদা চিহ্নিত।",
                "Days since each price observation. Synthetic series are labelled separately.",
              )}
              points={health.map((row) => ({
                name:
                  row.market +
                  (row.synthetic ? t(" · কাল্পনিক", " · Synthetic") : ""),
                value: Math.max(
                  0,
                  Math.floor((now - Date.parse(row.latest_on)) / 86400000),
                ),
              }))}
              unit={t("দিন", "Days")}
              bars
            />
          </section>
          <LocalModelsPanel locale={locale} />
        </>
      )}
    </>
  );
}
