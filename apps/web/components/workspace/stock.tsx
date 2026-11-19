import Link from "next/link";
import { mutate } from "../../app/[locale]/workspace/actions";
import type { Locale } from "../../lib/copy";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type { Delegation, Lot, LotDetail } from "../../lib/workspace-types";
import { dhakaToday, numberLabel, timeLabel } from "../../lib/workspace-values";
import { DecimalField, Details, Field, GradeField, RequestKey } from "./fields";
import { WorkspaceForm } from "./form";

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
    <dl className="work-metrics">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StockCard({
  locale,
  lot,
  base,
}: {
  locale: Locale;
  lot: Lot;
  base: string;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const isVerified = Boolean(lot.verified_kg);

  return (
    <article key={lot.id} className="trade-order-card stock-card">
      {/* Top Header: Lot ID + Variety + Grade + Verification Status */}
      <div className="trade-card-header">
        <div className="trade-card-id-wrap">
          <span className="trade-card-hash">#{lot.id.slice(0, 8)}</span>
          <span className="trade-card-variety">{lot.variety}</span>
          {lot.grade && lot.grade !== "ungraded" && (
            <span className="trade-card-grade-badge">
              {t("গ্রেড", "Grade")} {lot.grade}
            </span>
          )}
        </div>
        <span
          className={`trade-status-pill ${isVerified ? "verified" : "pending"}`}
        >
          <span className="trade-status-dot" aria-hidden="true" />
          {isVerified ? t("যাচাইকৃত", "Verified") : t("স্বঘোষিত", "Self-reported")}
        </span>
      </div>

      {/* Lot Title & Storage Location */}
      <div className="trade-card-main-title">
        <h2 className="trade-card-heading">
          <Link
            href={`${base}/stock/${lot.id}`}
            className="trade-card-title-link"
          >
            {lot.label}
          </Link>
        </h2>
        <div className="trade-card-meta-strip">
          <span>📍 {lot.district}</span>
          <span className="trade-meta-dot">•</span>
          <span>{lot.storage_type}</span>
        </div>
      </div>

      {/* Genuine Dates from Backend (No fake progress slider line) */}
      {(lot.harvest_on || lot.stored_on) && (
        <div className="trade-meta-dates">
          {lot.harvest_on && (
            <span>
              <strong>{t("ফসল তোলা", "Harvest")}:</strong>{" "}
              {timeLabel(locale, lot.harvest_on)}
            </span>
          )}
          {lot.harvest_on && lot.stored_on && (
            <span className="trade-meta-dot">•</span>
          )}
          {lot.stored_on && (
            <span>
              <strong>{t("সংরক্ষিত", "Stored")}:</strong>{" "}
              {timeLabel(locale, lot.stored_on)}
            </span>
          )}
        </div>
      )}

      <div className="trade-card-divider dashed" />

      {/* Real Backend Inventory Quantities */}
      <div className="trade-receipt-body">
        <div className="trade-receipt-row">
          <span className="trade-receipt-label">
            {t("বর্তমান মজুত", "Recorded stock")}
          </span>
          <span className="trade-receipt-val">
            {kg(locale, lot.available_kg)}
          </span>
        </div>
        <div className="trade-receipt-row">
          <span className="trade-receipt-label">
            {t("সংরক্ষিত", "Reserved")}
          </span>
          <span className="trade-receipt-val">
            {kg(locale, lot.reserved_kg)}
          </span>
        </div>
        {lot.verified_kg !== null && (
          <div className="trade-receipt-row">
            <span className="trade-receipt-label">
              {t("যাচাইকৃত ওজন", "Verified weight")}
            </span>
            <span className="trade-receipt-val">
              {kg(locale, lot.verified_kg)}
            </span>
          </div>
        )}
        <div className="trade-receipt-divider dashed" />
        <div className="trade-receipt-total">
          <span className="trade-receipt-total-label">
            {t("খালি মজুত", "Available balance")}
          </span>
          <strong className="trade-receipt-total-val">
            {kg(locale, lot.sellable_kg)}
          </strong>
        </div>
      </div>

      {/* Footer: Direct CTA to Lot Details (No fake actor persona/avatar) */}
      <div className="trade-card-footer stock-card-footer">
        <Link
          href={`${base}/stock/${lot.id}`}
          className="trade-card-action-btn"
          title={t("মজুতের বিবরণ দেখুন", "View lot details")}
        >
          <span>{t("মজুত বিবরণ", "Lot details")}</span>
          <span className="trade-card-circle-arrow">→</span>
        </Link>
      </div>
    </article>
  );
}

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
        <section className="work-panel">
          <Details label={local(locale, "নতুন মজুত নিবন্ধন", "Register a lot")}>
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
          </Details>
        </section>
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
      <div className="trade-cards-grid">
        {lots.map((lot) => (
          <StockCard key={lot.id} locale={locale} lot={lot} base={base} />
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
  const lot = await api<LotDetail>(`/v1/lots/${id}`);
  return (
    <>
      <Link className="work-link" href={`${base}/stock`}>
        {local(locale, "মজুতে ফিরুন", "Back to stock")}
      </Link>
      <section className="work-panel">
        <h2>{lot.label}</h2>
        <h2>{local(locale, "মজুতের পরিমাণ", "Stock balance")}</h2>
        <p>
          {lot.district} · {lot.variety} · {lot.storage_type}
        </p>
        <LotBalances locale={locale} lot={lot} />
        <p>
          {local(locale, "প্রথম নিবন্ধিত পরিমাণ", "Initial quantity")} ·{" "}
          {kg(locale, lot.initial_kg)}
        </p>
        {lot.verified_at && (
          <p>
            {local(locale, "শেষ যাচাই", "Last weighed")} ·{" "}
            {timeLabel(locale, lot.verified_at)}
          </p>
        )}
        <div className="work-row">
          <Link className="work-link" href={`${base}/stock/${id}/inspections`}>
            {local(locale, "পরিদর্শন ও ছবি", "Inspections and photos")}
          </Link>
          <Link className="work-link" href={`${base}/stock/${id}/risk`}>
            {local(locale, "সংরক্ষণের ঝুঁকি", "Storage risk")}
          </Link>
          <Link className="work-link" href={`${base}/stock/${id}/advice`}>
            {local(locale, "অপেক্ষা নাকি বিক্রি", "Hold or sell")}
          </Link>
        </div>
      </section>
      {actor.role === "farmer" && (
        <section className="work-panel">
          <Details label={local(locale, "মজুতের তথ্য বদলান", "Edit lot details")}>
            <WorkspaceForm
              locale={locale}
              action={mutate.bind(null, locale, "lot-edit", id, "")}
              label={local(locale, "তথ্য সংরক্ষণ করুন", "Save details")}
            >
              <LotFields locale={locale} district={actor.district} lot={lot} />
            </WorkspaceForm>
          </Details>
        </section>
      )}
      {actor.role !== "admin" && (
        <section className="work-panel">
          <Details
            label={local(
              locale,
              "ওজন বা ক্ষতি নথিভুক্ত করুন",
              "Record a weight change or loss",
            )}
          >
            <WorkspaceForm
              locale={locale}
              action={mutate.bind(null, locale, "movement", id, "")}
              label={local(locale, "পরিবর্তন সংরক্ষণ করুন", "Save stock change")}
            >
              <RequestKey />
              <Field label={local(locale, "পরিবর্তনের ধরন", "Change type")}>
                <select name="event_type">
                  <option value="WEIGHED_ADJUSTMENT">
                    {local(
                      locale,
                      "ওজন সমন্বয় (+/−)",
                      "Weight adjustment (+/−)",
                    )}
                  </option>
                  <option value="LOSS_REPORTED">
                    {local(locale, "ক্ষতি", "Loss")}
                  </option>
                </select>
              </Field>
              <UnitFields locale={locale} />
              <Field label={local(locale, "কারণ", "Reason")}>
                <input name="reason" maxLength={200} required />
              </Field>
            </WorkspaceForm>
          </Details>
        </section>
      )}
      {(actor.role === "agent" || actor.role === "admin") && (
        <section className="work-panel">
          <Details
            label={local(locale, "ওজন যাচাই করুন", "Verify measured stock")}
          >
            <WorkspaceForm
              locale={locale}
              action={mutate.bind(null, locale, "verify", id, "")}
              label={local(locale, "যাচাই সংরক্ষণ করুন", "Save verification")}
            >
              <DecimalField
                name="verified_kg"
                label={local(locale, "যাচাইকৃত কেজি", "Verified kg")}
                value={lot.verified_kg}
              />
            </WorkspaceForm>
          </Details>
        </section>
      )}
      <section className="work-panel">
        <h2>{local(locale, "মজুতের ইতিহাস", "Stock history")}</h2>
        <ul className="work-history">
          {lot.events.map((event) => (
            <li key={event.id}>
              <strong>
                {local(
                  locale,
                  ...(movements[event.event_type] ?? [
                    event.event_type,
                    event.event_type,
                  ]),
                )}
              </strong>
              <span>
                {kg(locale, event.delta_kg)} ·{" "}
                {local(locale, "সংরক্ষিত পরিবর্তন", "Reservation change")}{" "}
                {kg(locale, event.reserved_delta_kg)}
              </span>
              {event.submitted_unit === "maund" && event.kg_per_maund && (
                <span>
                  {local(locale, "প্রতি মণে", "Per maund")}{" "}
                  {kg(locale, event.kg_per_maund)}
                </span>
              )}
              {["WEIGHED_ADJUSTMENT", "LOSS_REPORTED"].includes(
                event.event_type,
              ) && <span>{event.reason}</span>}
              <time dateTime={event.recorded_at}>
                {timeLabel(locale, event.recorded_at)}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
