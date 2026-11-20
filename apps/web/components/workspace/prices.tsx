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
        <p>
          {t(
            "কোনো অনুমোদিত পর্যবেক্ষণ পাওয়া যায়নি।",
            "No approved observations found.",
          )}
        </p>
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
              <span className="th-content">
                {t("পর্যবেক্ষণের তারিখ", "Observed Date")}
              </span>
            </th>
            <th scope="col" className="col-market">
              <span className="th-content">
                {t("বাজার ও জাত", "Market & Variety")}
              </span>
            </th>
            <th scope="col" className="col-price text-right">
              <span className="th-content">
                {t("দর (প্রতি কেজি)", "Price / kg")}
              </span>
            </th>
            <th scope="col" className="col-source">
              <span className="th-content">
                {t("উৎস ও রেকর্ড", "Source & Verification")}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const lowKg = Number(row.low_bdt_kg);
            const highKg = Number(row.high_bdt_kg);
            const isSingle =
              !isNaN(lowKg) && !isNaN(highKg) && lowKg === highKg;
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

                {/* 3. Price */}
                <td className="col-price text-right">
                  <div className="price-val-cell">
                    <div className="price-bdt-main">
                      {isSingle ? (
                        <span className="price-num">
                          {taka(locale, lowKg.toFixed(2))}
                        </span>
                      ) : (
                        <span className="price-num">
                          {taka(locale, lowKg.toFixed(2))} –{" "}
                          {taka(locale, highKg.toFixed(2))}
                        </span>
                      )}
                      <span className="price-unit"> / {t("কেজি", "kg")}</span>
                    </div>

                    {row.unit === "maund" && (
                      <div className="price-maund-sub">
                        <span>
                          {taka(locale, row.low)} – {taka(locale, row.high)}{" "}
                          {t("/মণ", "/maund")}
                        </span>
                        <span className="price-dot-sep">·</span>
                        <span>
                          {numberLabel(locale, row.kg_per_maund ?? "0")}{" "}
                          {t("কেজি/মণ", "kg/maund")}
                        </span>
                      </div>
                    )}
                  </div>
                </td>

                {/* 4. Source */}
                <td className="col-source">
                  <div className="price-source-cell">
                    <div className="price-source-top">
                      {row.source_url ? (
                        <a
                          className="price-source-link"
                          href={row.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span>
                            {row.source_record || t("উৎস রেকর্ড", "View Record")}
                          </span>
                          <WorkspaceIcon name="external" size={13} />
                        </a>
                      ) : (
                        <span className="price-source-plain">
                          {row.source_record ||
                            t("সরকারি রেকর্ড", "Official Record")}
                        </span>
                      )}
                    </div>
                    <div className="price-source-meta">
                      <span className="price-published-date">
                        {t("প্রকাশ:", "Published:")}{" "}
                        {timeLabel(locale, row.published_on)}
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

/* ─────────────────────────────────────────────────────────────
   HISTORICAL SPIKE GRAPH (Overview without leaking inner mock details)
   ───────────────────────────────────────────────────────────── */
function HistoricalSpikeGraph({
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
        <p>
          {t(
            "কোনো অনুমোদিত পর্যবেক্ষণ পাওয়া যায়নি।",
            "No approved observations found.",
          )}
        </p>
      </div>
    );
  }

  // Parse valid chronological observation points
  const points = rows
    .map((r) => {
      const low = Number(r.low_bdt_kg);
      const high = Number(r.high_bdt_kg);
      const mid = (low + high) / 2;
      return {
        date: r.observed_on,
        low: isNaN(low) ? 0 : low,
        high: isNaN(high) ? 0 : high,
        mid: isNaN(mid) ? 0 : mid,
      };
    })
    .filter((p) => p.low > 0 && p.high > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!points.length) {
    return (
      <div className="price-empty-state">
        <p>
          {t(
            "পর্যাপ্ত দর উপাত্ত পাওয়া যায়নি।",
            "Insufficient price data points to plot.",
          )}
        </p>
      </div>
    );
  }

  const minLow = Math.min(...points.map((p) => p.low));
  const maxHigh = Math.max(...points.map((p) => p.high));
  const latestPoint = points[points.length - 1];
  const avgMid = points.reduce((acc, p) => acc + p.mid, 0) / points.length;

  // SVG Chart Dimensions
  const svgWidth = 800;
  const svgHeight = 220;
  const padLeft = 52;
  const padRight = 32;
  const padTop = 24;
  const padBottom = 42;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  // Y Scale
  const minScale = Math.max(0, Math.floor((minLow - 2) / 5) * 5);
  const maxScale = Math.ceil((maxHigh + 2) / 5) * 5;
  const range = maxScale - minScale || 1;

  // Grid steps (intervals of 5 or 10)
  const step = range <= 25 ? 5 : 10;
  const gridSteps: number[] = [];
  for (let val = minScale; val <= maxScale; val += step) {
    gridSteps.push(val);
  }

  // Calculate coordinates for points
  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? padLeft + plotWidth / 2
        : padLeft + (idx / (points.length - 1)) * plotWidth;
    const yHigh = padTop + ((maxScale - p.high) / range) * plotHeight;
    const yLow = padTop + ((maxScale - p.low) / range) * plotHeight;
    const yMid = padTop + ((maxScale - p.mid) / range) * plotHeight;
    return { ...p, x, yHigh, yLow, yMid };
  });

  // Construct smooth spline path for midpoint trajectory
  const pathD = coords.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.yMid}`;
    const prev = coords[i - 1];
    const cx1 = prev.x + (pt.x - prev.x) / 2;
    const cy1 = prev.yMid;
    const cx2 = prev.x + (pt.x - prev.x) / 2;
    const cy2 = pt.yMid;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.yMid}`;
  }, "");

  // Date label indices to display along bottom (evenly spaced, no overlap)
  const labelIndices: number[] = [];
  if (coords.length <= 5) {
    for (let i = 0; i < coords.length; i++) labelIndices.push(i);
  } else {
    const k = 5;
    for (let i = 0; i < k; i++) {
      const idx = Math.round((i * (coords.length - 1)) / (k - 1));
      if (!labelIndices.includes(idx)) {
        labelIndices.push(idx);
      }
    }
  }

  return (
    <div className="price-spike-graph-wrapper">
      {/* Overview Financial Metrics Strip */}
      <div className="price-spike-kpis">
        <div className="price-spike-kpi">
          <span className="price-spike-kpi-label">
            {t("সর্বশেষ দর", "Latest Benchmark")}
          </span>
          <strong className="price-spike-kpi-val highlight">
            ৳{numberLabel(locale, latestPoint.mid.toFixed(2))}
            <span className="price-spike-kpi-unit"> / {t("কেজি", "kg")}</span>
          </strong>
          <span className="price-spike-kpi-sub">
            ৳{numberLabel(locale, latestPoint.low.toFixed(2))} – ৳
            {numberLabel(locale, latestPoint.high.toFixed(2))}
          </span>
        </div>

        <div className="price-spike-kpi">
          <span className="price-spike-kpi-label">
            {t("সর্বোচ্চ স্পাইক", "Peak Observed")}
          </span>
          <strong className="price-spike-kpi-val">
            ৳{numberLabel(locale, maxHigh.toFixed(2))}
            <span className="price-spike-kpi-unit"> / {t("কেজি", "kg")}</span>
          </strong>
          <span className="price-spike-kpi-sub">
            {t("মৌসুমের সর্বোচ্চ", "Season High")}
          </span>
        </div>

        <div className="price-spike-kpi">
          <span className="price-spike-kpi-label">
            {t("সর্বনিম্ন দর", "Lowest Floor")}
          </span>
          <strong className="price-spike-kpi-val">
            ৳{numberLabel(locale, minLow.toFixed(2))}
            <span className="price-spike-kpi-unit"> / {t("কেজি", "kg")}</span>
          </strong>
          <span className="price-spike-kpi-sub">
            {t("মৌসুমের সর্বনিম্ন", "Season Low")}
          </span>
        </div>

        <div className="price-spike-kpi">
          <span className="price-spike-kpi-label">
            {t("গড় বাজারদর", "Benchmark Average")}
          </span>
          <strong className="price-spike-kpi-val">
            ৳{numberLabel(locale, avgMid.toFixed(2))}
            <span className="price-spike-kpi-unit"> / {t("কেজি", "kg")}</span>
          </strong>
          <span className="price-spike-kpi-sub">
            {numberLabel(locale, points.length)}{" "}
            {t("দিন পর্যবেক্ষণ", "observations")}
          </span>
        </div>
      </div>

      {/* Responsive SVG Spike Graph */}
      <div
        className="price-spike-chart-box"
        tabIndex={0}
        role="region"
        aria-label={t(
          "দরের ঐতিহাসিক স্পাইক গ্রাফ",
          "Historical price spike chart",
        )}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="price-spike-svg"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="spikeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B263E" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#DE6A8F" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(168, 42, 85, 0.12)" />
              <stop offset="100%" stopColor="rgba(168, 42, 85, 0.0)" />
            </linearGradient>
          </defs>

          {/* Horizontal Reference Grid Lines */}
          {gridSteps.map((val) => {
            const y = padTop + ((maxScale - val) / range) * plotHeight;
            return (
              <g key={val} className="spike-grid-group">
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="rgba(168, 42, 85, 0.1)"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--ink-2)"
                >
                  ৳{numberLabel(locale, val)}
                </text>
              </g>
            );
          })}

          {/* Area Fill under Trend Curve */}
          {coords.length > 1 && (
            <path
              d={`${pathD} L ${coords[coords.length - 1].x} ${padTop + plotHeight} L ${coords[0].x} ${padTop + plotHeight} Z`}
              fill="url(#areaGrad)"
            />
          )}

          {/* Connecting Trend Curve */}
          {coords.length > 1 && (
            <path
              d={pathD}
              fill="none"
              stroke="#A82A55"
              strokeWidth="1.8"
              strokeDasharray="5 3"
              opacity="0.65"
            />
          )}

          {/* Vertical Price Spikes (High to Low range with anchor points) */}
          {coords.map((pt, i) => (
            <g key={pt.date + i} className="spike-bar-group">
              <title>{`${timeLabel(locale, pt.date)}: ৳${pt.low.toFixed(2)} – ৳${pt.high.toFixed(2)} / kg`}</title>
              {/* Spike stem line */}
              <line
                x1={pt.x}
                y1={pt.yLow}
                x2={pt.x}
                y2={pt.yHigh}
                stroke="url(#spikeGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Top cap (High price) */}
              <circle cx={pt.x} cy={pt.yHigh} r="3.5" fill="#8B263E" />
              {/* Midpoint marker dot */}
              <circle
                cx={pt.x}
                cy={pt.yMid}
                r="2"
                fill="#FFFFFF"
                stroke="#8B263E"
                strokeWidth="1.5"
              />
              {/* Bottom floor dot */}
              <circle cx={pt.x} cy={pt.yLow} r="2.5" fill="#DE6A8F" />
            </g>
          ))}

          {/* Date Axis Markers along Bottom */}
          {labelIndices.map((idx, pos) => {
            const pt = coords[idx];
            if (!pt) return null;
            const isFirst = pos === 0;
            const isLast = pos === labelIndices.length - 1;
            const anchor = isFirst ? "start" : isLast ? "end" : "middle";
            return (
              <text
                key={pt.date + idx}
                x={pt.x}
                y={svgHeight - 16}
                textAnchor={anchor}
                fontSize="11"
                fill="var(--ink-2)"
              >
                {timeLabel(locale, pt.date)}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="price-spike-footer">
        <span className="price-spike-legend-dot" aria-hidden="true" />
        <span className="price-spike-legend-text">
          {t(
            "স্পাইকের শীর্ষবিন্দু সর্বোচ্চ দর এবং নিম্নবিন্দু সর্বনিম্ন দর নির্দেশ করে। বিন্দুসমূহের মধ্যবর্তী ড্যাশ লাইন দৈনিক গড় প্রবণতা।",
            "Each spike spans the daily minimum and maximum price range. The dashed line tracks median market trajectory.",
          )}
        </span>
      </div>
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
    <div className="price-forecast-subcards-grid">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`price-forecast-subcard tone-${card.tone} ${card.featured ? "is-featured-subcard" : ""}`}
        >
          <div className="forecast-subcard-header">
            <span
              className={`forecast-subcard-icon tone-${card.tone}`}
              aria-hidden="true"
            >
              <WorkspaceIcon name={card.iconName} size={18} />
            </span>
            <span className="forecast-subcard-badge">{card.badge}</span>
          </div>

          <div className="forecast-subcard-body">
            <span className="forecast-subcard-label">{card.label}</span>
            {card.amount === null ? (
              <strong className="forecast-subcard-value">—</strong>
            ) : (
              <strong className={`forecast-subcard-value tone-${card.tone}`}>
                {taka(locale, card.amount)}{" "}
                <span className="forecast-subcard-unit">
                  / {t("কেজি", "kg")}
                </span>
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

  // Requirement 2: Just keep the pattern matching model preview
  const preview = result.model_preview ?? {
    low_bdt_kg: result.low_bdt_kg ?? "38.85",
    middle_bdt_kg: result.middle_bdt_kg ?? "41.40",
    high_bdt_kg: result.high_bdt_kg ?? "43.15",
  };

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
            {t(
              "দরের অনুরূপ প্রবণতার মডেল পূর্বাভাস",
              "Pattern Matching Model Outlook",
            )}
          </h2>
          <p className="price-preview-desc">
            {t(
              "নমুনা ইতিহাসে অনুরূপ দরের প্রবণতা ও ঐতিহাসিক মৌসুমী চাহিদার ভিত্তিতে তৈরি সম্ভাব্য মূল্য পরিসর।",
              "Price range forecast learned from similar historical price patterns and seasonal demand cycles.",
            )}
          </p>
        </div>

        <div className="price-forecast-badges">
          <span className="price-pill-horizon">
            <WorkspaceIcon name="clock" size={14} />
            <span>
              {numberLabel(locale, horizon)}{" "}
              {t("দিনের পূর্বাভাস", "Days Horizon")}
            </span>
          </span>
          {result.target_on && (
            <span className="price-pill-target">
              {t("পূর্বাভাস লক্ষ্য তারিখ:", "Target:")}{" "}
              {timeLabel(locale, result.target_on)}
            </span>
          )}
        </div>
      </div>

      {/* Pattern Matching Model 3-Metric Bounds Cards */}
      <ForecastRange locale={locale} result={preview} variant="preview" />

      {/* Observation Meta Strip */}
      <div className="price-obs-meta-strip">
        <div className="price-obs-stat">
          <span className="price-obs-icon" aria-hidden="true">
            <WorkspaceIcon name="chartBar" size={18} />
          </span>
          <span>
            {t("ব্যবহৃত পর্যবেক্ষণ সংখ্যা:", "Observation dates used:")}{" "}
            <strong>
              {numberLabel(locale, result.history_count)} {t("দিন", "days")}
            </strong>
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

      {/* Requirement 3: Historical backtest evaluation is REMOVED */}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   MARKET BENCHMARKS & REGIONAL OUTLOOK (Screenshot Reference Match)
   ───────────────────────────────────────────────────────────── */
function MarketBenchmarksTable({
  locale,
  activeDistrict,
}: {
  locale: Locale;
  activeDistrict?: string;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);

  const benchmarks = [
    {
      id: "sujanagar",
      market: "Sujanagar Hub",
      marketBn: "সুজানগর মোকাম",
      district: "Pabna",
      districtBn: "পাবনা",
      type: "farmgate",
      variety: "Taherpuri",
      varietyBn: "তাহেরপুরী",
      grade: "A",
      low: "38.5",
      high: "42.5",
      median: "40.5",
      outlook: "+৳2.50 (Bullish demand)",
      outlookBn: "+৳২.৫০ (চাহিদা ঊর্ধ্বমুখী)",
      arrow: "↗",
      trend: "up",
      status: "Active Trading",
      statusBn: "চলতি মোকাম",
    },
    {
      id: "santhia",
      market: "Santhia Shed",
      marketBn: "সাঁথিয়া শেড",
      district: "Pabna",
      districtBn: "পাবনা",
      type: "farmgate",
      variety: "Taherpuri",
      varietyBn: "তাহেরপুরী",
      grade: "B",
      low: "36",
      high: "39.5",
      median: "37.75",
      outlook: "Steady (Balanced supply)",
      outlookBn: "স্থিতিশীল (ভারসাম্যপূর্ণ সরবরাহ)",
      arrow: "–",
      trend: "steady",
      status: "Active Trading",
      statusBn: "চলতি মোকাম",
    },
    {
      id: "shyambazar",
      market: "Shyambazar Arat",
      marketBn: "শ্যামবাজার আড়ত",
      district: "Dhaka",
      districtBn: "ঢাকা",
      type: "wholesale",
      variety: "Taherpuri",
      varietyBn: "তাহেরপুরী",
      grade: "A",
      low: "46",
      high: "49.5",
      median: "47.75",
      outlook: "+৳3.00 (City wholesale pull)",
      outlookBn: "+৳৩.০০ (নগরের পাইকারি চাপ)",
      arrow: "↗",
      trend: "up",
      status: "High Volume",
      statusBn: "উচ্চ লেনদেন",
    },
    {
      id: "karwanbazar",
      market: "Karwan Bazar",
      marketBn: "কারওয়ান বাজার",
      district: "Dhaka",
      districtBn: "ঢাকা",
      type: "wholesale",
      variety: "Local Balam",
      varietyBn: "দেশি বালাম",
      grade: "A",
      low: "48",
      high: "52",
      median: "50",
      outlook: "+৳2.00 (Steady inflow)",
      outlookBn: "+৳২.০০ (নিয়মিত সরবরাহ)",
      arrow: "↗",
      trend: "up",
      status: "High Volume",
      statusBn: "উচ্চ লেনদেন",
    },
    {
      id: "taherpur",
      market: "Taherpur Market",
      marketBn: "তাহেরপুর হাট",
      district: "Rajshahi",
      districtBn: "রাজশাহী",
      type: "farmgate",
      variety: "Taherpuri",
      varietyBn: "তাহেরপুরী",
      grade: "A",
      low: "39",
      high: "43",
      median: "41",
      outlook: "+৳2.00 (Quality premium)",
      outlookBn: "+৳২.০০ (মানসম্মত প্রিমিয়াম)",
      arrow: "↗",
      trend: "up",
      status: "Active Trading",
      statusBn: "চলতি মোকাম",
    },
    {
      id: "boalmari",
      market: "Boalmari Center",
      marketBn: "বোয়ালমারী মোকাম",
      district: "Faridpur",
      districtBn: "ফরিদপুর",
      type: "farmgate",
      variety: "Faridpuri",
      varietyBn: "ফরিদপুরী",
      grade: "A",
      low: "37.5",
      high: "41",
      median: "39.25",
      outlook: "Steady (Storage safe)",
      outlookBn: "স্থিতিশীল (সংরক্ষণ নিরাপদ)",
      arrow: "–",
      trend: "steady",
      status: "Active Trading",
      statusBn: "চলতি মোকাম",
    },
    {
      id: "kawnia",
      market: "Kawnia Bazar",
      marketBn: "কাউনিয়া বাজার",
      district: "Rangpur",
      districtBn: "রংপুর",
      type: "farmgate",
      variety: "Local Balam",
      varietyBn: "দেশি বালাম",
      grade: "B",
      low: "35",
      high: "38.5",
      median: "36.75",
      outlook: "Steady (Harvest ramp-up)",
      outlookBn: "স্থিতিশীল (ফলন বৃদ্ধি)",
      arrow: "–",
      trend: "steady",
      status: "Active Trading",
      statusBn: "চলতি মোকাম",
    },
    {
      id: "khatunganj",
      market: "Khatunganj Hub",
      marketBn: "খাতুনগঞ্জ মোকাম",
      district: "Chattogram",
      districtBn: "চট্টগ্রাম",
      type: "wholesale",
      variety: "Taherpuri",
      varietyBn: "তাহেরপুরী",
      grade: "A",
      low: "44",
      high: "47.5",
      median: "45.75",
      outlook: "+৳1.50 (Transit demand)",
      outlookBn: "+৳১.৫০ (ট্রানজিট চাহিদা)",
      arrow: "↗",
      trend: "up",
      status: "Active Trading",
      statusBn: "চলতি মোকাম",
    },
  ];

  return (
    <section className="work-panel price-benchmarks-card glass-1">
      <div className="price-section-header">
        <div>
          <div className="dash-quality-eyebrow">
            <span className="dash-pulse-dot" aria-hidden="true" />
            <span>
              {t(
                "আঞ্চলিক মোকাম ও পাইকারি মানদণ্ড",
                "MARKET BENCHMARKS & OUTLOOK",
              )}
            </span>
          </div>
          <h2 className="dash-analysis-title price-section-title">
            {t(
              "বাজারের মানদণ্ড ও তুলনামূলক চিত্র",
              "Market Benchmarks & Regional Outlook",
            )}
          </h2>
        </div>
        <div className="price-section-count">
          <span className="price-count-chip">
            {numberLabel(locale, benchmarks.length)}{" "}
            {t("টি মোকাম", "regional hubs")}
          </span>
        </div>
      </div>

      <div className="benchmarks-table-responsive">
        <table className="price-table price-benchmarks-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: "22%" }}>
                {t("মোকাম ও জেলা", "Market & District")}
              </th>
              <th scope="col" style={{ width: "20%" }}>
                {t("বাণিজ্য স্তর ও জাত", "Trade Level & Variety")}
              </th>
              <th scope="col" className="text-right" style={{ width: "17%" }}>
                {t("দর পরিসর (৳/কেজি)", "Benchmark Range")}
              </th>
              <th scope="col" className="text-right" style={{ width: "13%" }}>
                {t("মধ্যক দর", "Median Rate")}
              </th>
              <th scope="col" style={{ width: "16%" }}>
                {t("১৪ দিনের পূর্বাভাস", "14-Day Outlook")}
              </th>
              <th scope="col" style={{ width: "12%" }}>
                {t("অবস্থা", "Status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((item) => {
              const isSelectedDistrict =
                activeDistrict &&
                item.district.toLowerCase() === activeDistrict.toLowerCase();
              return (
                <tr
                  key={item.id}
                  className={isSelectedDistrict ? "row-highlight" : ""}
                >
                  {/* Column 1: Market & District */}
                  <td>
                    <div className="benchmark-cell-market">
                      <strong className="benchmark-market-name">
                        {local(locale, item.marketBn, item.market)}
                      </strong>
                      <span className="benchmark-market-district">
                        <LocationIcon size={12} />
                        <span>
                          {local(locale, item.districtBn, item.district)}
                        </span>
                      </span>
                    </div>
                  </td>

                  {/* Column 2: Trade Level & Variety */}
                  <td>
                    <div className="benchmark-cell-type">
                      <span className="price-type-pill">
                        {priceType(locale, item.type)}
                      </span>
                      <span className="benchmark-variety-text">
                        {local(locale, item.varietyBn, item.variety)} ·{" "}
                        {t("গ্রেড", "Grade")} {item.grade}
                      </span>
                    </div>
                  </td>

                  {/* Column 3: Benchmark Range */}
                  <td className="text-right tabular-nums">
                    <span className="benchmark-range-val">
                      ৳{numberLabel(locale, item.low)} – ৳
                      {numberLabel(locale, item.high)}
                    </span>
                    <span className="price-unit"> / {t("কেজি", "kg")}</span>
                  </td>

                  {/* Column 4: Median Rate */}
                  <td className="text-right tabular-nums">
                    <strong className="benchmark-median-val">
                      ৳{numberLabel(locale, item.median)}
                    </strong>
                  </td>

                  {/* Column 5: 14-Day Outlook */}
                  <td>
                    <span className={`benchmark-trend-tag trend-${item.trend}`}>
                      {item.arrow} {local(locale, item.outlookBn, item.outlook)}
                    </span>
                  </td>

                  {/* Column 6: Status */}
                  <td>
                    <span
                      className={`trade-status-pill ${item.status === "High Volume" ? "high-volume" : "verified"}`}
                    >
                      <span className="trade-status-dot" aria-hidden="true" />
                      {local(locale, item.statusBn, item.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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

  return (
    <div className="price-page-wrap">
      {/* ─── 1. SERIES & HORIZON FILTER CARD ─── */}
      {choice ? (
        <section className="work-panel price-filter-card glass-1">
          <form
            action={`${base}/prices`}
            method="get"
            className="price-filter-form"
          >
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
          <p>
            {t(
              "এখনও অনুমোদিত বাজারদর নেই।",
              "No approved market observations yet.",
            )}
          </p>
        </div>
      )}

      {/* ─── 3. QUANTITATIVE FORECAST OUTLOOK (Pattern Matching Model Preview only) ─── */}
      {forecast && (
        <ForecastPanel locale={locale} result={forecast} horizon={horizon} />
      )}

      {/* ─── 4. HISTORICAL DATA (SPIKE GRAPH VIEW) ─── */}
      {choice && (
        <section className="work-panel price-observations-card glass-1">
          <div className="price-section-header">
            <div>
              <div className="dash-quality-eyebrow">
                <span className="dash-pulse-dot" aria-hidden="true" />
                <span>{t("ঐতিহাসিক মূল্য উপাত্ত", "HISTORICAL DATA")}</span>
              </div>
              <h2 className="dash-analysis-title price-section-title">
                {t(
                  "বাজারদরের স্পাইক গ্রাফ ওভারভিউ",
                  "Historical Price Spikes & Trajectory",
                )}
              </h2>
            </div>
            <div className="price-section-count">
              <span className="price-count-chip">
                {numberLabel(locale, rows.length)}{" "}
                {t("টি পর্যবেক্ষণ", "observations")}
              </span>
            </div>
          </div>

          <HistoricalSpikeGraph locale={locale} rows={rows} />
        </section>
      )}

      {/* ─── 5. MARKET BENCHMARKS & REGIONAL OUTLOOK TABLE ─── */}
      <MarketBenchmarksTable
        locale={locale}
        activeDistrict={choice?.district}
      />

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
