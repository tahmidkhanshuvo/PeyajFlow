import Link from "next/link";
import { pilotMutate } from "../../app/[locale]/workspace/pilot-actions";
import type { Locale } from "../../lib/copy";
import type {
  Batch,
  Forecast,
  Observation,
  PriceSeries,
} from "../../lib/pilot-types";
import { api } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type { Filters } from "../../lib/workspace-types";
import { numberLabel, timeLabel } from "../../lib/workspace-values";
import { Details, Field } from "./fields";
import { WorkspaceForm } from "./form";
import { taka } from "./market";

const DAM = "https://market.dam.gov.bd/";
const CSV_HEADER =
  "observed_on,published_on,district,market,price_type,grade,unit,kg_per_maund,low,high,source_url,source_record";

export const methods: Record<string, [string, string]> = {
  last_value: ["সর্বশেষ দর", "Last observed price"],
  rolling_median: [
    "সর্বশেষ চার দরের মধ্যক",
    "Rolling median of four observations",
  ],
  seasonal_naive: ["আগের মৌসুমের দর", "Seasonal baseline"],
  historical_change_quantiles: [
    "ঐতিহাসিক পরিবর্তনের কোয়ান্টাইল",
    "Historical-change quantiles",
  ],
  lagged_price_neighbors: ["দরের অনুরূপ প্রবণতার মডেল", "Price pattern model"],
};

export function priceType(locale: Locale, type: string) {
  const names: Record<string, [string, string]> = {
    farmgate: ["খামারদর", "Farmgate"],
    wholesale: ["পাইকারি", "Wholesale"],
    retail: ["খুচরা", "Retail"],
  };
  return local(locale, ...(names[type] ?? [type, type]));
}

export function seriesName(locale: Locale, row: PriceSeries) {
  return `${row.market} · ${row.district} · ${priceType(locale, row.price_type)} · ${row.grade}${row.synthetic ? local(locale, " · কাল্পনিক", " · Synthetic") : ""}`;
}

function batchStatus(locale: Locale, status: string) {
  const labels: Record<string, string> = {
    pending: "পর্যালোচনাধীন",
    approved: "অনুমোদিত",
    rejected: "প্রত্যাখ্যাত",
  };
  return locale === "bn" ? (labels[status] ?? status) : status;
}

function Observations({
  locale,
  rows,
}: {
  locale: Locale;
  rows: Observation[];
}) {
  if (!rows.length)
    return <p>{local(locale, "কোনো পর্যবেক্ষণ নেই।", "No observations.")}</p>;
  return (
    <div
      className="pilot-table"
      role="region"
      aria-label={local(locale, "দরের পর্যবেক্ষণ", "Price observations")}
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            <th scope="col">{local(locale, "পর্যবেক্ষণের তারিখ", "Observed")}</th>
            <th scope="col">
              {local(locale, "বাজার ও ধরন", "Market and type")}
            </th>
            <th scope="col">
              {local(locale, "প্রতি কেজির দর", "Price per kg")}
            </th>
            <th scope="col">{local(locale, "উৎস", "Source")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {timeLabel(locale, row.observed_on)}
                {row.stale && (
                  <p className="work-tag">{local(locale, "পুরোনো", "Stale")}</p>
                )}
              </td>
              <td>
                {row.market} · {row.district}
                <br />
                {priceType(locale, row.price_type)} · {row.grade}
              </td>
              <td>
                {taka(locale, Number(row.low_bdt_kg).toFixed(2))} –{" "}
                {taka(locale, Number(row.high_bdt_kg).toFixed(2))}
                {row.unit === "maund" && (
                  <small>
                    {taka(locale, row.low)} – {taka(locale, row.high)}{" "}
                    {local(locale, "প্রতি মণ", "per maund")} ·{" "}
                    {numberLabel(locale, row.kg_per_maund ?? "0")}{" "}
                    {local(locale, "কেজি/মণ", "kg/maund")}
                  </small>
                )}
              </td>
              <td>
                {row.synthetic ? (
                  <span className="work-tag">
                    {local(locale, "কাল্পনিক নমুনা", "Synthetic sample")}
                  </span>
                ) : (
                  <a className="work-link" href={row.source_url}>
                    {row.source_record}
                  </a>
                )}
                {row.synthetic && <small>{row.source_record}</small>}
                <small>
                  {local(locale, "প্রকাশিত", "Published")}{" "}
                  {timeLabel(locale, row.published_on)}
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForecastRange({
  locale,
  result,
}: {
  locale: Locale;
  result: Pick<Forecast, "low_bdt_kg" | "middle_bdt_kg" | "high_bdt_kg">;
}) {
  const bounds = [
    [local(locale, "নিম্ন", "Low"), result.low_bdt_kg],
    [local(locale, "মধ্য", "Middle"), result.middle_bdt_kg],
    [local(locale, "উচ্চ", "High"), result.high_bdt_kg],
  ];
  return (
    <dl className="work-metrics">
      {bounds.map(([label, amount]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {amount === null
              ? "—"
              : `${taka(locale, amount)} / ${local(locale, "কেজি", "kg")}`}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ForecastPanel({
  locale,
  result,
}: {
  locale: Locale;
  result: Forecast;
}) {
  const name =
    result.method && methods[result.method]
      ? local(locale, ...methods[result.method])
      : null;
  return (
    <section className="work-panel">
      <h2>{local(locale, "দরের সম্ভাব্য পরিসর", "Price outlook")}</h2>
      {result.synthetic && (
        <p className="work-tag">
          {local(locale, "কাল্পনিক নমুনা", "Synthetic sample")}
        </p>
      )}
      {name ? (
        <>
          <p>
            {name} · {timeLabel(locale, result.target_on)}
          </p>
          <ForecastRange locale={locale} result={result} />
          <p>
            {local(
              locale,
              "ঐতিহাসিক ১০ম–৯০তম শতাংশের আনুমানিক পরিসর।",
              "The range uses historical 10th–90th percentiles. See achieved coverage below.",
            )}
          </p>
        </>
      ) : (
        <p role="status">
          {result.status === "stale"
            ? local(
                locale,
                "সাম্প্রতিক দর নেই।",
                "The latest observation is stale.",
              )
            : local(
                locale,
                "পরিসর নির্ধারণের জন্য যথেষ্ট ইতিহাস নেই।",
                "There is insufficient history to estimate a range.",
              )}
        </p>
      )}
      {result.model_preview && (
        <section>
          <h3>{local(locale, "দর মডেলের নমুনা", "Price model preview")}</h3>
          <p>
            {local(
              locale,
              "নমুনা ইতিহাসে অনুরূপ দরের প্রবণতা থেকে তৈরি পরীক্ষামূলক পরিসর। বাস্তব বাজারে মডেলটি এখনও যাচাই করা হয়নি।",
              "An experimental range learned from similar price patterns in the sample history. Real-market accuracy still needs validation.",
            )}
          </p>
          <ForecastRange locale={locale} result={result.model_preview} />
        </section>
      )}
      <p>
        {local(locale, "ব্যবহৃত পর্যবেক্ষণের দিন", "Observation dates used")} ·{" "}
        {numberLabel(locale, result.history_count)}
        {result.last_observed &&
          ` · ${timeLabel(locale, result.last_observed)}`}
      </p>
      {result.backtest.length > 0 && (
        <Details label={local(locale, "ঐতিহাসিক যাচাই", "Historical backtest")}>
          <p>
            {local(
              locale,
              "প্রতিটি পূর্বাভাসের তারিখে প্রকাশিত তথ্যই ব্যবহার করা হয়েছে। পদ্ধতিভেদে পরীক্ষার সংখ্যা আলাদা হতে পারে।",
              "Each replay uses reports published by its forecast date. Some methods have fewer eligible test dates.",
            )}
          </p>
          <div
            className="pilot-table"
            role="region"
            aria-label={local(
              locale,
              "ঐতিহাসিক যাচাইয়ের ফল",
              "Backtest results",
            )}
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">{local(locale, "পদ্ধতি", "Method")}</th>
                  <th scope="col">{local(locale, "পরীক্ষা", "Tests")}</th>
                  <th scope="col">MAE (৳/kg)</th>
                  <th scope="col">WAPE</th>
                  <th scope="col">
                    {local(locale, "পরিসরে পড়েছে", "Coverage")}
                  </th>
                  <th scope="col">
                    {local(locale, "কোয়ান্টাইল ত্রুটি", "Pinball")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.backtest.map((metric) => (
                  <tr key={metric.method}>
                    <td>
                      {local(
                        locale,
                        ...(methods[metric.method] ?? [
                          metric.method,
                          metric.method,
                        ]),
                      )}
                    </td>
                    <td>{numberLabel(locale, metric.observations)}</td>
                    <td>
                      {numberLabel(
                        locale,
                        Number(metric.mae_bdt_kg).toFixed(2),
                      )}
                    </td>
                    <td>
                      {metric.wape_pct === null
                        ? "—"
                        : `${numberLabel(locale, Number(metric.wape_pct).toFixed(1))}%`}
                    </td>
                    <td>
                      {numberLabel(
                        locale,
                        Number(metric.interval_coverage_pct).toFixed(1),
                      )}
                      %
                    </td>
                    <td>
                      {numberLabel(
                        locale,
                        Number(metric.pinball_bdt_kg).toFixed(2),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Details>
      )}
    </section>
  );
}

export async function PricePage({
  locale,
  base,
  filters,
}: {
  locale: Locale;
  base: string;
  filters: Filters;
}) {
  const series = await api<PriceSeries[]>("/v1/market/series");
  const choice =
    series.find((item) => item.series === filters.series) ?? series[0];
  const horizon =
    filters.horizon === "14" || filters.horizon === "28"
      ? filters.horizon
      : "7";
  const [rows, forecast] = choice
    ? await Promise.all([
        api<Observation[]>(`/v1/market/prices?series=${choice.series}`),
        api<Forecast>(
          `/v1/market/forecasts?series=${choice.series}&horizon=${horizon}`,
        ),
      ])
    : [[], null];
  return (
    <>
      {choice ? (
        <section className="work-panel">
          <form action={`${base}/prices`} method="get" className="work-form">
            <div className="work-grid">
              <Field label={local(locale, "বাজারের দরধারা", "Market series")}>
                <select name="series" defaultValue={choice.series}>
                  {series.map((row) => (
                    <option key={row.series} value={row.series}>
                      {seriesName(locale, row)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={local(locale, "কত দিন পর", "Forecast horizon")}>
                <select name="horizon" defaultValue={horizon}>
                  {[7, 14, 28].map((days) => (
                    <option key={days} value={days}>
                      {numberLabel(locale, days)} {local(locale, "দিন", "days")}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button className="refresh" type="submit">
              {local(locale, "দর দেখুন", "View prices")}
            </button>
          </form>
        </section>
      ) : (
        <p className="work-panel">
          {local(
            locale,
            "এখনও অনুমোদিত বাজারদর নেই।",
            "No approved market observations yet.",
          )}
        </p>
      )}
      {forecast && <ForecastPanel locale={locale} result={forecast} />}
      {choice && (
        <section className="work-panel">
          <h2>{local(locale, "প্রকাশিত পর্যবেক্ষণ", "Published observations")}</h2>
          <Observations locale={locale} rows={rows} />
        </section>
      )}
      <a className="work-link" href={DAM}>
        {local(
          locale,
          "কৃষি বিপণন অধিদপ্তরের দর পোর্টাল",
          "Department of Agricultural Marketing price portal",
        )}
      </a>
    </>
  );
}

export async function ImportsPage({
  locale,
  base,
  id,
  offset,
}: {
  locale: Locale;
  base: string;
  id?: string;
  offset: number;
}) {
  if (id) {
    const batch = await api<Batch & { observations: Observation[] }>(
      `/v1/admin/data-imports/${id}`,
    );
    return (
      <>
        <Link className="work-link" href={`${base}/imports`}>
          {local(locale, "আমদানিতে ফিরুন", "Back to imports")}
        </Link>
        <section className="work-panel">
          <h2>{local(locale, "পর্যালোচনা", "Review")}</h2>
          <p>
            {batchStatus(locale, batch.status)} ·{" "}
            {numberLabel(locale, batch.accepted_rows)}{" "}
            {local(locale, "সারি", "rows")} ·{" "}
            {numberLabel(locale, batch.duplicates)}{" "}
            {local(locale, "নকল", "duplicates")}
          </p>
          {batch.synthetic && (
            <span className="work-tag">
              {local(locale, "কাল্পনিক নমুনা", "Synthetic sample")}
            </span>
          )}
          {batch.errors.length > 0 && (
            <Details label={local(locale, "বাদ পড়া সারি", "Skipped rows")}>
              <ul className="work-history">
                {batch.errors.map((issue) => (
                  <li key={issue.line}>
                    {local(locale, "সারি", "Line")}{" "}
                    {numberLabel(locale, issue.line)} · {issue.message}
                  </li>
                ))}
              </ul>
            </Details>
          )}
          {batch.status === "pending" && (
            <div className="work-row">
              <WorkspaceForm
                locale={locale}
                action={pilotMutate.bind(
                  null,
                  locale,
                  "review",
                  id,
                  "approved",
                )}
                label={local(locale, "দর অনুমোদন করুন", "Approve observations")}
              />
              <WorkspaceForm
                locale={locale}
                action={pilotMutate.bind(
                  null,
                  locale,
                  "review",
                  id,
                  "rejected",
                )}
                label={local(locale, "আমদানি প্রত্যাখ্যান", "Reject import")}
              />
            </div>
          )}
        </section>
        <section className="work-panel">
          <h2>
            {local(locale, "উৎস ও আমদানিকৃত দর", "Source and observations")}
          </h2>
          <Observations
            locale={locale}
            rows={batch.observations.slice(offset, offset + 50)}
          />
          <div className="work-row">
            {offset > 0 && (
              <Link
                className="work-link"
                href={`${base}/imports/${id}?offset=${Math.max(0, offset - 50)}`}
              >
                {local(locale, "আগের সারি", "Previous rows")}
              </Link>
            )}
            {offset + 50 < batch.observations.length && (
              <Link
                className="work-link"
                href={`${base}/imports/${id}?offset=${offset + 50}`}
              >
                {local(locale, "পরের সারি", "Next rows")}
              </Link>
            )}
          </div>
        </section>
      </>
    );
  }
  const batches = await api<Batch[]>(`/v1/admin/data-imports?offset=${offset}`);
  return (
    <>
      <section className="work-panel">
        <Details label={local(locale, "CSV জমা দিন", "Upload CSV")}>
          <p>
            {local(
              locale,
              "উৎসের প্রকাশের তারিখ ও মূল একক লিখুন। অনুমোদিত সারিগুলো বাজারে দেখা যাবে।",
              "Keep the source publication date and original unit. Approved rows become visible in market prices.",
            )}
          </p>
          <pre className="pilot-csv">
            <code>{CSV_HEADER}</code>
          </pre>
          <WorkspaceForm
            locale={locale}
            action={pilotMutate.bind(null, locale, "import", "", "")}
            label={local(locale, "পর্যালোচনার জন্য জমা", "Submit for review")}
          >
            <Field label={local(locale, "আমদানির নাম", "Import label")}>
              <input name="label" maxLength={100} required />
            </Field>
            <Field label={local(locale, "CSV ফাইল", "CSV file")}>
              <input name="csv" type="file" accept=".csv,text/csv" required />
            </Field>
            <label className="checkbox">
              <input name="synthetic" type="checkbox" />
              {local(locale, "কাল্পনিক নমুনা", "Synthetic sample")}
            </label>
          </WorkspaceForm>
        </Details>
      </section>
      {!batches.length && (
        <p className="work-panel">
          {local(locale, "কোনো আমদানি নেই।", "No imports on this page.")}
        </p>
      )}
      <div className="work-cards">
        {batches.map((batch) => (
          <article key={batch.id} className="work-panel">
            <h2>
              <Link className="work-link" href={`${base}/imports/${batch.id}`}>
                {batch.label}
              </Link>
            </h2>
            <p>
              {batchStatus(locale, batch.status)} ·{" "}
              {numberLabel(locale, batch.accepted_rows)}{" "}
              {local(locale, "সারি", "rows")} ·{" "}
              {timeLabel(locale, batch.created_at)}
            </p>
          </article>
        ))}
      </div>
      <div className="work-row">
        {offset > 0 && (
          <Link
            className="work-link"
            href={`${base}/imports?offset=${Math.max(0, offset - 30)}`}
          >
            {local(locale, "আগের পৃষ্ঠা", "Previous page")}
          </Link>
        )}
        {batches.length === 30 && (
          <Link
            className="work-link"
            href={`${base}/imports?offset=${offset + 30}`}
          >
            {local(locale, "পরের পৃষ্ঠা", "Next page")}
          </Link>
        )}
      </div>
    </>
  );
}
