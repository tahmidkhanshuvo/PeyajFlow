import Link from "next/link";
import type { Locale } from "../../lib/copy";
import type { PriceSeries } from "../../lib/pilot-types";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type { Lot, Offer } from "../../lib/workspace-types";
import { numberLabel } from "../../lib/workspace-values";
import { AdviceForm } from "./advice-form";
import { DecimalField, Details, Field } from "./fields";
import { taka } from "./market";
import { seriesName } from "./prices";
import { kg } from "./stock";
import { DataChart } from "./data-chart";

export async function AdvicePage({
  locale,
  base,
  id,
  actor,
}: {
  locale: Locale;
  base: string;
  id: string;
  actor: Profile;
}) {
  const [lot, series, offers, weights] = await Promise.all([
    api<Lot>(`/v1/lots/${id}`),
    api<PriceSeries[]>("/v1/market/series"),
    actor.role === "farmer" ? api<Offer[]>("/v1/offers") : Promise.resolve([]),
    api<{
      status: string;
      readings: {
        recorded_at: string;
        verified_kg: string;
        fitted_kg: number | null;
      }[];
    }>(`/v1/lots/${id}/weight-history`),
  ]);
  const availableSeries = series.filter(
    (item) =>
      item.price_type === "farmgate" &&
      item.grade === lot.grade &&
      item.district.toLowerCase() === lot.district.toLowerCase(),
  );
  const eligibleOffers = offers.filter(
    (item) =>
      item.lot_id === id &&
      item.proposer_id !== actor.membership_id &&
      ["sent", "countered"].includes(item.status),
  );
  const costs = [
    ["transport_now_bdt", "এখনকার পরিবহন", "Transport now"],
    ["fees_now_bdt", "এখনকার ফি", "Fees now"],
    ["storage_bdt", "সংরক্ষণ", "Storage"],
    ["finance_bdt", "অর্থায়ন", "Financing"],
    ["transport_later_bdt", "পরের পরিবহন", "Transport later"],
    ["fees_later_bdt", "পরের ফি", "Fees later"],
    ["cash_need_bdt", "জরুরি নগদের প্রয়োজন", "Immediate cash need"],
  ];
  return (
    <>
      <DataChart
        locale={locale}
        title={local(locale, "যাচাইকৃত ওজনের ইতিহাস", "Verified weight history")}
        summary={local(
          locale,
          "শুধু তুলনাযোগ্য যাচাইকৃত ওজন। যথেষ্ট প্রমাণ থাকলে ড্যাশ রেখায় পরীক্ষামূলক প্রবণতা দেখানো হয়।",
          "Comparable verified weights only. The dashed line shows an experimental historical fit when evidence supports it.",
        )}
        points={weights.readings.map((row) => ({
          name: row.recorded_at.slice(0, 10),
          value: Number(row.verified_kg),
          fitted: row.fitted_kg,
        }))}
        unit={local(locale, "কেজি", "kg")}
      />
      <Link className="work-link" href={`${base}/stock/${id}`}>
        {lot.label}
      </Link>
      <section className="work-panel">
        <h2>{local(locale, "নিট আয় তুলনা", "Compare net proceeds")}</h2>
        <p>
          {local(
            locale,
            "একই পরিমাণ মজুত এখন বিক্রি বা পরে বিক্রি করলে কত থাকতে পারে তা তুলনা করুন।",
            "Compare selling the same quantity now or later. A shorter offer limits the quantity compared.",
          )}
        </p>
        <AdviceForm locale={locale} lotId={id}>
          <div className="work-grid">
            <Field
              label={local(
                locale,
                "স্থানীয় খামারদরের ধারা",
                "Local farmgate series",
              )}
            >
              <select name="series" defaultValue="">
                <option value="">
                  {local(locale, "বেছে নিন", "Select a series")}
                </option>
                {availableSeries.map((item) => (
                  <option key={item.series} value={item.series}>
                    {seriesName(locale, item)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={local(locale, "সক্রিয় ক্রেতার অফার", "Active buyer offer")}
            >
              <select name="offer_id" defaultValue="">
                <option value="">
                  {local(locale, "অফার ব্যবহার না করে", "Without an offer")}
                </option>
                {eligibleOffers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.buyer_name} · {kg(locale, item.quantity_kg)} ·{" "}
                    {taka(locale, item.price_bdt_kg)}/kg
                  </option>
                ))}
              </select>
            </Field>
            <DecimalField
              name="manual_price_bdt_kg"
              label={local(
                locale,
                "অফার না থাকলে ধরা দর (৳/কেজি)",
                "Assumed price without an offer (BDT/kg)",
              )}
              optional
            />
            <DecimalField
              name="quantity_kg"
              label={local(
                locale,
                "তুলনার পরিমাণ (কেজি), ঐচ্ছিক",
                "Quantity to compare (kg), optional",
              )}
              optional
            />
            <Field label={local(locale, "অপেক্ষার সময়", "Holding period")}>
              <select name="horizon_days">
                {[7, 14, 28].map((value) => (
                  <option key={value} value={value}>
                    {numberLabel(locale, value)} {local(locale, "দিন", "days")}
                  </option>
                ))}
              </select>
            </Field>
            <DecimalField
              name="loss_pct"
              label={local(
                locale,
                "ধরা ওজন ক্ষতি (%)",
                "Assumed weight loss (%)",
              )}
              value="0"
            />
          </div>
          <label className="checkbox">
            <input type="checkbox" name="use_loss_model" />
            {local(
              locale,
              "যাচাইকৃত ওজন থেকে পরীক্ষামূলক ক্ষতির হিসাব ব্যবহার করুন",
              "Use experimental loss estimates from verified weights",
            )}
          </label>
          <Details
            label={local(locale, "খরচ ও নগদের প্রয়োজন", "Costs and cash needs")}
          >
            <div className="work-grid">
              {costs.map(([key, bn, en]) => (
                <DecimalField
                  key={key}
                  name={key}
                  label={`${local(locale, bn, en)} (৳)`}
                  value="0"
                />
              ))}
            </div>
          </Details>
          <Details
            label={local(
              locale,
              "নিজস্ব ভবিষ্যৎ দরের ধারণা",
              "Optional future price assumptions",
            )}
          >
            <p>
              {local(
                locale,
                "তিনটি দর লিখলে ঐতিহাসিক পরিসরের বদলে এই ধারণাগুলো ব্যবহার হবে।",
                "Enter all three prices to calculate a hypothetical range in place of the historical outlook.",
              )}
            </p>
            <div className="work-grid">
              <DecimalField
                name="hypothetical_low"
                label={local(locale, "নিম্ন (৳/কেজি)", "Downside (BDT/kg)")}
                optional
              />
              <DecimalField
                name="hypothetical_middle"
                label={local(locale, "মধ্য (৳/কেজি)", "Middle (BDT/kg)")}
                optional
              />
              <DecimalField
                name="hypothetical_high"
                label={local(locale, "উচ্চ (৳/কেজি)", "Upside (BDT/kg)")}
                optional
              />
            </div>
          </Details>
          <label className="checkbox">
            <input type="checkbox" name="assumptions_reviewed" />
            {local(
              locale,
              "খরচ ও ক্ষতির ধারণা যাচাই করেছি।",
              "I reviewed the cost and loss assumptions.",
            )}
          </label>
        </AdviceForm>
      </section>
    </>
  );
}
