import Link from "next/link";
import { operate } from "../../app/[locale]/workspace/operations-actions";
import type { Locale } from "../../lib/copy";
import { api } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type { Payment, Settlement } from "../../lib/workspace-types";
import { timeLabel } from "../../lib/workspace-values";
import { Details, Field, RequestKey } from "./fields";
import { WorkspaceForm } from "./form";
import { WorkspaceIcon } from "./icon";
import { taka } from "./market";

const statuses = {
  pending: ["অর্থপ্রদানের তথ্যের অপেক্ষায়", "Awaiting payment report"],
  reported: ["অর্থপ্রদানের তথ্য জমা হয়েছে", "Payment reported"],
  verified: ["অর্থপ্রদান যাচাই হয়েছে", "Payment verified"],
  rejected: ["প্রতিবেদন প্রত্যাখ্যাত", "Report rejected"],
} as const;

export function OrderSettlement({
  locale,
  id,
  data,
  mayReport,
}: {
  locale: Locale;
  id: string;
  data: Settlement;
  mayReport: boolean;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const [statusBn, statusEn] = statuses[data.status];

  const statusClass = data.status === "verified" ? "verified" : "pending";

  return (
    <section className="work-panel lot-details-page-panel settlement-panel glass-1">
      {/* Header Row */}
      <div className="lot-page-header-row settlement-header-row">
        <div>
          <div className="dash-quality-eyebrow">
            <span className="dash-pulse-dot" aria-hidden="true" />
            <span>
              {t("অর্থপ্রদান ও লেনদেনের রেকর্ড", "PAYMENT & SETTLEMENT")}
            </span>
          </div>
          <h2 className="lot-page-title settlement-title">
            {t("অর্থপ্রদানের বিবরণ", "Settlement Details")}
          </h2>
          <p className="settlement-desc">
            {t(
              "অর্ডারের বাইরে পরিশোধ করা অর্থের তথ্য এখানে নথিভুক্ত হয়। যাচাই করেন একজন দায়িত্বপ্রাপ্ত অপারেটর।",
              "This records off-platform payment for the order, verified by an authorized operator.",
            )}
          </p>
        </div>

        <div className="settlement-status-wrap">
          <span className={`trade-status-pill ${statusClass}`}>
            <span className="trade-status-dot" aria-hidden="true" />
            {t(statusBn, statusEn)}
          </span>
        </div>
      </div>

      {/* Main Grid Orientation: Financial Summary on Left, Transaction Evidence on Right */}
      <div className="settlement-grid">
        {/* Left Sub-card: Goods Total & Settlement Status */}
        <div className="settlement-card-tile settlement-amount-tile">
          <span className="settlement-tile-label">
            {t("পণ্যের মোট মূল্য", "GOODS TOTAL PAYABLE")}
          </span>
          <strong className="settlement-amount-val">
            {taka(locale, data.total_bdt)}
          </strong>
          <span className="settlement-tile-note">
            {data.status === "verified"
              ? t(
                  "অপারেটর দ্বারা অর্থপ্রদান সম্পূর্ণ যাচাইকৃত",
                  "Payment verified by operations desk",
                )
              : data.status === "reported"
                ? t(
                    "যাচাইয়ের জন্য অপেক্ষমাণ",
                    "Submitted and awaiting verification",
                  )
                : t(
                    "অর্থপ্রদানের তথ্যের অপেক্ষায়",
                    "Awaiting off-platform payment confirmation",
                  )}
          </span>
        </div>

        {/* Right Sub-card: Payment Reports & Transaction Reference */}
        <div className="settlement-card-tile settlement-reports-tile">
          <span className="settlement-tile-label">
            {t("লেনদেনের রেফারেন্স ও প্রমাণ", "TRANSACTION REFERENCE & EVIDENCE")}
          </span>

          {data.reports.length > 0 ? (
            <div className="settlement-reports-list">
              {data.reports.map((report) => (
                <div key={report.id} className="settlement-report-item">
                  <div className="settlement-report-main">
                    <span className="settlement-ref-badge">
                      <WorkspaceIcon name="tag" size={14} />
                      <strong>{report.reference}</strong>
                    </span>
                    <span className="settlement-report-time">
                      <WorkspaceIcon name="clock" size={13} />
                      <time dateTime={report.reported_at}>
                        {timeLabel(locale, report.reported_at)}
                      </time>
                    </span>
                  </div>

                  {report.status === "rejected" ? (
                    <span className="trade-status-pill rejected">
                      <span className="trade-status-dot" aria-hidden="true" />
                      {t(...statuses.rejected)}
                    </span>
                  ) : (
                    <span className="trade-status-pill verified">
                      <span className="trade-status-dot" aria-hidden="true" />
                      {t(...statuses.verified)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="settlement-empty-reports">
              <span className="settlement-empty-text">
                {t(
                  "এখনো কোনো অর্থপ্রদানের তথ্য জমা দেওয়া হয়নি।",
                  "No transaction reference reported yet.",
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Reporting Form for Buyer */}
      {mayReport && data.status === "pending" && (
        <div className="settlement-report-form-wrap">
          <Details
            label={t("অর্থপ্রদানের তথ্য জমা দিন", "Report off-platform payment")}
          >
            <WorkspaceForm
              locale={locale}
              action={operate.bind(null, locale, "report-payment", id)}
              label={t("প্রতিবেদন জমা দিন", "Submit payment report")}
            >
              <RequestKey />
              <Field
                label={t(
                  "লেনদেনের রেফারেন্স (ব্যাংক / এমএফএস ট্রানজেকশন আইডি)",
                  "Transaction reference (Bank / MFS ID)",
                )}
              >
                <input
                  name="reference"
                  minLength={3}
                  maxLength={100}
                  placeholder={t(
                    "যেমন: TRX92817462 বা ব্যাংক ভাউচার নং",
                    "e.g., TRX92817462 or Bank voucher ref",
                  )}
                  required
                />
              </Field>
              <label className="checkbox">
                <input type="checkbox" name="confirm" required />
                {t(
                  "এই অর্ডারের সম্পূর্ণ পণ্যমূল্য পরিশোধের তথ্য দিচ্ছি।",
                  "I confirm payment for the full goods total.",
                )}
              </label>
            </WorkspaceForm>
          </Details>
        </div>
      )}
    </section>
  );
}

type QueueEntry = Payment & {
  order_id: string;
  lot_label: string;
  total_bdt: string;
};

export async function SettlementQueue({
  locale,
  base,
  offset,
}: {
  locale: Locale;
  base: string;
  offset: number;
}) {
  const rows = await api<QueueEntry[]>(
    `/v1/admin/settlements?offset=${offset}`,
  );
  const t = (bn: string, en: string) => local(locale, bn, en);
  return (
    <section className="work-panel">
      <h2>{t("অর্থপ্রদান যাচাই", "Review payment reports")}</h2>
      {!rows.length && (
        <p>
          {t(
            "এই পৃষ্ঠায় যাচাই বাকি নেই।",
            "No payment reports await review on this page.",
          )}
        </p>
      )}
      <ul className="work-history">
        {rows.map((row) => (
          <li key={row.id}>
            <Link className="work-link" href={`${base}/orders/${row.order_id}`}>
              {row.lot_label}
            </Link>
            <p>
              {taka(locale, row.total_bdt)} · {row.reference}
            </p>
            <Details label={t("প্রতিবেদন পর্যালোচনা করুন", "Review report")}>
              <WorkspaceForm
                locale={locale}
                action={operate.bind(
                  null,
                  locale,
                  "review-payment",
                  row.order_id,
                )}
                label={t("সিদ্ধান্ত সংরক্ষণ করুন", "Save payment review")}
              >
                <input type="hidden" name="payment_id" value={row.id} />
                <Field label={t("সিদ্ধান্ত", "Review decision")}>
                  <select name="decision" required defaultValue="">
                    <option value="" disabled>
                      {t("বেছে নিন", "Choose a decision")}
                    </option>
                    <option value="verified">
                      {t("যাচাই হয়েছে", "Verified")}
                    </option>
                    <option value="rejected">
                      {t("প্রত্যাখ্যাত", "Rejected")}
                    </option>
                  </select>
                </Field>
                <Field
                  label={t(
                    "স্বতন্ত্র প্রমাণের রেফারেন্স",
                    "Independent evidence reference",
                  )}
                >
                  <input
                    name="evidence_reference"
                    minLength={3}
                    maxLength={100}
                    required
                  />
                </Field>
                <label className="checkbox">
                  <input type="checkbox" name="confirm" required />
                  {t(
                    "ক্রেতার প্রতিবেদনের বাইরে প্রমাণ মিলিয়ে দেখেছি।",
                    "I reviewed evidence independently of the buyer’s report.",
                  )}
                </label>
              </WorkspaceForm>
            </Details>
          </li>
        ))}
      </ul>
      <div className="work-row">
        {offset > 0 && (
          <Link
            className="work-link"
            href={`${base}/operations?view=settlements&offset=${Math.max(0, offset - 50)}`}
          >
            {t("আগের পৃষ্ঠা", "Previous page")}
          </Link>
        )}
        {rows.length === 50 && (
          <Link
            className="work-link"
            href={`${base}/operations?view=settlements&offset=${offset + 50}`}
          >
            {t("পরের পৃষ্ঠা", "Next page")}
          </Link>
        )}
      </div>
    </section>
  );
}
