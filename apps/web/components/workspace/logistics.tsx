import Link from "next/link";
import { pilotMutate } from "../../app/[locale]/workspace/pilot-actions";
import type { Locale } from "../../lib/copy";
import type { Logistics } from "../../lib/pilot-types";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import { dhakaToday, timeLabel } from "../../lib/workspace-values";
import { DecimalField, Details, Field, RequestKey } from "./fields";
import { WorkspaceForm } from "./form";
import { taka } from "./market";
import { kg } from "./stock";

const states: Record<string, [string, string]> = {
  requested: ["দর চাওয়া হয়েছে", "Quote requested"],
  quoted: ["দর পাওয়া গেছে", "Quotes available"],
  booked: ["নির্বাচিত", "Booked"],
  cancelled: ["বাতিল", "Cancelled"],
  confirmed: ["নিশ্চিত", "Confirmed"],
  dispatched: ["পাঠানো হয়েছে", "Dispatched"],
  delivered: ["পৌঁছেছে", "Delivered"],
  disputed: ["বিরোধ", "Disputed"],
  expired: ["মেয়াদ শেষ", "Expired"],
};

export async function LogisticsPage({
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
  const data = await api<Logistics>(`/v1/orders/${id}/logistics`);
  const responsible =
    actor.role === (data.responsible === "buyer" ? "buyer" : "farmer");
  const label = (value: string) =>
    local(locale, ...(states[value] ?? [value, value]));
  return (
    <>
      <Link className="work-link" href={`${base}/orders/${id}`}>
        {local(locale, "অর্ডারে ফিরুন", "Back to order")}
      </Link>
      <section className="work-panel">
        <p>
          {kg(locale, data.quantity_kg)} · {taka(locale, data.goods_total_bdt)}{" "}
          · {label(data.order_status)}
        </p>
        <p>
          {local(locale, "পরিবহনের দায়িত্ব", "Transport responsibility")} ·{" "}
          {data.responsible === "buyer"
            ? local(locale, "ক্রেতা", "Buyer")
            : local(locale, "বিক্রেতা", "Seller")}
        </p>
        {data.can_request && (
          <Details
            label={local(locale, "পরিবহনের দর চাই", "Request transport quotes")}
          >
            <WorkspaceForm
              locale={locale}
              action={pilotMutate.bind(null, locale, "transport", id, "")}
              label={local(locale, "দরের অনুরোধ পাঠান", "Submit quote request")}
            >
              <RequestKey />
              <Field label={local(locale, "সংগ্রহের তারিখ", "Pickup date")}>
                <input
                  name="pickup_on"
                  type="date"
                  min={dhakaToday()}
                  defaultValue={dhakaToday()}
                  required
                />
              </Field>
              <Field
                label={local(
                  locale,
                  "মাল তোলার নির্দেশনা",
                  "Handling instructions",
                )}
              >
                <input name="handling" maxLength={100} required />
              </Field>
            </WorkspaceForm>
          </Details>
        )}
      </section>
      {data.requests.map((request) => (
        <article key={request.id} className="work-panel">
          <div className="work-row">
            <h2>
              {request.pickup_district} → {request.delivery_district}
            </h2>
            <span className="work-tag">{label(request.status)}</span>
          </div>
          <p>
            {timeLabel(locale, request.pickup_on)} · {request.handling}
          </p>
          {actor.role === "admin" &&
            data.order_status === "confirmed" &&
            ["requested", "quoted"].includes(request.status) && (
              <Details
                label={local(
                  locale,
                  "পরিবহনকারীর দর লিখুন",
                  "Record transporter quote",
                )}
              >
                <WorkspaceForm
                  locale={locale}
                  action={pilotMutate.bind(
                    null,
                    locale,
                    "quote",
                    id,
                    request.id,
                  )}
                  label={local(locale, "দর সংরক্ষণ", "Save quote")}
                >
                  <div className="work-grid">
                    <Field label={local(locale, "পরিবহনকারী", "Transporter")}>
                      <input name="provider" maxLength={100} required />
                    </Field>
                    <Field
                      label={local(
                        locale,
                        "দরের প্রমাণ বা রেফারেন্স",
                        "Quote reference",
                      )}
                    >
                      <input name="source_ref" maxLength={100} required />
                    </Field>
                    <DecimalField
                      name="capacity_kg"
                      label={local(locale, "ধারণক্ষমতা (কেজি)", "Capacity (kg)")}
                      value={data.quantity_kg}
                    />
                    <Field
                      label={local(locale, "সংগ্রহের তারিখ", "Pickup date")}
                    >
                      <input
                        name="pickup_on"
                        type="date"
                        min={request.pickup_on}
                        defaultValue={request.pickup_on}
                        required
                      />
                    </Field>
                    <DecimalField
                      name="freight_bdt"
                      label={local(locale, "ভাড়া (৳)", "Freight (BDT)")}
                    />
                    <DecimalField
                      name="handling_bdt"
                      label={local(
                        locale,
                        "মাল তোলার খরচ (৳)",
                        "Handling (BDT)",
                      )}
                      value="0"
                      optional
                    />
                    <Field
                      label={local(locale, "মেয়াদ (ঘণ্টা)", "Validity (hours)")}
                    >
                      <input
                        name="valid_hours"
                        type="number"
                        min="1"
                        max="168"
                        defaultValue="24"
                        required
                      />
                    </Field>
                  </div>
                </WorkspaceForm>
              </Details>
            )}
          {!request.quotes.length && (
            <p>
              {local(
                locale,
                "এখনও কোনো দর নথিভুক্ত নেই।",
                "No transporter quotes have been recorded.",
              )}
            </p>
          )}
          <ul className="work-history">
            {request.quotes.map((quote) => (
              <li key={quote.id}>
                <div className="work-row">
                  <strong>{quote.provider}</strong>
                  <span>
                    {quote.source_ref} · {kg(locale, quote.capacity_kg)}
                  </span>
                  {request.booked_quote_id === quote.id ? (
                    <span className="work-tag">{label("booked")}</span>
                  ) : (
                    quote.expired && (
                      <span className="work-tag">{label("expired")}</span>
                    )
                  )}
                </div>
                <p>
                  {local(locale, "সংগ্রহ", "Pickup")}{" "}
                  {timeLabel(locale, quote.pickup_on)} ·{" "}
                  {local(locale, "দর বৈধ", "Valid until")}{" "}
                  {timeLabel(locale, quote.valid_until)}
                </p>
                <dl className="work-metrics">
                  <div>
                    <dt>
                      {local(locale, "ভাড়া ও মাল তোলা", "Freight + handling")}
                    </dt>
                    <dd>{taka(locale, quote.freight_total_bdt)}</dd>
                  </div>
                  <div>
                    <dt>
                      {local(locale, "ক্রেতার মোট খরচ", "Buyer landed cost")}
                    </dt>
                    <dd>{taka(locale, quote.buyer_landed_bdt)}</dd>
                  </div>
                  <div>
                    <dt>
                      {local(
                        locale,
                        "ক্রেতার খরচ প্রতি কেজি",
                        "Buyer cost per kg",
                      )}
                    </dt>
                    <dd>{taka(locale, quote.buyer_landed_bdt_kg)}</dd>
                  </div>
                  <div>
                    <dt>
                      {local(
                        locale,
                        "অন্য খরচ বাদে বিক্রেতার প্রাপ্তি",
                        "Seller net before other costs",
                      )}
                    </dt>
                    <dd>
                      {taka(locale, quote.seller_net_before_other_costs_bdt)}
                    </dd>
                  </div>
                </dl>
                {responsible &&
                  request.status === "quoted" &&
                  data.order_status === "confirmed" &&
                  !quote.expired && (
                    <Details
                      label={local(
                        locale,
                        "এই দর বেছে নিন",
                        "Choose this quote",
                      )}
                    >
                      <WorkspaceForm
                        locale={locale}
                        action={pilotMutate.bind(
                          null,
                          locale,
                          "book",
                          id,
                          request.id,
                        )}
                        label={local(
                          locale,
                          "নির্বাচন নিশ্চিত করুন",
                          "Confirm booking",
                        )}
                      >
                        <input name="quote_id" type="hidden" value={quote.id} />
                        <label className="checkbox">
                          <input name="confirm" type="checkbox" required />
                          {local(
                            locale,
                            "দর ও সংগ্রহের দিন যাচাই করেছি।",
                            "I checked the quoted price and pickup date.",
                          )}
                        </label>
                      </WorkspaceForm>
                    </Details>
                  )}
              </li>
            ))}
          </ul>
          {responsible &&
            request.status !== "cancelled" &&
            ["confirmed", "cancelled", "expired"].includes(
              data.order_status,
            ) && (
              <Details
                label={local(
                  locale,
                  "পরিবহন অনুরোধ বাতিল",
                  "Cancel transport request",
                )}
              >
                <WorkspaceForm
                  locale={locale}
                  action={pilotMutate.bind(
                    null,
                    locale,
                    "cancel",
                    id,
                    request.id,
                  )}
                  label={local(
                    locale,
                    "বাতিল নিশ্চিত করুন",
                    "Confirm cancellation",
                  )}
                >
                  <label className="checkbox">
                    <input name="confirm" type="checkbox" required />
                    {local(
                      locale,
                      "পরিবহন অনুরোধ বাতিল নিশ্চিত করছি।",
                      "I confirm this transport cancellation.",
                    )}
                  </label>
                </WorkspaceForm>
              </Details>
            )}
        </article>
      ))}
    </>
  );
}
