"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import { runAdvice } from "../../app/[locale]/workspace/pilot-actions";
import type { Locale } from "../../lib/copy";
import { errorText, local } from "../../lib/workspace-copy";
import { numberLabel } from "../../lib/workspace-values";
import { scenarioPoints } from "../../lib/chart-data";
import { DataChart } from "./data-chart";

const labels: Record<string, [string, string]> = {
  experimental_loss_model: [
    "পরীক্ষামূলক ক্ষতির হিসাব দিয়ে সম্ভাব্য আয় দেখানো হয়েছে।",
    "The experimental loss model is used for the holding scenarios.",
  ],
  loss_model_unavailable: [
    "মডেলের জন্য যথেষ্ট সাম্প্রতিক যাচাইকৃত ওজন নেই। দেওয়া ক্ষতির হার ব্যবহার করা হয়েছে।",
    "There are too few recent, comparable verified weights. The entered loss assumption was used.",
  ],
  SELL: ["বিক্রি", "Sell"],
  HOLD: ["অপেক্ষা", "Hold"],
  SELL_PART: ["আংশিক বিক্রি", "Sell part"],
  INSUFFICIENT_DATA: [
    "সিদ্ধান্তের জন্য তথ্য অপর্যাপ্ত",
    "Insufficient evidence for a recommendation",
  ],
  moderate: ["মাঝারি", "Moderate"],
  limited: ["সীমিত", "Limited"],
  insufficient: ["অপর্যাপ্ত", "Insufficient"],
  no_sellable_quantity: ["বিক্রয়যোগ্য মজুত নেই।", "No sellable quantity."],
  missing_current_price: ["এখনকার দর নেই।", "A current price is missing."],
  missing_future_range: [
    "ভবিষ্যতের পরিসর পাওয়া যায়নি।",
    "A future price range is missing.",
  ],
  synthetic_series: ["দরধারাটি কাল্পনিক।", "The series is synthetic."],
  hypothetical_inputs: [
    "এক বা একাধিক দর ধারণাভিত্তিক।",
    "One or more prices are hypothetical.",
  ],
  review_storage_condition: [
    "সংরক্ষণের অবস্থা সরাসরি যাচাই করুন।",
    "Review the current storage condition.",
  ],
  review_costs_and_losses: [
    "খরচ ও ক্ষতির ধারণা যাচাই করুন।",
    "Review the cost and loss assumptions.",
  ],
  liquidity_with_remaining_stock: [
    "আংশিক বিক্রি নগদের প্রয়োজন মেটায়।",
    "The partial sale covers the stated cash need.",
  ],
  current_net_beats_upside: [
    "এখনকার নিট আয় অপেক্ষার উচ্চ হিসাবের চেয়ে বেশি।",
    "Selling now exceeds the upside of waiting.",
  ],
  downside_beats_current_net: [
    "অপেক্ষার নিম্ন হিসাবও এখনকার নিট আয়ের চেয়ে বেশি।",
    "Even the downside of waiting exceeds the current net.",
  ],
  scenario_overlap_or_cash_need: [
    "হিসাবগুলোর ব্যবধান বা নগদের শর্তে স্পষ্ট সিদ্ধান্ত নেই।",
    "The scenario spread or cash need does not support a clear choice.",
  ],
  verified_buyer_offer: ["যাচাইকৃত ক্রেতার অফার", "Verified buyer offer"],
  unverified_buyer_offer: ["অযাচাইকৃত ক্রেতার অফার", "Unverified buyer offer"],
  farmgate_reference: ["স্থানীয় খামারদরের পর্যবেক্ষণ", "Local farmgate reference"],
  user_assumption: ["ব্যবহারকারীর ধরা দর", "User-entered price"],
  user_scenario: ["ব্যবহারকারীর সম্ভাব্য দর", "User scenarios"],
  last_value: ["সর্বশেষ দর", "Last observed price"],
  rolling_median: ["সাম্প্রতিক মধ্যক", "Rolling median"],
  seasonal_naive: ["মৌসুমি ভিত্তি", "Seasonal baseline"],
  historical_change_quantiles: [
    "ঐতিহাসিক কোয়ান্টাইল",
    "Historical-change quantiles",
  ],
  lagged_price_neighbors: ["দরের অনুরূপ প্রবণতার মডেল", "Price pattern model"],
};

export function AdviceForm({
  locale,
  lotId,
  children,
}: {
  locale: Locale;
  lotId: string;
  children: ReactNode;
}) {
  const [state, submit, pending] = useActionState(
    runAdvice.bind(null, lotId),
    {},
  );
  const result = state.result;
  const label = (key: string) => local(locale, ...(labels[key] ?? [key, key]));
  return (
    <>
      <form
        action={submit}
        className="work-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => submit(data));
        }}
      >
        {children}
        {state.error && (
          <p className="form-error" role="alert">
            {errorText(locale, state.error)}
          </p>
        )}
        <button type="submit" className="refresh" disabled={pending}>
          {pending
            ? local(locale, "হিসাব চলছে…", "Comparing…")
            : local(locale, "তুলনা করুন", "Compare scenarios")}
        </button>
      </form>
      {result && (
        <section className="work-panel" aria-live="polite">
          <DataChart
            locale={locale}
            title={local(locale, "নিট আয়ের পরিস্থিতি", "Net proceeds scenarios")}
            summary={local(
              locale,
              "আপনার খরচ ও ক্ষতির ধারণার ভিত্তিতে একই পরিমাণের তুলনা; নিশ্চিত আয় নয়।",
              "Same-quantity comparison using your cost and loss assumptions; proceeds are not guaranteed.",
            )}
            points={scenarioPoints(result, [
              local(locale, "এখন", "Now"),
              local(locale, "পরে · নিম্ন", "Later · low"),
              local(locale, "পরে · মধ্য", "Later · middle"),
              local(locale, "পরে · উচ্চ", "Later · high"),
            ])}
            unit={local(locale, "টাকা", "BDT")}
            bars
          />
          <h2>{label(result.recommendation)}</h2>
          <p>
            {local(locale, "প্রমাণের আস্থা", "Evidence confidence")} ·{" "}
            {label(result.confidence)}
          </p>
          <p>
            {numberLabel(locale, result.quantity_kg)}{" "}
            {local(locale, "কেজি তুলনা করা হয়েছে", "kg compared")} ·{" "}
            {numberLabel(locale, result.horizon_days)}{" "}
            {local(locale, "দিন", "days")} ·{" "}
            {numberLabel(locale, result.loss_pct)}%{" "}
            {result.loss_source === "experimental_model"
              ? local(
                  locale,
                  "মডেলের মধ্যম ক্ষতির হিসাব",
                  "model's middle loss estimate",
                )
              : local(locale, "ধরা ক্ষতি", "assumed loss")}
          </p>
          {result.loss_estimate && (
            <p>
              {local(
                locale,
                "পরীক্ষামূলক ওজন ক্ষতির পরিসর",
                "Experimental weight loss range",
              )}{" "}
              {numberLabel(locale, result.loss_estimate.low_pct)}%–
              {numberLabel(locale, result.loss_estimate.high_pct)}%{" · "}
              {numberLabel(locale, result.loss_estimate.readings)}{" "}
              {local(locale, "যাচাইকৃত ওজন", "verified weights")}
            </p>
          )}
          <dl className="work-metrics">
            {[
              [
                local(locale, "এখন বিক্রি", "Sell now net"),
                result.sell_now_net_bdt,
              ],
              [
                local(locale, "অপেক্ষা · নিম্ন", "Hold · downside"),
                result.hold_low_bdt,
              ],
              [
                local(locale, "অপেক্ষা · মধ্য", "Hold · middle"),
                result.hold_middle_bdt,
              ],
              [
                local(locale, "অপেক্ষা · উচ্চ", "Hold · upside"),
                result.hold_high_bdt,
              ],
            ].map(([name, amount]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>
                  {amount === null
                    ? "—"
                    : `৳${numberLabel(locale, amount, true)}`}
                </dd>
              </div>
            ))}
          </dl>
          <p>
            {local(locale, "এখনকার মোট খরচ", "Current total costs")} ৳
            {numberLabel(locale, result.now_cost_bdt, true)} ·{" "}
            {local(locale, "অপেক্ষার মোট খরচ", "Holding total costs")} ৳
            {numberLabel(locale, result.later_cost_bdt, true)}
          </p>
          {result.sale_now_source && (
            <p>
              {local(locale, "এখনকার দরের ভিত্তি", "Current price basis")} ·{" "}
              {label(result.sale_now_source)}
            </p>
          )}
          {result.future_source && (
            <p>
              {local(locale, "ভবিষ্যতের দরের ভিত্তি", "Future price basis")} ·{" "}
              {label(result.future_source)}
            </p>
          )}
          <ul className="work-bullets">
            {result.reasons.map((item) => (
              <li key={item}>{label(item)}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
