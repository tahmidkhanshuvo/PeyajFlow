import Link from "next/link";
import { mutate } from "../../app/[locale]/workspace/actions";
import type { Locale } from "../../lib/copy";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type {
  Demand,
  Filters,
  Grade,
  PageResult,
  Supply,
} from "../../lib/workspace-types";
import {
  asciiDigits,
  dhakaToday,
  numberLabel,
  timeLabel,
} from "../../lib/workspace-values";
import {
  DecimalField,
  Details,
  Field,
  GradeField,
  Pagination,
  RequestKey,
  TransportField,
} from "./fields";
import { WorkspaceForm } from "./form";
import { kg } from "./stock";
import { StockActionModal, SupplyOfferModal } from "./stock-client";
import { WorkspaceIcon } from "./icon";
import { LocationIcon } from "./location-icon";

export function taka(locale: Locale, amount: string) {
  return `৳${numberLabel(locale, amount, true)}`;
}

export async function DemandPage({
  locale,
  base,
  actor,
  offset,
}: {
  locale: Locale;
  base: string;
  actor: Profile;
  offset: number;
}) {
  const result = await api<PageResult<Demand>>(
    `/v1/buyer-requests?offset=${offset}`,
  );
  const today = dhakaToday();
  const t = (bn: string, en: string) => local(locale, bn, en);
  return (
    <>
      <div className="stock-register-bar demand-register-bar">
        <StockActionModal
          locale={locale}
          label={local(locale, "নতুন চাহিদা লিখুন", "Create a demand")}
          icon="+"
        >
          <WorkspaceForm
            locale={locale}
            action={mutate.bind(null, locale, "demand", "", "")}
            label={local(locale, "চাহিদা সংরক্ষণ করুন", "Save demand")}
          >
            <div className="work-grid">
              <DecimalField
                name="quantity_kg"
                label={local(
                  locale,
                  "চাহিদার পরিমাণ (কেজি)",
                  "Quantity needed (kg)",
                )}
              />
              <Field label={local(locale, "জাত", "Variety")}>
                <input name="variety" maxLength={100} required />
              </Field>
              <GradeField locale={locale} name="minimum_grade" />
              <Field
                label={local(locale, "সরবরাহের জেলা", "Delivery district")}
              >
                <input
                  name="delivery_district"
                  maxLength={100}
                  defaultValue={actor.district}
                  required
                />
              </Field>
              <Field
                label={local(
                  locale,
                  "সরবরাহ শুরুর তারিখ",
                  "Earliest delivery date",
                )}
              >
                <input
                  type="date"
                  name="delivery_from"
                  min={today}
                  defaultValue={today}
                  required
                />
              </Field>
              <Field
                label={local(
                  locale,
                  "শেষ সরবরাহের তারিখ",
                  "Latest delivery date",
                )}
              >
                <input type="date" name="delivery_to" min={today} required />
              </Field>
              <DecimalField
                name="price_ceiling_bdt_kg"
                label={local(
                  locale,
                  "সর্বোচ্চ দর (৳/কেজি), ঐচ্ছিক",
                  "Maximum price (BDT/kg), optional",
                )}
                optional
              />
              <TransportField locale={locale} />
            </div>
          </WorkspaceForm>
        </StockActionModal>

        <Link
          href={`${base}/supply`}
          className="stock-action-pill-btn demand-find-supply-btn"
        >
          <WorkspaceIcon name="supply" size={16} />
          <span>
            {local(locale, "মিল থাকা মজুত খুঁজুন", "Find matching supply")}
          </span>
        </Link>
      </div>
      {!result.items.length && (
        <p className="work-panel">
          {local(locale, "এখনো কোনো চাহিদা নেই।", "No demands on this page.")}
        </p>
      )}
      <div className="work-cards demand-cards-grid">
        {result.items.map((item) => {
          const isOpen = item.status === "open" && item.delivery_to >= today;
          const isExpired = item.status === "open" && item.delivery_to < today;
          return (
            <article key={item.id} className="demand-card glass-1">
              {/* Card Header: Variety, Quantity Badge & Delivery District + Status Pill */}
              <div className="demand-card-header">
                <div className="demand-card-title-group">
                  <div className="demand-card-variety-wrap">
                    <h3 className="demand-card-variety">{item.variety}</h3>
                    <span className="demand-card-qty-badge">
                      {kg(locale, item.quantity_kg)}
                    </span>
                  </div>
                  <div className="demand-card-location">
                    <LocationIcon size={13} />
                    <span>{item.delivery_district}</span>
                  </div>
                </div>
                <div className="demand-card-status-wrap">
                  <span
                    className={`trade-status-pill ${
                      isOpen ? "verified" : isExpired ? "expired" : "closed"
                    }`}
                  >
                    <span className="trade-status-dot" aria-hidden="true" />
                    {isOpen
                      ? t("সক্রিয়", "Open")
                      : isExpired
                        ? t("মেয়াদোত্তীর্ণ", "Expired")
                        : t("বন্ধ", "Closed")}
                  </span>
                </div>
              </div>

              {/* Sub-cards / Metrics Grid */}
              <div className="demand-card-metrics-grid">
                <div className="demand-metric-box">
                  <span className="demand-metric-label">
                    {t("সর্বোচ্চ দর", "Max Price")}
                  </span>
                  <div className="demand-metric-val">
                    {item.price_ceiling_bdt_kg ? (
                      <>
                        <strong className="demand-price-val">
                          {taka(locale, item.price_ceiling_bdt_kg)}
                        </strong>
                        <span className="demand-price-unit">
                          /{t("কেজি", "kg")}
                        </span>
                      </>
                    ) : (
                      <span className="demand-negotiable">
                        {t("আলোচনা সাপেক্ষ", "Negotiable")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="demand-metric-box">
                  <span className="demand-metric-label">
                    {t("ন্যূনতম গ্রেড", "Min Grade")}
                  </span>
                  <div className="demand-metric-val">
                    {item.minimum_grade === "ungraded" ? (
                      <span className="demand-ungraded-text">
                        {t("যেকোনো", "Any Grade")}
                      </span>
                    ) : (
                      <span className="trade-grade-pill">
                        {t("গ্রেড", "Grade")} {item.minimum_grade}
                      </span>
                    )}
                  </div>
                </div>

                <div className="demand-metric-box">
                  <span className="demand-metric-label">
                    {t("পরিবহন ব্যবস্থা", "Transport")}
                  </span>
                  <div className="demand-metric-val">
                    <span className="demand-transport-pill">
                      {item.transport === "buyer"
                        ? t("ক্রেতা নিজে নেবে", "Buyer pickup")
                        : t("বিক্রেতা পাঠাবে", "Seller delivery")}
                    </span>
                  </div>
                </div>

                <div className="demand-metric-box">
                  <span className="demand-metric-label">
                    {t("মোট চাহিদা", "Target Need")}
                  </span>
                  <strong className="demand-metric-val">
                    {kg(locale, item.quantity_kg)}
                  </strong>
                </div>

                <div className="demand-metric-box full-width">
                  <span className="demand-metric-label">
                    {t("সরবরাহের সময়সীমা", "Delivery Window")}
                  </span>
                  <div className="demand-delivery-window">
                    <span className="demand-window-icon" aria-hidden="true">
                      📅
                    </span>
                    <span className="demand-window-range">
                      {timeLabel(locale, item.delivery_from)} –{" "}
                      {timeLabel(locale, item.delivery_to)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Close demand button or status notification */}
              <div className="demand-card-footer">
                {isOpen ? (
                  <WorkspaceForm
                    locale={locale}
                    action={mutate.bind(
                      null,
                      locale,
                      "demand-close",
                      item.id,
                      "",
                    )}
                    label={local(locale, "চাহিদা বন্ধ করুন", "Close demand")}
                  />
                ) : (
                  <div className="demand-closed-badge">
                    <span>
                      {item.status === "closed"
                        ? t("চাহিদাটি বন্ধ করা হয়েছে", "This demand is closed")
                        : t(
                            "সরবরাহের সময় উত্তীর্ণ হয়েছে",
                            "Delivery window has passed",
                          )}
                    </span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <Pagination
        locale={locale}
        offset={offset}
        next={result.next_offset}
        href={(next) => `${base}/demand?offset=${next}`}
      />
    </>
  );
}

const gradeValues = new Set<Grade>(["ungraded", "A", "B", "C"]);

export async function SupplyPage({
  locale,
  base,
  actor,
  filters,
  offset,
}: {
  locale: Locale;
  base: string;
  actor: Profile;
  filters: Filters;
  offset: number;
}) {
  const value = (name: string) =>
    typeof filters[name] === "string" ? filters[name] : "";
  const requestId = value("request_id");
  const query = new URLSearchParams();
  for (const key of [
    "district",
    "variety",
    "minimum_grade",
    "minimum_kg",
    "verified_only",
    "request_id",
    "preferred_district",
    "price_assumption_bdt_kg",
    "preferred_freight_bdt",
    "other_freight_bdt",
  ]) {
    const input = value(key);
    if (input)
      query.set(
        key,
        key === "minimum_kg" || key.endsWith("_bdt") || key.endsWith("_bdt_kg")
          ? asciiDigits(input)
          : input,
      );
  }
  if (requestId) query.set("ranked", "true");
  query.set("offset", String(offset));
  const [result, demand] = await Promise.all([
    api<PageResult<Supply>>(`/v1/matches?${query}`),
    requestId
      ? api<Demand>(`/v1/buyer-requests/${encodeURIComponent(requestId)}`)
      : Promise.resolve(null),
  ]);
  const selected = value("minimum_grade") as Grade;
  const t = (bn: string, en: string) => local(locale, bn, en);
  return (
    <>
      <section className="work-panel supply-filter-card glass-1">
        {/* Header Strip with Eyebrow & Matching Demand Info */}
        <div className="supply-filter-header">
          <div className="supply-filter-title-group">
            <div className="dash-quality-eyebrow">
              <span className="dash-pulse-dot" aria-hidden="true" />
              <span>{t("মজুত ছাঁকনি ও অনুসন্ধান", "FILTER & SEARCH SUPPLY")}</span>
            </div>
            <h2 className="supply-filter-heading">
              {t("মজুত ছাঁকুন", "Filter supply")}
            </h2>
          </div>

          {demand && (
            <div className="supply-demand-pill">
              <WorkspaceIcon name="demand" size={15} />
              <span>
                {t("চাহিদা অনুযায়ী ফল", "Matching demand")}:{" "}
                <strong>
                  {demand.variety} · {kg(locale, demand.quantity_kg)}
                </strong>
              </span>
            </div>
          )}
        </div>

        {demand && (
          <p className="supply-filter-help-text">
            {t(
              "পূর্ণ চাহিদা আগে। দর দিলে প্রতি কেজির আনুমানিক খরচ, এরপর জেলা, যাচাই ও গ্রেডে সাজানো হয়।",
              "Full coverage ranks first, followed by landed cost per kg when entered, preferred district, verification, and grade.",
            )}
          </p>
        )}

        <form
          action={`${base}/supply`}
          method="get"
          className="supply-filter-form"
        >
          {requestId && (
            <input name="request_id" type="hidden" value={requestId} />
          )}

          {/* Grid of Clean Modern Form Inputs */}
          <div className="supply-filter-grid">
            <Field label={local(locale, "জেলা", "District")}>
              <input
                name="district"
                placeholder={t("যেমন: পাবনা, ঢাকা", "e.g., Pabna, Dhaka")}
                defaultValue={value("district")}
                maxLength={100}
              />
            </Field>

            {!demand && (
              <>
                <Field label={local(locale, "জাত", "Variety")}>
                  <input
                    name="variety"
                    placeholder={t("যেমন: তাহেরপুরী", "e.g., Taherpuri")}
                    defaultValue={value("variety")}
                    maxLength={100}
                  />
                </Field>
                <GradeField
                  locale={locale}
                  name="minimum_grade"
                  value={gradeValues.has(selected) ? selected : "ungraded"}
                />
              </>
            )}

            <DecimalField
              name="minimum_kg"
              label={local(
                locale,
                "ন্যূনতম খালি মজুত (কেজি)",
                "Minimum available (kg)",
              )}
              value={value("minimum_kg")}
              optional
            />

            {demand && (
              <>
                <Field
                  label={local(
                    locale,
                    "পছন্দের সংগ্রহ জেলা",
                    "Preferred pickup district",
                  )}
                >
                  <input
                    name="preferred_district"
                    placeholder={t("যেমন: পাবনা", "e.g., Pabna")}
                    maxLength={100}
                    defaultValue={value("preferred_district")}
                  />
                </Field>

                <DecimalField
                  name="price_assumption_bdt_kg"
                  label={local(
                    locale,
                    "ধরা পণ্যমূল্য (৳/কেজি)",
                    "Assumed goods price (BDT/kg)",
                  )}
                  value={value("price_assumption_bdt_kg")}
                  optional
                />

                <DecimalField
                  name="preferred_freight_bdt"
                  label={local(
                    locale,
                    "পছন্দের জেলার পরিবহন (৳)",
                    "Freight for preferred district (BDT)",
                  )}
                  value={value("preferred_freight_bdt")}
                  optional
                />

                <DecimalField
                  name="other_freight_bdt"
                  label={local(
                    locale,
                    "অন্য জেলার পরিবহন (৳)",
                    "Freight for other districts (BDT)",
                  )}
                  value={value("other_freight_bdt")}
                  optional
                />
              </>
            )}
          </div>

          {/* Bottom Filter Controls Bar */}
          <div className="supply-filter-actions-bar">
            <label className="supply-filter-checkbox">
              <input
                type="checkbox"
                name="verified_only"
                value="true"
                defaultChecked={value("verified_only") === "true"}
              />
              <span>
                {local(locale, "শুধু যাচাইকৃত মজুত", "Verified stock only")}
              </span>
            </label>

            <div className="supply-filter-btn-group">
              <Link
                className="supply-filter-clear-link"
                href={`${base}/supply${requestId ? `?request_id=${encodeURIComponent(requestId)}` : ""}`}
              >
                {local(locale, "ছাঁকনি মুছুন", "Clear filters")}
              </Link>
              <button className="supply-filter-submit-btn" type="submit">
                <WorkspaceIcon name="supply" size={15} />
                <span>{local(locale, "মজুত খুঁজুন", "Search supply")}</span>
              </button>
            </div>
          </div>
        </form>
      </section>
      {!result.items.length && (
        <p className="work-panel">
          {local(
            locale,
            "এই ছাঁকনিতে কোনো মজুত পাওয়া যায়নি।",
            "No eligible lots match these filters.",
          )}
        </p>
      )}
      <div className="work-cards supply-cards-grid">
        {result.items.map((lot) => {
          const isVerified = lot.verification === "verified";
          return (
            <article key={lot.id} className="supply-lot-card glass-1">
              {/* Card Header: Variety, District, Verification status */}
              <div className="supply-lot-card-header">
                <div className="supply-lot-title-group">
                  <h3 className="supply-lot-variety">{lot.variety}</h3>
                  <div className="supply-lot-location">
                    <LocationIcon size={13} />
                    <span>{lot.district}</span>
                  </div>
                </div>
                <div className="supply-lot-status-wrap">
                  <span
                    className={`trade-status-pill ${isVerified ? "verified" : "pending"}`}
                  >
                    <span className="trade-status-dot" aria-hidden="true" />
                    {isVerified
                      ? t("যাচাইকৃত", "Verified")
                      : t("নিজস্ব প্রতিবেদন", "Self-reported")}
                  </span>
                </div>
              </div>

              {/* Individual sub-cards for metrics */}
              <div className="supply-lot-metrics-grid">
                <div className="supply-lot-metric-box">
                  <span className="supply-lot-metric-label">
                    {t("খালি মজুত", "Available")}
                  </span>
                  <strong className="supply-lot-metric-val">
                    {kg(locale, lot.sellable_kg)}
                  </strong>
                </div>

                <div className="supply-lot-metric-box">
                  <span className="supply-lot-metric-label">
                    {t("গ্রেড", "Grade")}
                  </span>
                  <div className="supply-lot-metric-val">
                    <span className="trade-grade-pill">
                      {t("গ্রেড", "Grade")} {lot.grade}
                    </span>
                  </div>
                </div>

                {lot.coverage && (
                  <div className="supply-lot-metric-box full-width">
                    <span className="supply-lot-metric-label">
                      {t("চাহিদার কাভারেজ", "Demand Coverage")}
                    </span>
                    <div className="supply-coverage-details">
                      <span className={`supply-coverage-tag ${lot.coverage}`}>
                        {lot.coverage === "full"
                          ? t("পূর্ণ চাহিদা", "Full coverage")
                          : t("আংশিক চাহিদা", "Partial coverage")}
                      </span>
                      <span className="supply-coverage-qty">
                        {kg(locale, lot.matched_kg ?? "0")}
                      </span>
                      {lot.preferred_pickup && (
                        <span className="supply-preferred-tag">
                          ★ {t("পছন্দের জেলা", "Preferred district")}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {lot.estimate_basis &&
                  lot.estimated_landed_bdt &&
                  lot.estimated_landed_bdt_kg && (
                    <div className="supply-lot-metric-box full-width">
                      <span className="supply-lot-metric-label">
                        {t("ধরা মোট খরচ", "Landed-cost estimate")}
                      </span>
                      <div className="supply-landed-details">
                        <strong className="supply-landed-total">
                          {taka(locale, lot.estimated_landed_bdt)}
                        </strong>
                        <span className="supply-landed-rate">
                          ({taka(locale, lot.estimated_landed_bdt_kg)} /{" "}
                          {t("কেজি", "kg")})
                        </span>
                      </div>
                    </div>
                  )}
              </div>

              {/* Card Footer: Make an offer button (pops up modal) */}
              <div className="supply-lot-card-footer">
                <SupplyOfferModal
                  locale={locale}
                  lotLabel={`${lot.variety} · ${lot.district}`}
                  lotMeta={`${kg(locale, lot.sellable_kg)} · Grade ${lot.grade}`}
                >
                  <WorkspaceForm
                    locale={locale}
                    action={mutate.bind(
                      null,
                      locale,
                      "offer",
                      lot.id,
                      demand?.id ?? "",
                    )}
                    label={local(locale, "অফার পাঠান", "Send offer")}
                  >
                    <RequestKey />
                    <div className="work-grid">
                      <DecimalField
                        name="quantity_kg"
                        label={local(locale, "পরিমাণ (কেজি)", "Quantity (kg)")}
                        value={
                          demand &&
                          Number(demand.quantity_kg) <= Number(lot.sellable_kg)
                            ? demand.quantity_kg
                            : undefined
                        }
                      />
                      <DecimalField
                        name="price_bdt_kg"
                        label={local(locale, "দর (৳/কেজি)", "Price (BDT/kg)")}
                      />
                      <Field
                        label={local(
                          locale,
                          "সরবরাহের জেলা",
                          "Delivery district",
                        )}
                      >
                        <input
                          name="delivery_district"
                          defaultValue={
                            demand?.delivery_district ?? actor.district
                          }
                          readOnly={Boolean(demand)}
                          maxLength={100}
                          required
                        />
                      </Field>
                      {demand ? (
                        <input
                          type="hidden"
                          name="transport"
                          value={demand.transport}
                        />
                      ) : (
                        <TransportField locale={locale} />
                      )}
                      {!demand && (
                        <Field
                          label={local(
                            locale,
                            "সরবরাহের তারিখ (ঐচ্ছিক)",
                            "Delivery date (optional)",
                          )}
                        >
                          <input
                            type="date"
                            name="delivery_on"
                            min={dhakaToday()}
                          />
                        </Field>
                      )}
                      <Field
                        label={local(
                          locale,
                          "অফার কত ঘণ্টা থাকবে",
                          "Offer valid for (hours)",
                        )}
                      >
                        <input
                          type="number"
                          min="1"
                          max="168"
                          name="valid_hours"
                          defaultValue="24"
                          required
                        />
                      </Field>
                    </div>
                  </WorkspaceForm>
                </SupplyOfferModal>
              </div>
            </article>
          );
        })}
      </div>
      <Pagination
        locale={locale}
        offset={offset}
        next={result.next_offset}
        href={(next) => {
          const params = new URLSearchParams(query);
          params.set("offset", String(next));
          return `${base}/supply?${params}`;
        }}
      />
    </>
  );
}
