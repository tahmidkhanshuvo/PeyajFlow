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
import { WorkspaceIcon } from "./icon";
import { LocationIcon } from "./location-icon";
import { taka } from "./market";

const DAM = "https://market.dam.gov.bd/";
const CSV_HEADER =
  "observed_on,published_on,district,market,price_type,grade,unit,kg_per_maund,low,high,source_url,source_record";

export const methods: Record<string, [string, string]> = {
  last_value: ["সর্বশেষ পর্যবেক্ষণ দর", "Last observed price"],
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

const districts: Record<string, [string, string]> = {
  Pabna: ["পাবনা", "Pabna"],
  Dhaka: ["ঢাকা", "Dhaka"],
  Rajshahi: ["রাজশাহী", "Rajshahi"],
  Faridpur: ["ফরিদপুর", "Faridpur"],
  Kushtia: ["কুষ্টিয়া", "Kushtia"],
  Natore: ["নাটোর", "Natore"],
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
  const dist = districts[row.district]
    ? local(locale, ...districts[row.district])
    : row.district;
  const gradeLabel = row.grade
    ? local(locale, `গ্রেড ${row.grade}`, `Grade ${row.grade}`)
    : "";
  return `${row.market} · ${dist} · ${priceType(locale, row.price_type)}${gradeLabel ? ` · ${gradeLabel}` : ""}${row.synthetic ? local(locale, " · কাল্পনিক", " · Synthetic") : ""}`;
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
  const t = (bn: string, en: string) => local(locale, bn, en);

  if (!rows.length) {
    return (
      <div className="price-empty-state">
        <span className="price-empty-icon" aria-hidden="true">
          <WorkspaceIcon name="inbox" size={32} />
        </span>
        <p>{t("কোনো অনুমোদিত পর্যবেক্ষণ পাওয়া যায়নি।", "No approved observations found.")}</p>
      </div>
    );
  }

  return (
    <div
      className="price-table-wrapper"
      role="region"
      aria-label={t("দরের পর্যবেক্ষণ তালিকা", "Price observations table")}
      tabIndex={0}
    >
      <table className="price-table">
        <thead>
          <tr>
            <th scope="col" className="col-date">
              <span className="th-content">{t("পর্যবেক্ষণের তারিখ", "Observed Date")}</span>
            </th>
            <th scope="col" className="col-market">
              <span className="th-content">{t("বাজার ও জাত", "Market & Variety")}</span>
            </th>
            <th scope="col" className="col-price text-right">
              <span className="th-content">{t("দর (প্রতি কেজি)", "Price / kg")}</span>
            </th>
            <th scope="col" className="col-source">
              <span className="th-content">{t("উৎস ও রেকর্ড", "Source & Verification")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const lowKg = Number(row.low_bdt_kg);
            const highKg = Number(row.high_bdt_kg);
            const isSingle = !isNaN(lowKg) && !isNaN(highKg) && lowKg === highKg;
            const dist = districts[row.district]
              ? local(locale, ...districts[row.district])
              : row.district;

            return (
              <tr key={row.id}>
                {/* 1. Date */}
                <td className="col-date">
                  <div className="price-date-cell">
                    <span className="price-date-main">
                      {timeLabel(locale, row.observed_on)}
                    </span>
                    {row.stale && (
                      <span className="price-pill-stale">
                        {t("পুরোনো তথ্য", "Stale")}
                      </span>
                    )}
                  </div>
                </td>

                {/* 2. Market & Type */}
                <td className="col-market">
                  <div className="price-market-cell">
                    <strong className="price-market-title">
                      {row.market} · {dist}
                    </strong>
                    <div className="price-pill-row">
                      <span className="price-type-pill">
                        {priceType(locale, row.price_type)}
                      </span>
                      {row.grade && (
                        <span className="price-grade-pill">
                          {t(`গ্রেড ${row.grade}`, `Grade ${row.grade}`)}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* 3. Price (Right aligned, non-breaking, bold formatted) */}
                <td className="col-price text-right">
                  <div className="price-val-cell">
                    <div className="price-bdt-main">
                      {isSingle ? (
                        <span className="price-num">{taka(locale, lowKg.toFixed(2))}</span>
                      ) : (
                        <span className="price-num">
                          {taka(locale, lowKg.toFixed(2))} – {taka(locale, highKg.toFixed(2))}
                        </span>
                      )}
                      <span className="price-unit"> / {t("কেজি", "kg")}</span>
                    </div>

                    {row.unit === "maund" && (
                      <div className="price-maund-sub">
                        <span>
                          {taka(locale, row.low)} – {taka(locale, row.high)} {t("/মণ", "/maund")}
                        </span>
                        <span className="price-dot-sep">·</span>
                        <span>
                          {numberLabel(locale, row.kg_per_maund ?? "0")} {t("কেজি/মণ", "kg/maund")}
                        </span>
                      </div>
                    )}
                  </div>
                </td>

                {/* 4. Source & Verification Record */}
                <td className="col-source">
                  <div className="price-source-cell">
                    <div className="price-source-top">
                      {row.synthetic ? (
                        <span className="price-pill-synthetic">
                          {t("কাল্পনিক নমুনা", "Synthetic Sample")}
                        </span>
                      ) : row.source_url ? (
                        <a
                          className="price-source-link"
                          href={row.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span>{row.source_record || t("উৎস রেকর্ড", "View Record")}</span>
                          <WorkspaceIcon name="external" size={13} />
                        </a>
                      ) : (
                        <span className="price-source-plain">
                          {row.source_record || t("সরকারি রেকর্ড", "Official Record")}
                        </span>
                      )}
                    </div>

                    <div className="price-source-meta">
                      {row.synthetic && row.source_record && (
                        <span className="price-fixture-tag">{row.source_record}</span>
                      )}
                      <span className="price-published-date">
                        {t("প্রকাশ:", "Published:")} {timeLabel(locale, row.published_on)}
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ForecastRange({
  locale,
  result,
  variant = "primary",
}: {
  locale: Locale;
  result: Pick<Forecast, "low_bdt_kg" | "middle_bdt_kg" | "high_bdt_kg">;
  variant?: "primary" | "preview";
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const isPreview = variant === "preview";

  const cards = [
    {
      key: "low",
      label: t("সর্বনিম্ন সম্ভাব্য দর", "Lower Bound (P10)"),
      amount: result.low_bdt_kg,
      badge: t("১০ম শতাংশ (Floor)", "10th Percentile"),
      tone: "low",
      iconName: "trendDown",
    },
    {
      key: "middle",
      label: t("প্রত্যাশিত মধ্যক দর", "Expected Price (Median)"),
      amount: result.middle_bdt_kg,
      badge: t("৫০তম শতাংশ (Benchmark)", "50th Percentile"),
      tone: "median",
      featured: true,
      iconName: "target",
    },
    {
      key: "high",
      label: t("সর্বোচ্চ সম্ভাব্য দর", "Upper Bound (P90)"),
      amount: result.high_bdt_kg,
      badge: t("৯০তম শতাংশ (Ceiling)", "90th Percentile"),
      tone: "high",
      iconName: "trendUp",
    },
  ];

  return (
    <div className={`dash-kpi-grid price-metrics-grid ${isPreview ? "is-preview-grid" : ""}`}>
      {cards.map((card) => (
        <div
          key={card.key}
          className={`dash-kpi-card glass-1 price-metric-tile tone-${card.tone} ${card.featured && !isPreview ? "is-featured-median" : ""}`}
        >
          <div className="dash-kpi-header">
            <span className="dash-kpi-icon">
              <WorkspaceIcon name={card.iconName} />
            </span>
            <span className="dash-kpi-badge">{card.badge}</span>
          </div>

          <div className="dash-kpi-body">
            <span className="dash-kpi-label">{card.label}</span>
            {card.amount === null ? (
              <strong className="dash-kpi-value stat-num">—</strong>
            ) : (
              <strong className="dash-kpi-value stat-num">
                {taka(locale, card.amount)}{" "}
                <span className="price-metric-unit">/ {t("কেজি", "kg")}</span>
              </strong>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ForecastPanel({
  locale,
  result,
  horizon,
}: {
  locale: Locale;
  result: Forecast;
  horizon: string;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const name =
    result.method && methods[result.method]
      ? local(locale, ...methods[result.method])
      : null;

  return (
    <section className="work-panel price-forecast-card glass-1">
      {/* Header Strip */}
      <div className="price-forecast-header">
        <div className="price-forecast-title-wrap">
          <div className="dash-quality-eyebrow">
            <span className="dash-pulse-dot" aria-hidden="true" />
            <span>{t("মূল্য পূর্বাভাস ও পরিসর", "PRICE OUTLOOK")}</span>
          </div>
          <h2 className="dash-analysis-title price-forecast-title">
            {t("দরের সম্ভাব্য পূর্বাভাস পরিসর", "Price Range Outlook")}
          </h2>
        </div>

        <div className="price-forecast-badges">
          {result.synthetic && (
            <span className="price-pill-synthetic">
              {t("কাল্পনিক নমুনা মডেল", "Synthetic Model")}
            </span>
          )}
          <span className="price-pill-horizon">
            <WorkspaceIcon name="clock" size={14} />
            <span>
              {numberLabel(locale, horizon)} {t("দিনের পূর্বাভাস", "Days Horizon")}
            </span>
          </span>
        </div>
      </div>

      {name ? (
        <>
          {/* Target & Method Meta Strip */}
          <div className="price-target-strip">
            <div className="price-target-item">
              <span className="price-target-label">{t("ব্যবহৃত মডেল:", "Applied Model:")}</span>
              <strong className="price-target-val">{name}</strong>
            </div>
            <div className="price-target-sep" aria-hidden="true">·</div>
            <div className="price-target-item">
              <span className="price-target-label">{t("পূর্বাভাস লক্ষ্য তারিখ:", "Target Date:")}</span>
              <strong className="price-target-val">{timeLabel(locale, result.target_on)}</strong>
            </div>
          </div>

          {/* Primary 3-Metric Bounds Cards */}
          <ForecastRange locale={locale} result={result} />

          <p className="price-outlook-footnote">
            <span className="price-fn-icon" aria-hidden="true">
              <WorkspaceIcon name="info" size={16} />
            </span>
            <span>
              {t(
                "ঐতিহাসিক ১০ম–৯০তম শতাংশের আনুমানিক পরিসর। নিচে মডেলের ঐতিহাসিক নির্ভুলতা ও কভারেজ যাচাই দেখুন।",
                "Historical 10th–90th percentile forecast interval. See model evaluation scores and backtest metrics below.",
              )}
            </span>
          </p>
        </>
      ) : (
        <div className="price-empty-state">
          <p role="status">
            {result.status === "stale"
              ? t(
                  "সাম্প্রতিক বাজারদর পাওয়া যায়নি। তথ্যের জন্য অপেক্ষা করুন।",
                  "The latest price observation is stale. Awaiting fresh data.",
                )
              : t(
                  "পরিসর নির্ধারণের জন্য পর্যাপ্ত ঐতিহাসিক বাজারদর নেই।",
                  "There is insufficient historical data to estimate a price range.",
                )}
          </p>
        </div>
      )}

      {/* Experimental Model Preview (Encapsulated Subcard) */}
      {result.model_preview && (
        <div className="price-preview-subcard">
          <div className="price-preview-header">
            <span className="price-preview-icon" aria-hidden="true">
              <WorkspaceIcon name="sparkles" size={18} />
            </span>
            <div>
              <h3 className="price-preview-title">
                {t("দরের অনুরূপ প্রবণতার পরীক্ষামূলক মডেল", "Pattern Matching Model Preview")}
              </h3>
              <p className="price-preview-desc">
                {t(
                  "নমুনা ইতিহাসে অনুরূপ দরের প্রবণতা থেকে তৈরি পরীক্ষামূলক পরিসর। বাস্তব বাজারে মডেলটি এখনও যাচাই করা হচ্ছে।",
                  "An experimental range learned from similar price patterns in the sample history. Real-market accuracy still needs empirical validation.",
                )}
              </p>
            </div>
          </div>
          <ForecastRange locale={locale} result={result.model_preview} variant="preview" />
        </div>
      )}

      {/* Observation Meta Strip */}
      <div className="price-obs-meta-strip">
        <div className="price-obs-stat">
          <span className="price-obs-icon" aria-hidden="true">
            <WorkspaceIcon name="chartBar" size={18} />
          </span>
          <span>
            {t("ব্যবহৃত পর্যবেক্ষণ সংখ্যা:", "Observation dates used:")}{" "}
            <strong>{numberLabel(locale, result.history_count)} {t("দিন", "days")}</strong>
          </span>
        </div>
        {result.last_observed && (
          <div className="price-obs-stat">
            <span className="price-obs-icon" aria-hidden="true">
              <WorkspaceIcon name="calendar" size={16} />
            </span>
            <span>
              {t("সর্বশেষ তথ্য রেকর্ড:", "Last observed record:")}{" "}
              <strong>{timeLabel(locale, result.last_observed)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Historical Backtest Details Accordion */}
      {result.backtest.length > 0 && (
        <div className="price-backtest-wrap">
          <Details label={t("ঐতিহাসিক মডেল নির্ভুলতা যাচাই (Historical Backtest)", "Historical Backtest Evaluation")}>
            <p className="price-backtest-desc">
              {t(
                "প্রতিটি পূর্বাভাসের তারিখে প্রকাশিত তথ্যের ভিত্তিতে মডেলগুলো পুনরায় পরীক্ষা করে ত্রুটির হার (MAE/WAPE) এবং পরিসর নির্ভুলতা তুলনা করা হয়েছে।",
                "Each replay evaluated historical forecasts against actual outcomes using reports available at that time.",
              )}
            </p>
            <div
              className="price-table-wrapper"
              role="region"
              aria-label={t("ঐতিহাসিক যাচাইয়ের ফলাফল", "Backtest metrics")}
              tabIndex={0}
            >
              <table className="price-table backtest-table">
                <thead>
                  <tr>
                    <th scope="col" className="text-left">{t("পদ্ধতি", "Method")}</th>
                    <th scope="col" className="text-right">{t("পরীক্ষা", "Tests")}</th>
                    <th scope="col" className="text-right">{t("MAE (৳/কেজি)", "MAE (৳/kg)")}</th>
                    <th scope="col" className="text-right">{t("WAPE (%)", "WAPE (%)")}</th>
                    <th scope="col" className="text-right">{t("পরিসরে কভারেজ", "Coverage")}</th>
                    <th scope="col" className="text-right">{t("কোয়ান্টাইল ত্রুটি", "Pinball Loss")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.backtest.map((metric) => {
                    const coverage = Number(metric.interval_coverage_pct);
                    return (
                      <tr key={metric.method}>
                        <td className="text-left font-medium">
                          {local(
                            locale,
                            ...(methods[metric.method] ?? [metric.method, metric.method]),
                          )}
                        </td>
                        <td className="text-right tabular-nums">{numberLabel(locale, metric.observations)}</td>
                        <td className="text-right tabular-nums">৳{numberLabel(locale, Number(metric.mae_bdt_kg).toFixed(2))}</td>
                        <td className="text-right tabular-nums">
                          {metric.wape_pct === null
                            ? "—"
                            : `${numberLabel(locale, Number(metric.wape_pct).toFixed(1))}%`}
                        </td>
                        <td className="text-right tabular-nums">
                          <span className={`price-coverage-pill ${coverage >= 80 ? "is-good" : "is-fair"}`}>
                            {numberLabel(locale, coverage.toFixed(1))}%
                          </span>
                        </td>
                        <td className="text-right tabular-nums">{numberLabel(locale, Number(metric.pinball_bdt_kg).toFixed(2))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Details>
        </div>
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
  const t = (bn: string, en: string) => local(locale, bn, en);
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

  const latestObs = rows[0];
  const activeDistrict = choice
    ? districts[choice.district]
      ? local(locale, ...districts[choice.district])
      : choice.district
    : "";

  return (
    <div className="price-page-wrap">
      {/* ─── 1. EXECUTIVE HERO HEADER ─── */}
      <section className="work-panel price-hero-header glass-1">
        <div className="price-hero-ambient" aria-hidden="true" />
        <div className="price-hero-top">
          <div className="dash-welcome-eyebrow">
            <span className="dash-pulse-dot" aria-hidden="true" />
            <span>{t("লাইভ বাজারদর ও মূল্য বিশ্লেষণ", "Market Benchmarks & Outlook")}</span>
          </div>
          {choice?.synthetic && (
            <span className="price-hero-tag">
              {t("নমুনা ও প্রক্ষেপণ মডেল", "Synthetic Model Active")}
            </span>
          )}
        </div>

        <div className="price-hero-main">
          <h1 className="price-hero-title">
            <span className="headline-primary">
              {t("বাজারদর ও ভবিষ্যৎ মূল্য পূর্বাভাস", "Market Prices & Price Outlook")}
            </span>
          </h1>
          <p className="price-hero-desc">
            {t(
              "পাবনা মোকাম ও প্রধান পাইকারি বাজারের দৈনিক দর পর্যালোচনা, ঐতিহাসিক ধারা ও ভবিষ্যৎ মূল্য পূর্বাভাস এক নজরে দেখুন।",
              "Track verified farmgate and wholesale market rates, historical observations, and quantitative price forecasts.",
            )}
          </p>
        </div>

        {/* Live Market Quick Stat Cards (Matches Overview KPI Grid) */}
        {choice && latestObs && (
          <div className="dash-kpi-grid price-hero-stats">
            <div className="dash-kpi-card glass-1">
              <div className="dash-kpi-header">
                <span className="dash-kpi-icon">
                  <LocationIcon size={16} />
                </span>
                <span className="dash-kpi-badge">{t("বাজার", "Market")}</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">{t("বর্তমান বাজার", "Active Market")}</span>
                <strong className="dash-kpi-value stat-num">
                  {choice.market} · {activeDistrict}
                </strong>
              </div>
            </div>

            <div className="dash-kpi-card glass-1">
              <div className="dash-kpi-header">
                <span className="dash-kpi-icon">
                  <WorkspaceIcon name="tag" size={15} />
                </span>
                <span className="dash-kpi-badge">{t("সর্বশেষ দর", "Latest")}</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">{t("পর্যবেক্ষণ দর", "Observed Rate")}</span>
                <strong className="dash-kpi-value stat-num">
                  {Number(latestObs.low_bdt_kg) === Number(latestObs.high_bdt_kg)
                    ? `${taka(locale, Number(latestObs.low_bdt_kg).toFixed(2))} / ${t("কেজি", "kg")}`
                    : `${taka(locale, Number(latestObs.low_bdt_kg).toFixed(2))} – ${taka(locale, Number(latestObs.high_bdt_kg).toFixed(2))} / ${t("কেজি", "kg")}`}
                </strong>
              </div>
            </div>

            <div className="dash-kpi-card glass-1">
              <div className="dash-kpi-header">
                <span className="dash-kpi-icon">
                  <WorkspaceIcon name="calendar" size={15} />
                </span>
                <span className="dash-kpi-badge">{t("তারিখ", "Date")}</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">{t("পর্যবেক্ষণ তারিখ", "Observed On")}</span>
                <strong className="dash-kpi-value stat-num">{timeLabel(locale, latestObs.observed_on)}</strong>
              </div>
            </div>

            <div className="dash-kpi-card glass-1">
              <div className="dash-kpi-header">
                <span className="dash-kpi-icon">
                  <WorkspaceIcon name="chartBar" size={15} />
                </span>
                <span className="dash-kpi-badge">{t("রেকর্ড", "History")}</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">{t("মোট পর্যবেক্ষণ", "Total Observations")}</span>
                <strong className="dash-kpi-value stat-num">
                  {numberLabel(locale, rows.length)} {t("দিন", "days")}
                </strong>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── 2. SERIES & HORIZON FILTER CARD ─── */}
      {choice ? (
        <section className="work-panel price-filter-card glass-1">
          <form action={`${base}/prices`} method="get" className="price-filter-form">
            <div className="price-filter-fields">
              <div className="price-field-group">
                <label htmlFor="series-select" className="price-field-label">
                  <span className="price-field-icon" aria-hidden="true">
                    <WorkspaceIcon name="trendUp" size={16} />
                  </span>
                  <span>{t("বাজারের দরধারা", "Market Series")}</span>
                </label>
                <div className="price-select-wrap">
                  <select
                    id="series-select"
                    name="series"
                    defaultValue={choice.series}
                    className="price-select"
                  >
                    {series.map((row) => (
                      <option key={row.series} value={row.series}>
                        {seriesName(locale, row)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="price-field-group price-field-horizon">
                <label htmlFor="horizon-select" className="price-field-label">
                  <span className="price-field-icon" aria-hidden="true">
                    <WorkspaceIcon name="clock" size={16} />
                  </span>
                  <span>{t("পূর্বাভাস সময়সীমা", "Forecast Horizon")}</span>
                </label>
                <div className="price-select-wrap">
                  <select
                    id="horizon-select"
                    name="horizon"
                    defaultValue={horizon}
                    className="price-select"
                  >
                    {[7, 14, 28].map((days) => (
                      <option key={days} value={days}>
                        {numberLabel(locale, days)} {t("দিন পর", "days ahead")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button className="price-submit-btn" type="submit">
              <span className="price-btn-icon" aria-hidden="true">
                <WorkspaceIcon name="search" size={16} />
              </span>
              <span>{t("দর পর্যালোচনা করুন", "View Prices")}</span>
            </button>
          </form>
        </section>
      ) : (
        <div className="work-panel" role="status">
          <p>{t("এখনও অনুমোদিত বাজারদর নেই।", "No approved market observations yet.")}</p>
        </div>
      )}

      {/* ─── 3. QUANTITATIVE FORECAST OUTLOOK ─── */}
      {forecast && <ForecastPanel locale={locale} result={forecast} horizon={horizon} />}

      {/* ─── 4. PUBLISHED OBSERVATIONS TABLE ─── */}
      {choice && (
        <section className="work-panel price-observations-card glass-1">
          <div className="price-section-header">
            <div>
              <div className="dash-quality-eyebrow">
                <span className="dash-pulse-dot" aria-hidden="true" />
                <span>{t("বাজারদর উপাত্ত", "HISTORICAL DATA")}</span>
              </div>
              <h2 className="dash-analysis-title price-section-title">
                {t("প্রকাশিত পর্যবেক্ষণসমূহ", "Published Observations")}
              </h2>
            </div>
            <div className="price-section-count">
              <span className="price-count-chip">
                {numberLabel(locale, rows.length)} {t("টি রেকর্ড", "records")}
              </span>
            </div>
          </div>

          <Observations locale={locale} rows={rows} />
        </section>
      )}

      {/* ─── 5. OFFICIAL DAM GOVERNMENT PORTAL BANNER ─── */}
      <aside className="work-panel price-dam-banner glass-1">
        <div className="price-dam-content">
          <div className="price-dam-icon-wrap" aria-hidden="true">
            <WorkspaceIcon name="building" size={26} />
          </div>
          <div className="price-dam-text">
            <strong className="price-dam-title">
              {t(
                "সরকারি কৃষি বিপণন অধিদপ্তর (DAM) দর পোর্টাল",
                "Department of Agricultural Marketing (DAM) Price Portal",
              )}
            </strong>
            <p className="price-dam-desc">
              {t(
                "বাংলাদেশের সকল বিভাগ ও মোকামের প্রাতিষ্ঠানিক পাইকারি ও খুচরা দর সরাসরি সরকারি ডাটাবেজ থেকে যাচাই করতে পোর্টাল দেখুন।",
                "Visit the official Bangladesh government agricultural price portal for verified daily commodity benchmark feeds.",
              )}
            </p>
          </div>
        </div>
        <a
          className="price-dam-cta-btn"
          href={DAM}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>{t("DAM পোর্টাল খুলুন", "Open DAM Portal")}</span>
          <WorkspaceIcon name="external" size={15} />
        </a>
      </aside>
    </div>
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
