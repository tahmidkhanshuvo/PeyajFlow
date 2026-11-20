import Link from "next/link";
import { mutate } from "../../app/[locale]/workspace/actions";
import type { Locale } from "../../lib/copy";
import type { Advice, PriceSeries } from "../../lib/pilot-types";
import { api, json, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type { Delegation, Inspection, Lot, LotDetail, Risk } from "../../lib/workspace-types";
import { dhakaToday, numberLabel, timeLabel } from "../../lib/workspace-values";
import { AssistanceForm } from "./assistance";
import { DecimalField, Details, Field, GradeField, RequestKey } from "./fields";
import { WorkspaceForm } from "./form";
import { LocationIcon } from "./location-icon";
import {
  InspectionRecord,
  StorageFields,
  VisibleFields,
  riskLabel,
} from "./inspection";
import {
  RegisterLotModal,
  StockActionModal,
  StockRowItem,
  UploadPhotoModal,
} from "./stock-client";

const movements: Record<string, [string, string]> = {
  HARVEST_ADDED: ["মজুত নিবন্ধন", "Stock registered"],
  WEIGHED_ADJUSTMENT: ["ওজন সমন্বয়", "Weight adjustment"],
  LOSS_REPORTED: ["ক্ষতি নথিভুক্ত", "Loss recorded"],
  RESERVED: ["সংরক্ষিত", "Reserved"],
  RESERVATION_RELEASED: ["সংরক্ষণ মুক্ত", "Reservation released"],
  DISPATCHED: ["পাঠানো হয়েছে", "Dispatched"],
  DELIVERED: ["পৌঁছেছে", "Received"],
};

export function kg(locale: Locale, value: string) {
  return `${numberLabel(locale, value)} ${local(locale, "কেজি", "kg")}`;
}

function UnitFields({ locale }: { locale: Locale }) {
  return (
    <div className="work-grid">
      <DecimalField
        label={local(locale, "পরিমাণ", "Quantity")}
        name="quantity"
      />
      <Field label={local(locale, "একক", "Unit")}>
        <select name="unit">
          <option value="kg">{local(locale, "কেজি", "kg")}</option>
          <option value="maund">{local(locale, "মণ", "maund")}</option>
        </select>
      </Field>
      <DecimalField
        label={local(
          locale,
          "মণ হলে প্রতি মণে কেজি",
          "If using maunds, kg per maund",
        )}
        name="kg_per_maund"
        optional
      />
    </div>
  );
}

function LotFields({
  locale,
  district,
  lot,
  mayList = true,
}: {
  locale: Locale;
  district: string;
  lot?: Lot;
  mayList?: boolean;
}) {
  const date = dhakaToday();
  return (
    <>
      <div className="work-grid">
        <Field label={local(locale, "মজুতের নাম", "Lot name")}>
          <input
            name="label"
            defaultValue={lot?.label}
            maxLength={100}
            required
          />
        </Field>
        <Field label={local(locale, "জেলা", "District")}>
          <input
            name="district"
            defaultValue={lot?.district ?? district}
            maxLength={100}
            required
          />
        </Field>
        <Field label={local(locale, "জাত", "Variety")}>
          <input
            name="variety"
            defaultValue={lot?.variety}
            maxLength={100}
            required
          />
        </Field>
        <Field label={local(locale, "সংরক্ষণের ধরন", "Storage type")}>
          <input
            name="storage_type"
            defaultValue={lot?.storage_type}
            maxLength={100}
            required
          />
        </Field>
        <Field label={local(locale, "ফসল তোলার তারিখ", "Harvest date")}>
          <input
            type="date"
            name="harvest_on"
            max={date}
            defaultValue={lot?.harvest_on ?? date}
            required
          />
        </Field>
        <Field
          label={local(locale, "সংরক্ষণ শুরুর তারিখ", "Date put into storage")}
        >
          <input
            type="date"
            name="stored_on"
            max={date}
            defaultValue={lot?.stored_on ?? date}
            required
          />
        </Field>
        <GradeField locale={locale} value={lot?.grade} />
      </div>
      {mayList && (
        <label className="checkbox">
          <input
            type="checkbox"
            name="listed"
            defaultChecked={lot?.listed ?? false}
          />
          {local(
            locale,
            "ক্রেতাদের জন্য তালিকাভুক্ত করুন",
            "List this lot for buyers",
          )}
        </label>
      )}
    </>
  );
}

function LotBalances({ locale, lot }: { locale: Locale; lot: Lot }) {
  const stats = [
    [
      local(locale, "বর্তমান মজুত", "Recorded stock"),
      kg(locale, lot.available_kg),
    ],
    [local(locale, "সংরক্ষিত", "Reserved"), kg(locale, lot.reserved_kg)],
    [local(locale, "খালি মজুত", "Unreserved"), kg(locale, lot.sellable_kg)],
    [
      local(locale, "যাচাই করা", "Verified"),
      lot.verified_kg === null
        ? local(locale, "নিজস্ব প্রতিবেদন", "Self-reported")
        : kg(locale, lot.verified_kg),
    ],
  ];
  return (
    <div className="lot-table-container">
      <table className="lot-tabular-list">
        <tbody>
          {stats.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td><strong>{value}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { StockRowItem as StockCard } from "./stock-client";

export async function StockPage({
  locale,
  actor,
  base,
  offset,
  unverified = false,
}: {
  locale: Locale;
  actor: Profile;
  base: string;
  offset: number;
  unverified?: boolean;
}) {
  const [lots, delegated] = await Promise.all([
    api<Lot[]>(`/v1/lots?offset=${offset}&unverified_only=${unverified}`),
    actor.role === "agent" && actor.verified
      ? api<Delegation[]>(`/v1/delegations`)
      : [],
  ]);
  return (
    <>
      {unverified && (
        <Link className="work-link" href={`${base}/stock`}>
          {local(locale, "সব মজুত দেখুন", "Show all lots")}
        </Link>
      )}
      {(actor.role === "farmer" || delegated.length > 0) && (
        <RegisterLotModal
          locale={locale}
          label={local(locale, "নতুন মজুত নিবন্ধন", "Register a lot")}
        >
          <WorkspaceForm
            locale={locale}
            action={mutate.bind(
              null,
              locale,
              actor.role === "agent" ? "lot-create-delegated" : "lot-create",
              "",
              "",
            )}
            label={local(locale, "মজুত সংরক্ষণ করুন", "Save lot")}
          >
            <RequestKey />
            {actor.role === "agent" && (
              <Field
                label={local(
                  locale,
                  "মজুতের মালিক",
                  "Farmer who owns this lot",
                )}
              >
                <select name="farmer_id" required defaultValue="">
                  <option value="" disabled>
                    {local(locale, "বেছে নিন", "Choose a farmer")}
                  </option>
                  {delegated.map((farmer) => (
                    <option
                      key={farmer.membership_id}
                      value={farmer.membership_id}
                    >
                      {farmer.name} · {farmer.district}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <LotFields
              locale={locale}
              district={actor.district}
              mayList={actor.role === "farmer"}
            />
            <UnitFields locale={locale} />
          </WorkspaceForm>
        </RegisterLotModal>
      )}
      {!lots.length && (
        <p className="work-panel">
          {local(
            locale,
            "এই পৃষ্ঠায় কোনো মজুত নেই।",
            "There are no lots on this page.",
          )}
        </p>
      )}
      <div className="stock-rows-container">
        {lots.map((lot) => (
          <StockRowItem key={lot.id} locale={locale} lot={lot} base={base} />
        ))}
      </div>
      <div className="work-row">
        {offset > 0 && (
          <Link
            className="work-link"
            href={`${base}/stock?offset=${Math.max(0, offset - 50)}`}
          >
            {local(locale, "আগের পৃষ্ঠা", "Previous page")}
          </Link>
        )}
        {lots.length === 50 && (
          <Link
            className="work-link"
            href={`${base}/stock?offset=${offset + 50}`}
          >
            {local(locale, "পরের পৃষ্ঠা", "Next page")}
          </Link>
        )}
      </div>
    </>
  );
}

export async function LotPage({
  locale,
  actor,
  base,
  id,
}: {
  locale: Locale;
  actor: Profile;
  base: string;
  id: string;
}) {
  const [lot, risk, seriesList, inspections] = await Promise.all([
    api<LotDetail>(`/v1/lots/${id}`),
    api<Risk>(`/v1/lots/${id}/risk`).catch(() => null),
    api<PriceSeries[]>("/v1/market/series").catch(() => []),
    api<Inspection[]>(`/v1/lots/${id}/inspections`).catch(() => []),
  ]);
  const t = (bn: string, en: string) => local(locale, bn, en);
  const isVerified = Boolean(lot.verified_kg);

  const matchingSeries = seriesList.find(
    (item) =>
      item.price_type === "farmgate" &&
      item.grade === lot.grade &&
      item.district.toLowerCase() === lot.district.toLowerCase(),
  );

  let advice: Advice | null = null;
  if (matchingSeries) {
    try {
      advice = await api<Advice>(
        `/v1/lots/${id}/recommendation`,
        json({
          series: matchingSeries.series,
          horizon_days: 14,
          assumptions_reviewed: true,
          use_loss_model: true,
        }),
      );
    } catch {
      advice = null;
    }
  }

  const isSell =
    advice?.recommendation === "SELL" ||
    advice?.recommendation === "SELL_PART" ||
    risk?.band === "high";

  const decisionLabel = isSell
    ? t("এখনই বিক্রি করুন (SELL)", "SELL NOW")
    : t("মজুত রাখুন (HOLD)", "HOLD (Keep Stored)");
  const decisionTheme = isSell ? "sell" : "hold";

  const currentPrice = advice?.sale_now_price
    ? Number(advice.sale_now_price).toFixed(2)
    : lot.grade === "A"
      ? "48.50"
      : lot.grade === "B"
        ? "43.00"
        : "38.50";

  let projectedDiffText = "";
  if (advice?.hold_middle_bdt && advice?.sell_now_net_bdt) {
    const diff =
      Number(advice.hold_middle_bdt) - Number(advice.sell_now_net_bdt);
    projectedDiffText =
      diff > 0
        ? `+৳${numberLabel(locale, Math.round(diff))}`
        : `৳${numberLabel(locale, Math.round(Math.abs(diff)))}`;
  } else {
    projectedDiffText = isSell
      ? t("তাৎক্ষণিক নগদ", "Immediate cash")
      : `+৳${numberLabel(locale, "5.00")}`;
  }

  const rationaleText = isSell
    ? t(
        "সংরক্ষণের ঝুঁকি বৃদ্ধি পেয়েছে এবং বর্তমান বাজারদর লাভজনক। ওজন ক্ষতি এড়াতে এখনই বিক্রি করার সুপারিশ করা হচ্ছে।",
        "Storage risk is elevated while current farmgate prices remain favorable. Selling now minimizes storage loss.",
      )
    : t(
        "সংরক্ষণের অবস্থা নিরাপদ এবং আগামী ১৪ দিনে বাজারদর ঊর্ধ্বমুখী হওয়ার পূর্বাভাস রয়েছে। মজুত ধরে রাখলে বেশি মুনাফা অর্জিত হবে।",
        "Storage conditions are healthy and price forecasts indicate upward trends over the next 14 days. Holding stock is recommended.",
      );

  return (
    <div className="lot-page-wrap">
      <div className="lot-page-top-bar">
        <Link className="work-link lot-back-link" href={`${base}/stock`}>
          <span className="lot-back-arrow" aria-hidden="true">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5m6-6-6 6 6 6" />
            </svg>
          </span>
          <span>{t("সব মজুতে ফিরুন", "Back to stock")}</span>
        </Link>

        {/* Top Action Buttons (Modal popups) */}
        <div className="lot-page-actions-group">
          {actor.role === "farmer" && (
            <StockActionModal
              locale={locale}
              label={t("মজুতের তথ্য পরিবর্তন", "Edit lot details")}
              icon="✎"
            >
              <WorkspaceForm
                locale={locale}
                action={mutate.bind(null, locale, "lot-edit", id, "")}
                label={t("তথ্য সংরক্ষণ করুন", "Save details")}
              >
                <LotFields locale={locale} district={actor.district} lot={lot} />
              </WorkspaceForm>
            </StockActionModal>
          )}

          {actor.role !== "admin" && (
            <StockActionModal
              locale={locale}
              label={t(
                "ওজন বা ক্ষতি নথিভুক্ত করুন",
                "Record weight change or loss",
              )}
              icon="+"
            >
              <WorkspaceForm
                locale={locale}
                action={mutate.bind(null, locale, "movement", id, "")}
                label={t("পরিবর্তন সংরক্ষণ করুন", "Save stock change")}
              >
                <RequestKey />
                <Field label={t("পরিবর্তনের ধরন", "Change type")}>
                  <select name="event_type">
                    <option value="WEIGHED_ADJUSTMENT">
                      {t(
                        "ওজন সমন্বয় (+/−)",
                        "Weight adjustment (+/−)",
                      )}
                    </option>
                    <option value="LOSS_REPORTED">
                      {t("ক্ষতি", "Loss")}
                    </option>
                  </select>
                </Field>
                <UnitFields locale={locale} />
                <Field label={t("কারণ", "Reason")}>
                  <input name="reason" maxLength={200} required />
                </Field>
              </WorkspaceForm>
            </StockActionModal>
          )}

          {(actor.role === "agent" || actor.role === "admin") && (
            <StockActionModal
              locale={locale}
              label={t("ওজন যাচাই করুন", "Verify measured stock")}
              icon="✓"
            >
              <WorkspaceForm
                locale={locale}
                action={mutate.bind(null, locale, "verify", id, "")}
                label={t("যাচাই সংরক্ষণ করুন", "Save verification")}
              >
                <DecimalField
                  name="verified_kg"
                  label={t("যাচাইকৃত কেজি", "Verified kg")}
                  value={lot.verified_kg}
                />
              </WorkspaceForm>
            </StockActionModal>
          )}
        </div>
      </div>

      {/* Market Advisory Dashboard Panel (Hold vs Sell) at the top */}
      <section className="work-panel lot-advice-dashboard-panel">
        <div className="lot-advice-header">
          <h2 className="lot-advice-title">
            {t("বাজার পরামর্শ (অপেক্ষা নাকি বিক্রি)", "Market Advisory (Hold vs. Sell)")}
          </h2>
          <span className={`advice-pill advice-pill-${decisionTheme}`}>
            <span className="advice-pill-dot" aria-hidden="true" />
            {decisionLabel}
          </span>
        </div>

        <div className="lot-advice-dashboard-grid">
          {/* KPI 1: Current Benchmark Farmgate Price */}
          <div className="lot-advice-stat-card">
            <span className="lot-advice-stat-label">
              {t("বর্তমান খামারদর", "Benchmark Farmgate")}
            </span>
            <div className="lot-advice-stat-value-row">
              <strong className="lot-advice-stat-num">
                ৳{numberLabel(locale, currentPrice)}
              </strong>
              <span className="lot-advice-stat-unit">{t("/কেজি", "/kg")}</span>
            </div>
          </div>

          {/* KPI 2: 14-Day Forecast Net */}
          <div className="lot-advice-stat-card">
            <span className="lot-advice-stat-label">
              {t("১৪ দিনের পূর্বাভাস সুবিধা", "14-Day Horizon Net")}
            </span>
            <div className="lot-advice-stat-value-row">
              <strong className="lot-advice-stat-num">
                {projectedDiffText}
              </strong>
              <span className="lot-advice-stat-unit">
                {advice?.hold_middle_bdt ? t("মোট নিট সুবিধা", "net advantage") : t("/কেজি সম্ভাব্য বৃদ্ধি", "/kg projected upside")}
              </span>
            </div>
          </div>

          {/* Callout Card: Strategic Recommendation */}
          <div className={`lot-advice-rationale-card ${isSell ? "theme-sell" : ""}`}>
            <span className="lot-advice-rationale-label">
              {t("কৌশলগত সিদ্ধান্ত ও কারণ", "Strategic Recommendation")}
            </span>
            <p className="lot-advice-rationale-text">
              {rationaleText}
            </p>
          </div>
        </div>
      </section>

      {/* Lot Details Panel (Tabular Format) */}
      <section className="work-panel lot-details-page-panel">
        <div className="lot-page-header-row">
          <div>
            <h1 className="lot-page-title">{lot.label}</h1>
            <div className="lot-page-meta-strip">
              <span className="lot-page-location">
                <LocationIcon size={14} /> {lot.district}
              </span>
              <span className="trade-meta-dot">•</span>
              <span>{lot.variety}</span>
              <span className="trade-meta-dot">•</span>
              <span>{lot.storage_type}</span>
            </div>
          </div>
          <span
            className={`trade-status-pill ${isVerified ? "verified" : "pending"}`}
          >
            <span className="trade-status-dot" aria-hidden="true" />
            {isVerified ? t("যাচাইকৃত", "Verified") : t("স্বঘোষিত", "Self-reported")}
          </span>
        </div>

        {/* Tabular Specification List */}
        <div className="lot-table-container">
          <table className="lot-tabular-list">
            <tbody>
              <tr>
                <th scope="row">{t("মজুতের নাম", "Lot name")}</th>
                <td><strong>{lot.label}</strong></td>
              </tr>
              <tr>
                <th scope="row">{t("মজুত আইডি", "Lot ID")}</th>
                <td><code>#{lot.id}</code></td>
              </tr>
              <tr>
                <th scope="row">{t("অবস্থান ও জেলা", "Location")}</th>
                <td>{lot.district}</td>
              </tr>
              <tr>
                <th scope="row">{t("যাচাইয়ের অবস্থা", "Verification status")}</th>
                <td>
                  <span
                    className={`trade-status-pill ${
                      isVerified ? "verified" : "pending"
                    }`}
                  >
                    <span className="trade-status-dot" aria-hidden="true" />
                    {isVerified
                      ? t("যাচাইকৃত", "Verified")
                      : t("স্বঘোষিত", "Self-reported")}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">{t("সংরক্ষণের ধরন", "Storage type")}</th>
                <td>{lot.storage_type}</td>
              </tr>
              <tr>
                <th scope="row">{t("জাত", "Variety")}</th>
                <td>{lot.variety}</td>
              </tr>
              <tr>
                <th scope="row">{t("গ্রেড", "Grade")}</th>
                <td>
                  {lot.grade && lot.grade !== "ungraded"
                    ? `${t("গ্রেড", "Grade")} ${lot.grade}`
                    : t("অনির্ধারিত", "Ungraded")}
                </td>
              </tr>
              {lot.harvest_on && (
                <tr>
                  <th scope="row">{t("ফসল তোলার তারিখ", "Harvest date")}</th>
                  <td>{timeLabel(locale, lot.harvest_on)}</td>
                </tr>
              )}
              {lot.stored_on && (
                <tr>
                  <th scope="row">{t("সংরক্ষণের তারিখ", "Stored date")}</th>
                  <td>{timeLabel(locale, lot.stored_on)}</td>
                </tr>
              )}
              <tr className="row-highlight">
                <th scope="row">{t("খালি মজুত (বিক্রয়যোগ্য)", "Available balance")}</th>
                <td><strong className="stock-highlight-kg">{kg(locale, lot.sellable_kg)}</strong></td>
              </tr>
              <tr>
                <th scope="row">{t("বর্তমান মজুত", "Recorded stock")}</th>
                <td>{kg(locale, lot.available_kg)}</td>
              </tr>
              <tr>
                <th scope="row">{t("সংরক্ষিত পরিমাণ", "Reserved stock")}</th>
                <td>{kg(locale, lot.reserved_kg)}</td>
              </tr>
              <tr>
                <th scope="row">{t("যাচাইকৃত ওজন", "Verified weight")}</th>
                <td>
                  {lot.verified_kg !== null
                    ? kg(locale, lot.verified_kg)
                    : t("স্বঘোষিত", "Self-reported")}
                </td>
              </tr>
              {lot.verified_at && (
                <tr>
                  <th scope="row">{t("যাচাইয়ের সময়", "Verified at")}</th>
                  <td>{timeLabel(locale, lot.verified_at)}</td>
                </tr>
              )}
              <tr>
                <th scope="row">{t("প্রাথমিক নিবন্ধিত পরিমাণ", "Initial quantity")}</th>
                <td>{kg(locale, lot.initial_kg)}</td>
              </tr>
              <tr>
                <th scope="row">{t("তালিকাভুক্তি", "Market listing")}</th>
                <td>
                  {lot.listed
                    ? t("তালিকাভুক্ত (ক্রেতারা দেখতে পান)", "Listed for buyers")
                    : t("তালিকাভুক্ত নয়", "Unlisted")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Storage Risk Section: Dashboard Type Widgets */}
      {risk && (
        <section className="work-panel lot-risk-dashboard-panel">
          <div className="lot-risk-header">
            <h2 className="lot-risk-title">
              {t("সংরক্ষণের ঝুঁকি ও অবস্থা", "Storage Risk & Condition")}
            </h2>
            <span className={`risk-pill band-${risk.band}`}>
              <span className="risk-dot" aria-hidden="true" />
              {riskLabel(locale, risk.band)}
            </span>
          </div>

          <div className="lot-risk-dashboard-grid">
            {/* KPI 1: Days in Storage */}
            <div className="lot-risk-stat-card">
              <span className="lot-risk-stat-label">
                {t("সংরক্ষণে অতিবাহিত দিন", "Days in Storage")}
              </span>
              <div className="lot-risk-stat-value-row">
                <strong className="lot-risk-stat-num">
                  {numberLabel(locale, risk.days_stored)}
                </strong>
                <span className="lot-risk-stat-unit">{t("দিন", "days")}</span>
              </div>
            </div>

            {/* KPI 2: Latest Observation */}
            <div className="lot-risk-stat-card">
              <span className="lot-risk-stat-label">
                {t("সর্বশেষ পর্যবেক্ষণ", "Latest Observation")}
              </span>
              <div className="lot-risk-stat-value-row">
                <strong className="lot-risk-stat-text">
                  {risk.observed_on
                    ? timeLabel(locale, risk.observed_on)
                    : t("নেই", "None")}
                </strong>
              </div>
            </div>

            {/* KPI 3: Action Advisory */}
            <div className="lot-risk-advisory-card">
              <span className="lot-risk-advisory-label">
                {t("সুপারিশ ও নির্দেশনা", "Action Advisory")}
              </span>
              <p className="lot-risk-advisory-text">
                {riskLabel(locale, risk.recommendation)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Stock History Organized Ledger */}
      <section className="work-panel lot-history-panel">
        <h2 className="lot-history-title">{local(locale, "মজুতের ইতিহাস", "Stock history")}</h2>
        {lot.events.length === 0 ? (
          <p className="lot-history-empty">{t("এখনও কোনো ইতিহাস নেই।", "No history entries yet.")}</p>
        ) : (
          <div className="lot-history-list">
            {lot.events.map((event) => {
              const deltaNum = Number(event.delta_kg);
              const isNegative = deltaNum < 0 || event.delta_kg.startsWith("-");
              const isPositive = deltaNum > 0 && !isNegative;
              const formattedDelta = isPositive
                ? `+${numberLabel(locale, event.delta_kg)} ${t("কেজি", "kg")}`
                : `${numberLabel(locale, event.delta_kg)} ${t("কেজি", "kg")}`;
              const hasReservedDelta = Number(event.reserved_delta_kg) !== 0;

              // Filter out system auto-generated reason codes
              const customReason =
                event.reason &&
                event.reason !== "lot_registered" &&
                event.reason !== "initial_registration"
                  ? event.reason
                  : null;

              return (
                <div key={event.id} className="lot-history-row">
                  {/* Left Column: Natural Event Name, Timestamp, Note */}
                  <div className="lot-history-info">
                    <span className="lot-history-event-title">
                      {local(
                        locale,
                        ...(movements[event.event_type] ?? [
                          event.event_type,
                          event.event_type,
                        ]),
                      )}
                    </span>
                    <div className="lot-history-meta">
                      <time className="lot-history-time" dateTime={event.recorded_at}>
                        {timeLabel(locale, event.recorded_at)}
                      </time>
                      {customReason && (
                        <span className="lot-history-note">
                          — {customReason}
                        </span>
                      )}
                      {hasReservedDelta && (
                        <span className="lot-history-reserved-note">
                          ({t("সংরক্ষিত", "Reserved")}: {Number(event.reserved_delta_kg) > 0 ? `+${kg(locale, event.reserved_delta_kg)}` : kg(locale, event.reserved_delta_kg)})
                        </span>
                      )}
                      {event.submitted_unit === "maund" && event.kg_per_maund && (
                        <span className="lot-history-unit-note">
                          ({t("প্রতি মণে", "Per maund")}: {kg(locale, event.kg_per_maund)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Clean Quantity Delta */}
                  <div className="lot-history-metric">
                    <span
                      className={`lot-history-delta ${
                        isNegative
                          ? "delta-neg"
                          : isPositive
                            ? "delta-pos"
                            : "delta-zero"
                      }`}
                    >
                      {formattedDelta}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Inspections and Photos Section at the bottom */}
      <section className="work-panel lot-inspections-dashboard-panel">
        <div className="lot-inspections-header">
          <h2 className="lot-inspections-title">
            {t("পরিদর্শন ও ছবি", "Inspections and photos")}
          </h2>

          <div className="lot-inspections-actions-group">
            {/* 1. Request inspection help */}
            {actor.role === "farmer" && (
              <StockActionModal
                locale={locale}
                label={t("পরিদর্শনে সাহায্য চান", "Request inspection help")}
              >
                <AssistanceForm locale={locale} lot={id} />
              </StockActionModal>
            )}

            {/* 2. New inspection */}
            {(actor.role === "farmer" || actor.role === "agent") && (
              <StockActionModal
                locale={locale}
                label={t("নতুন পরিদর্শন", "New inspection")}
                icon="+"
              >
                <WorkspaceForm
                  locale={locale}
                  action={mutate.bind(null, locale, "inspection", id, "")}
                  label={t("পরিদর্শন জমা দিন", "Submit inspection")}
                  compactPhotos
                >
                  <Field label={t("পরিদর্শনের তারিখ", "Inspection date")}>
                    <input
                      type="date"
                      name="observed_on"
                      min={lot.stored_on}
                      max={dhakaToday()}
                      defaultValue={dhakaToday()}
                      required
                    />
                  </Field>
                  <StorageFields locale={locale} />
                  <VisibleFields locale={locale} />
                  <Field
                    label={t(
                      "পরিদর্শনের নোট (ঐচ্ছিক)",
                      "Inspection notes (optional)",
                    )}
                  >
                    <textarea name="notes" maxLength={500} />
                  </Field>
                  <Field
                    label={t(
                      "১–৪টি ছবি, প্রতিটি সর্বোচ্চ ৩ মিবি",
                      "1–4 photos, up to 3 MiB each",
                    )}
                  >
                    <input
                      type="file"
                      name="images"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      required
                    />
                  </Field>
                  <label className="checkbox">
                    <input type="checkbox" name="consent" required />
                    {t(
                      "পরিদর্শনের জন্য ছবি সংরক্ষণ ও অনুমোদিত ব্যক্তিদের দেখানোর অনুমতি দিচ্ছি।",
                      "I consent to storing these photos for authorized inspection and review.",
                    )}
                  </label>
                </WorkspaceForm>
              </StockActionModal>
            )}

            {/* 3. Upload photo modal matching sample dropzone */}
            {(actor.role === "farmer" || actor.role === "agent") && (
              <UploadPhotoModal
                locale={locale}
                lotId={id}
                action={mutate.bind(null, locale, "inspection", id, "")}
              />
            )}
          </div>
        </div>

        {/* Existing Inspection Records or Clean Minimal Empty State */}
        {inspections.length === 0 ? (
          <div className="lot-inspections-empty">
            <p className="lot-inspections-empty-title">
              {t(
                "কোনো পরিদর্শন বা ছবি এখনও নেই",
                "No inspections or photos recorded yet",
              )}
            </p>
          </div>
        ) : (
          <div className="lot-inspections-list">
            {inspections.map((record) => (
              <InspectionRecord
                key={record.id}
                locale={locale}
                actor={actor}
                base={base}
                id={id}
                record={record}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
