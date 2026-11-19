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
  return (
    <>
      <section className="work-panel">
        <Details label={local(locale, "নতুন চাহিদা লিখুন", "Create a demand")}>
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
        </Details>
      </section>
      {!result.items.length && (
        <p className="work-panel">
          {local(locale, "এখনো কোনো চাহিদা নেই।", "No demands on this page.")}
        </p>
      )}
      <div className="work-cards">
        {result.items.map((item) => (
          <article key={item.id} className="work-panel">
            <h2>
              {item.variety} · {kg(locale, item.quantity_kg)}
            </h2>
            <p>
              {item.delivery_district} · {timeLabel(locale, item.delivery_from)}{" "}
              – {timeLabel(locale, item.delivery_to)}
            </p>
            <p>
              {item.price_ceiling_bdt_kg
                ? `${taka(locale, item.price_ceiling_bdt_kg)}/${local(locale, "কেজি", "kg")}`
                : local(locale, "দর আলোচনা সাপেক্ষ", "Price negotiable")}
            </p>
            <p>
              {local(locale, "ন্যূনতম গ্রেড", "Minimum grade")} ·{" "}
              {item.minimum_grade === "ungraded"
                ? local(locale, "যেকোনো", "Any")
                : item.minimum_grade}
            </p>
            {item.status === "open" && item.delivery_to >= today ? (
              <>
                <Link
                  className="work-link"
                  href={`${base}/supply?request_id=${item.id}`}
                >
                  {local(locale, "মিল থাকা মজুত খুঁজুন", "Find matching supply")}
                </Link>
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
              </>
            ) : (
              <p className="work-tag">
                {item.status === "closed"
                  ? local(locale, "বন্ধ", "Closed")
                  : local(locale, "সময় পার হয়েছে", "Delivery window passed")}
              </p>
            )}
          </article>
        ))}
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
  return (
    <>
      <section className="work-panel">
        <h2>{local(locale, "মজুত ছাঁকুন", "Filter supply")}</h2>
        {demand && (
          <p>
            {local(locale, "চাহিদা অনুযায়ী ফল", "Matching demand")} ·{" "}
            {demand.variety} · {kg(locale, demand.quantity_kg)}
          </p>
        )}
        {demand && (
          <p>
            {local(
              locale,
              "পূর্ণ চাহিদা আগে। দর দিলে প্রতি কেজির আনুমানিক খরচ, এরপর জেলা, যাচাই ও গ্রেডে সাজানো হয়।",
              "Full coverage ranks first, followed by landed cost per kg when entered, preferred district, verification, and grade.",
            )}
          </p>
        )}
        <form action={`${base}/supply`} method="get" className="work-form">
          {requestId && (
            <input name="request_id" type="hidden" value={requestId} />
          )}
          <div className="work-grid">
            <Field label={local(locale, "জেলা", "District")}>
              <input
                name="district"
                defaultValue={value("district")}
                maxLength={100}
              />
            </Field>
            {!demand && (
              <>
                <Field label={local(locale, "জাত", "Variety")}>
                  <input
                    name="variety"
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
          <label className="checkbox">
            <input
              type="checkbox"
              name="verified_only"
              value="true"
              defaultChecked={value("verified_only") === "true"}
            />
            {local(locale, "শুধু যাচাইকৃত মজুত", "Verified stock only")}
          </label>
          <button className="refresh" type="submit">
            {local(locale, "খুঁজুন", "Search supply")}
          </button>
        </form>
        <Link className="work-link" href={`${base}/supply`}>
          {local(locale, "ছাঁকনি মুছুন", "Clear filters")}
        </Link>
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
      <div className="work-cards">
        {result.items.map((lot) => (
          <article key={lot.id} className="work-panel">
            <h2>
              {lot.variety} · {lot.district}
            </h2>
            <p>
              {kg(locale, lot.sellable_kg)} {local(locale, "খালি", "available")}{" "}
              · {local(locale, "গ্রেড", "Grade")} {lot.grade}
            </p>
            <span className="work-tag">
              {lot.verification === "verified"
                ? local(locale, "যাচাইকৃত", "Verified")
                : local(locale, "নিজস্ব প্রতিবেদন", "Self-reported")}
            </span>
            {lot.coverage && (
              <p>
                {lot.coverage === "full"
                  ? local(locale, "পূর্ণ চাহিদা", "Full coverage")
                  : local(locale, "আংশিক চাহিদা", "Partial coverage")}{" "}
                · {kg(locale, lot.matched_kg ?? "0")}
                {lot.preferred_pickup
                  ? local(locale, " · পছন্দের জেলা", " · Preferred district")
                  : ""}
              </p>
            )}
            {lot.estimate_basis &&
              lot.estimated_landed_bdt &&
              lot.estimated_landed_bdt_kg && (
                <p>
                  {local(
                    locale,
                    "আপনার ধরা মোট খরচ",
                    "Your landed-cost estimate",
                  )}{" "}
                  · {taka(locale, lot.estimated_landed_bdt)} ·{" "}
                  {taka(locale, lot.estimated_landed_bdt_kg)}/
                  {local(locale, "কেজি", "kg")}
                </p>
              )}
            <Details label={local(locale, "অফার লিখুন", "Make an offer")}>
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
                    label={local(locale, "সরবরাহের জেলা", "Delivery district")}
                  >
                    <input
                      name="delivery_district"
                      defaultValue={demand?.delivery_district ?? actor.district}
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
            </Details>
          </article>
        ))}
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
