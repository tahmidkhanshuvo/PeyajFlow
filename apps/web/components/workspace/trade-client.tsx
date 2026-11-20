"use client";

import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { mutate } from "../../app/[locale]/workspace/actions";
import { pilotMutate } from "../../app/[locale]/workspace/pilot-actions";
import type { Locale } from "../../lib/copy";
import type { Logistics } from "../../lib/pilot-types";
import { local } from "../../lib/workspace-copy";
import type { Profile } from "../../lib/workspace-api";
import type { OfferDetail } from "../../lib/workspace-types";
import { dhakaToday, numberLabel, timeLabel } from "../../lib/workspace-values";
import { DecimalField, RequestKey } from "./fields";
import { WorkspaceForm } from "./form";
import { LocationIcon } from "./location-icon";

function taka(locale: Locale, amount: string) {
  return `৳${numberLabel(locale, amount, true)}`;
}

function kg(locale: Locale, value: string) {
  return `${numberLabel(locale, value)} ${local(locale, "কেজি", "kg")}`;
}

const states: Record<string, [string, string]> = {
  sent: ["পাঠানো হয়েছে", "Sent"],
  countered: ["পাল্টা অফার", "Countered"],
  accepted: ["গ্রহণ করা হয়েছে", "Accepted"],
  rejected: ["প্রত্যাখ্যাত", "Rejected"],
  withdrawn: ["প্রত্যাহার করা হয়েছে", "Withdrawn"],
  expired: ["মেয়াদ শেষ", "Expired"],
  confirmed: ["নিশ্চিত", "Confirmed"],
  dispatched: ["পাঠানো হয়েছে", "Dispatched"],
  delivered: ["গ্রহণ করা হয়েছে", "Received"],
  cancelled: ["বাতিল", "Cancelled"],
  disputed: ["বিরোধ আছে", "Disputed"],
  dispute_resolved: ["বিরোধ নিষ্পত্তি", "Dispute resolved"],
};

export function state(locale: Locale, status: string) {
  return local(locale, ...(states[status] ?? [status, status]));
}

/* ─────────────────────────────────────────────────────────────
   OFFER ACTION POP-UP MODAL (Accept, Counter, Reject, Withdraw)
   ───────────────────────────────────────────────────────────── */
export function OfferActionModal({
  locale,
  offer,
  action,
  label,
  btnClass = "",
}: {
  locale: Locale;
  offer: OfferDetail;
  action: "accept" | "reject" | "counter" | "withdraw";
  label: string;
  btnClass?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const t = (bn: string, en: string) => local(locale, bn, en);

  const titles = {
    accept: t("অফার গ্রহণ করুন", "Accept Offer"),
    counter: t("পাল্টা অফার পাঠান", "Send Counter Offer"),
    reject: t("অফার প্রত্যাখ্যান করুন", "Reject Offer"),
    withdraw: t("অফার প্রত্যাহার করুন", "Withdraw Offer"),
  };

  return (
    <>
      <button
        type="button"
        className={`offer-action-popup-btn ${btnClass}`}
        onClick={() => setOpen(true)}
      >
        <span>{label}</span>
      </button>

      {open &&
        createPortal(
          <div
            className="stock-modal-backdrop"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              className="stock-modal-dialog offer-action-dialog"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="stock-modal-header">
                <div className="offer-modal-header-info">
                  <h2 className="stock-modal-title">{titles[action]}</h2>
                  <span className="offer-modal-subtitle">
                    #{offer.id.slice(0, 8)} · {offer.lot_label}
                  </span>
                </div>
                <button
                  type="button"
                  className="stock-modal-close"
                  onClick={() => setOpen(false)}
                  aria-label={t("বন্ধ করুন", "Close")}
                >
                  ✕
                </button>
              </div>

              <div className="stock-modal-body">
                {/* Summary Box */}
                <div className="offer-modal-summary-box">
                  <div className="offer-modal-summary-item">
                    <span className="offer-modal-summary-label">
                      {t("লট ও জাত", "Lot & Variety")}
                    </span>
                    <strong className="offer-modal-summary-val">
                      {offer.lot_label} · {offer.variety}
                    </strong>
                  </div>
                  <div className="offer-modal-summary-item">
                    <span className="offer-modal-summary-label">
                      {t("বর্তমান শর্ত", "Current Terms")}
                    </span>
                    <strong className="offer-modal-summary-val">
                      {kg(locale, offer.quantity_kg)} @{" "}
                      {taka(locale, offer.price_bdt_kg)}/{t("কেজি", "kg")}
                    </strong>
                  </div>
                  <div className="offer-modal-summary-item">
                    <span className="offer-modal-summary-label">
                      {t("মোট মূল্য", "Total Value")}
                    </span>
                    <strong className="offer-modal-summary-val highlight">
                      {taka(locale, offer.total_bdt)}
                    </strong>
                  </div>
                </div>

                <WorkspaceForm
                  locale={locale}
                  action={mutate.bind(
                    null,
                    locale,
                    "offer-reply",
                    offer.id,
                    action,
                  )}
                  label={titles[action]}
                >
                  <RequestKey />
                  <input type="hidden" name="version" value={offer.version} />

                  {action === "accept" && (
                    <div className="offer-form-field-group">
                      <label className="checkbox offer-checkbox">
                        <input type="checkbox" name="confirm" required />
                        <span>
                          {t(
                            "আমি প্রস্তাবিত শর্তাবলী পর্যালোচনা করেছি এবং মজুত সংরক্ষণ নিশ্চিত করছি।",
                            "I reviewed the terms and confirm the stock reservation.",
                          )}
                        </span>
                      </label>
                    </div>
                  )}

                  {action === "counter" && (
                    <div className="work-grid offer-counter-grid">
                      <DecimalField
                        name="quantity_kg"
                        label={t("নতুন পরিমাণ (কেজি)", "New quantity (kg)")}
                        value={offer.quantity_kg}
                      />
                      <DecimalField
                        name="price_bdt_kg"
                        label={t("নতুন দর (৳/কেজি)", "New price (BDT/kg)")}
                        value={offer.price_bdt_kg}
                      />
                    </div>
                  )}

                  {action === "reject" && (
                    <div className="offer-confirm-prompt">
                      <p>
                        {t(
                          "আপনি কি নিশ্চিত যে এই অফারটি প্রত্যাখ্যান করতে চান? এই সিদ্ধান্ত প্রত্যাহারযোগ্য নয়।",
                          "Are you sure you want to reject this offer? This action cannot be undone.",
                        )}
                      </p>
                    </div>
                  )}

                  {action === "withdraw" && (
                    <div className="offer-confirm-prompt">
                      <p>
                        {t(
                          "আপনি কি আপনার দেওয়া অফারটি প্রত্যাহার করতে চান?",
                          "Are you sure you want to withdraw your offer?",
                        )}
                      </p>
                    </div>
                  )}
                </WorkspaceForm>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   OFFER HISTORY POP-UP MODAL (Clean popup screen)
   ───────────────────────────────────────────────────────────── */
export function OfferHistoryModal({
  locale,
  offer,
}: {
  locale: Locale;
  offer: OfferDetail;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const t = (bn: string, en: string) => local(locale, bn, en);

  const isExpired = new Date(offer.expires_at) < new Date();
  const statusClass =
    offer.status === "accepted"
      ? "verified"
      : offer.status === "rejected" || offer.status === "cancelled"
        ? "rejected"
        : isExpired
          ? "expired"
          : "pending";

  return (
    <>
      <button
        type="button"
        className="stock-row-action-pill offer-history-btn"
        onClick={() => setOpen(true)}
        title={t(
          "অফারের ইতিহাস ও বিবরণ দেখুন",
          "View offer history and details",
        )}
      >
        <span>{t("ইতিহাস", "History")}</span>
        <span className="stock-row-arrow" aria-hidden="true">
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
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </span>
      </button>

      {open &&
        createPortal(
          <div
            className="stock-modal-backdrop"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              className="stock-modal-dialog offer-history-dialog"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="stock-modal-header">
                <div className="offer-modal-header-info">
                  <div className="offer-modal-header-top">
                    <span className="trade-card-hash">
                      #{offer.id.slice(0, 8)}
                    </span>
                    <span className={`trade-status-pill ${statusClass}`}>
                      <span className="trade-status-dot" aria-hidden="true" />
                      {state(locale, offer.status)}
                    </span>
                  </div>
                  <h2 className="stock-modal-title">
                    {offer.lot_label} · {offer.variety}
                  </h2>
                </div>
                <button
                  type="button"
                  className="stock-modal-close"
                  onClick={() => setOpen(false)}
                  aria-label={t("বন্ধ করুন", "Close")}
                >
                  ✕
                </button>
              </div>

              <div className="stock-modal-body">
                {/* Clean Essential Terms */}
                <div className="offer-history-terms-grid">
                  <div className="offer-term-card">
                    <span className="offer-term-label">
                      {t("পরিমাণ", "Quantity")}
                    </span>
                    <strong className="offer-term-val">
                      {kg(locale, offer.quantity_kg)}
                    </strong>
                  </div>
                  <div className="offer-term-card">
                    <span className="offer-term-label">
                      {t("দর (প্রতি কেজি)", "Price / kg")}
                    </span>
                    <strong className="offer-term-val">
                      {taka(locale, offer.price_bdt_kg)} / {t("কেজি", "kg")}
                    </strong>
                  </div>
                  <div className="offer-term-card">
                    <span className="offer-term-label">
                      {t("মোট মূল্য", "Total Value")}
                    </span>
                    <strong className="offer-term-val highlight">
                      {taka(locale, offer.total_bdt)}
                    </strong>
                  </div>
                  <div className="offer-term-card">
                    <span className="offer-term-label">
                      {t("ক্রেতা", "Buyer")}
                    </span>
                    <strong className="offer-term-val">
                      {offer.buyer_name}
                    </strong>
                  </div>
                  <div className="offer-term-card">
                    <span className="offer-term-label">
                      {t("সরবরাহ এলাকা", "Delivery Area")}
                    </span>
                    <strong className="offer-term-val">
                      {offer.delivery_district}
                    </strong>
                  </div>
                  <div className="offer-term-card">
                    <span className="offer-term-label">
                      {t("পরিবহন", "Transport")}
                    </span>
                    <strong className="offer-term-val">
                      {offer.transport === "buyer"
                        ? t("ক্রেতার দায়িত্ব", "Buyer arranges")
                        : t("বিক্রেতার দায়িত্ব", "Seller arranges")}
                    </strong>
                  </div>
                </div>

                {/* Negotiation Timeline */}
                <div className="offer-history-timeline-section">
                  <h3 className="offer-history-section-title">
                    {t(
                      "দরকষাকষি ও পরিবর্তন ইতিহাস",
                      "Negotiation & Activity History",
                    )}
                  </h3>

                  <ul className="offer-history-timeline">
                    {offer.activity && offer.activity.length > 0 ? (
                      offer.activity.map((entry, idx) => (
                        <li
                          key={`activity-${entry.version ?? "v"}-${entry.recorded_at ?? ""}-${idx}`}
                          className="offer-history-timeline-item"
                        >
                          <span className="offer-history-timeline-dot" />
                          <div className="offer-history-timeline-content">
                            <div className="offer-history-timeline-row">
                              <span className="offer-history-action-tag">
                                {state(locale, entry.action)}
                              </span>
                              <span className="offer-history-time">
                                {timeLabel(locale, entry.recorded_at)}
                              </span>
                            </div>
                            <div className="offer-history-by-line">
                              <span className="offer-history-muted">
                                {t("অংশগ্রহণকারী", "Participant")}:
                              </span>{" "}
                              <strong>{entry.by}</strong>
                            </div>
                            {entry.quantity_kg !== null &&
                              entry.price_bdt_kg !== null && (
                                <div className="offer-history-terms-chip">
                                  <span>{kg(locale, entry.quantity_kg)}</span>
                                  <span className="stock-row-dot">•</span>
                                  <span>
                                    {taka(locale, entry.price_bdt_kg)} /{" "}
                                    {t("কেজি", "kg")}
                                  </span>
                                </div>
                              )}
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="offer-history-timeline-item">
                        <span className="offer-history-timeline-dot" />
                        <div className="offer-history-timeline-content">
                          <div className="offer-history-timeline-row">
                            <span className="offer-history-action-tag">
                              {state(locale, offer.status)}
                            </span>
                            <span className="offer-history-time">
                              {timeLabel(locale, offer.expires_at)}
                            </span>
                          </div>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="offer-history-modal-footer">
                  <button
                    type="button"
                    className="offer-modal-cancel-btn"
                    onClick={() => setOpen(false)}
                  >
                    {t("বন্ধ করুন", "Close")}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   OFFER ROW ITEM (Listed horizontal row like stock page)
   ───────────────────────────────────────────────────────────── */
export function OfferRowItem({
  locale,
  offer,
  actor,
}: {
  locale: Locale;
  offer: OfferDetail;
  actor: Profile;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const open =
    ["sent", "countered"].includes(offer.status) && actor.role !== "admin";
  const proposer = actor.membership_id === offer.proposer_id;

  const isExpired = new Date(offer.expires_at) < new Date();
  const statusClass =
    offer.status === "accepted"
      ? "verified"
      : offer.status === "rejected" || offer.status === "cancelled"
        ? "rejected"
        : isExpired
          ? "expired"
          : "pending";

  return (
    <article className="offer-card-row">
      {/* Top Header: Hash ID, Lot Label & Variety, Grade, and Status Pill */}
      <div className="offer-card-top">
        <div className="offer-card-identity">
          <span className="trade-card-hash">#{offer.id.slice(0, 8)}</span>
          <h3 className="offer-card-title">
            {offer.lot_label} · {offer.variety}
          </h3>
          {offer.grade && (
            <span className="trade-grade-pill">
              {t("গ্রেড", "Grade")} {offer.grade}
            </span>
          )}
        </div>
        <div className="offer-card-status-wrap">
          <span className={`trade-status-pill ${statusClass}`}>
            <span className="trade-status-dot" aria-hidden="true" />
            {state(locale, offer.status)}
          </span>
        </div>
      </div>

      {/* Middle Meta Strip: Buyer, Location, Quantity & Unit Rate */}
      <div className="offer-card-meta-strip">
        <span className="offer-card-buyer">
          <span className="offer-meta-label">{t("ক্রেতা", "Buyer")}:</span>{" "}
          <strong>{offer.buyer_name}</strong>
          {offer.buyer_verified && (
            <span
              className="stock-verified-badge"
              title={t("যাচাইকৃত", "Verified")}
            >
              ✓
            </span>
          )}
        </span>
        <span className="offer-meta-sep">•</span>
        <span className="offer-card-location">
          <LocationIcon size={14} />
          <span>{offer.delivery_district}</span>
        </span>
        <span className="offer-meta-sep">•</span>
        <span className="offer-card-rate">
          <span>{kg(locale, offer.quantity_kg)}</span>
          <span className="offer-meta-dim"> @ </span>
          <span>
            {taka(locale, offer.price_bdt_kg)}/{t("কেজি", "kg")}
          </span>
        </span>
      </div>

      {/* Bottom Footer: Total Value on Left, Action Pop-up Buttons + History Pop-up Button on Right */}
      <div className="offer-card-footer">
        <div className="offer-card-value-box">
          <span className="offer-card-value-label">
            {t("মোট মূল্য", "TOTAL VALUE")}
          </span>
          <strong className="offer-card-value-val">
            {taka(locale, offer.total_bdt)}
          </strong>
        </div>

        <div className="offer-card-actions">
          {open && (
            <div className="offer-action-buttons-group">
              {proposer ? (
                <OfferActionModal
                  locale={locale}
                  offer={offer}
                  action="withdraw"
                  label={t("প্রত্যাহার", "Withdraw offer")}
                  btnClass="offer-btn-withdraw"
                />
              ) : (
                <>
                  <OfferActionModal
                    locale={locale}
                    offer={offer}
                    action="accept"
                    label={t("গ্রহণ", "Accept offer")}
                    btnClass="offer-btn-accept"
                  />
                  <OfferActionModal
                    locale={locale}
                    offer={offer}
                    action="counter"
                    label={t("পাল্টা অফার", "Counter offer")}
                    btnClass="offer-btn-counter"
                  />
                  <OfferActionModal
                    locale={locale}
                    offer={offer}
                    action="reject"
                    label={t("প্রত্যাখ্যান", "Reject offer")}
                    btnClass="offer-btn-reject"
                  />
                </>
              )}
            </div>
          )}

          {/* History Pop-up Button */}
          <OfferHistoryModal locale={locale} offer={offer} />
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────
   LOGISTICS STATUS HELPER
   ───────────────────────────────────────────────────────────── */
const logisticsStates: Record<string, [string, string]> = {
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

function logisticsState(locale: Locale, status: string) {
  return local(locale, ...(logisticsStates[status] ?? [status, status]));
}

/* ─────────────────────────────────────────────────────────────
   ORDER ACTION POP-UP MODAL (Report dispute, Dispatch, Receive, Cancel)
   ───────────────────────────────────────────────────────────── */
export function OrderActionModal({
  locale,
  orderId,
  orderLabel,
  action,
  label,
  btnClass = "",
}: {
  locale: Locale;
  orderId: string;
  orderLabel: string;
  action: "dispatch" | "receive" | "cancel" | "dispute";
  label: string;
  btnClass?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const t = (bn: string, en: string) => local(locale, bn, en);

  const titles: Record<string, string> = {
    dispatch: t("পণ্য পাঠানো নিশ্চিত করুন", "Confirm Dispatch"),
    receive: t("পণ্য গ্রহণ নিশ্চিত করুন", "Confirm Receipt"),
    cancel: t("অর্ডার বাতিল করুন", "Cancel Order"),
    dispute: t("বিরোধ উত্থাপন করুন", "Report Dispute"),
  };

  const descriptions: Record<string, string> = {
    dispatch: t(
      "পণ্য পরিবহনকারীকে বুঝিয়ে দেওয়া হয়েছে এবং গন্তব্যের উদ্দেশ্যে রওনা হয়েছে তা নিশ্চিত করুন।",
      "Confirm that the goods have been dispatched and are currently in transit.",
    ),
    receive: t(
      "পণ্য বুঝে পেয়েছেন এবং গুণমান সন্তোষজনক তা নিশ্চিত করুন। এর মাধ্যমে অর্ডারটি সম্পন্ন হবে।",
      "Confirm that the shipment has been safely delivered and received in good condition.",
    ),
    cancel: t(
      "আপনি কি নিশ্চিত যে এই অর্ডারটি বাতিল করতে চান? সংরক্ষিত মজুত উন্মুক্ত করা হবে।",
      "Are you sure you want to cancel this order? This action cannot be undone.",
    ),
    dispute: t(
      "অর্ডারের গুণমান, পরিমাণ বা বিতরণ নিয়ে কোনো সমস্যা থাকলে বিরোধ জানান। আমাদের সাপোর্ট টিম দ্রুত সহায়তা প্রদান করবে।",
      "Report an issue or dispute regarding this order. Our support team will investigate and assist.",
    ),
  };

  const confirmTexts: Record<string, string> = {
    dispatch: t(
      "আমি পণ্য প্রেরণের তথ্য নিশ্চিত করছি।",
      "I confirm the goods have been dispatched.",
    ),
    receive: t(
      "আমি পণ্য বুঝে নেওয়ার বিষয়টি নিশ্চিত করছি।",
      "I confirm receipt of this shipment.",
    ),
    cancel: t(
      "আমি অর্ডার বাতিলের সিদ্ধান্ত নিশ্চিত করছি।",
      "I confirm order cancellation.",
    ),
    dispute: t(
      "আমি বিরোধ উত্থাপনের বিষয়টি নিশ্চিত করছি।",
      "I confirm reporting this dispute.",
    ),
  };

  const actionIcons: Record<string, string> = {
    dispatch: "📦",
    receive: "✓",
    cancel: "✕",
    dispute: "⚠",
  };

  return (
    <>
      <button
        type="button"
        className={`stock-action-pill-btn ${btnClass}`}
        onClick={() => setOpen(true)}
      >
        <span className="stock-action-pill-icon" aria-hidden="true">
          {actionIcons[action] || "•"}
        </span>
        <span>{label}</span>
      </button>

      {open &&
        createPortal(
          <div
            className="stock-modal-backdrop"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              className={`stock-modal-dialog order-action-dialog ${action === "dispute" || action === "cancel" ? "danger-mode" : ""}`}
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="stock-modal-header">
                <div className="offer-modal-header-info">
                  <h2 className="stock-modal-title">
                    {titles[action] || label}
                  </h2>
                  <span className="offer-modal-subtitle">
                    #{orderId.slice(0, 8)} · {orderLabel}
                  </span>
                </div>
                <button
                  type="button"
                  className="stock-modal-close"
                  onClick={() => setOpen(false)}
                  aria-label={t("বন্ধ করুন", "Close")}
                >
                  ✕
                </button>
              </div>

              <div className="stock-modal-body">
                <p className="order-modal-description">
                  {descriptions[action]}
                </p>

                <WorkspaceForm
                  locale={locale}
                  action={mutate.bind(null, locale, "order", orderId, action)}
                  label={titles[action] || label}
                >
                  <RequestKey />
                  <div className="offer-form-field-group">
                    <label className="checkbox offer-checkbox">
                      <input type="checkbox" name="confirm" required />
                      <span>
                        {confirmTexts[action] ||
                          t(
                            "আমি এই পরিবর্তন নিশ্চিত করছি।",
                            "I confirm this action.",
                          )}
                      </span>
                    </label>
                  </div>
                </WorkspaceForm>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   ORDER LOGISTICS POP-UP MODAL (Transport and quotes clean popup)
   ───────────────────────────────────────────────────────────── */
export function OrderLogisticsModal({
  locale,
  orderId,
  orderLabel,
  logistics,
  actor,
  quantityKg,
  goodsTotal,
  orderStatus,
}: {
  locale: Locale;
  orderId: string;
  orderLabel: string;
  logistics: Logistics | null;
  actor: Profile;
  quantityKg: string;
  goodsTotal: string;
  orderStatus: string;
}) {
  const [open, setOpen] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const t = (bn: string, en: string) => local(locale, bn, en);

  const responsibleText =
    (logistics?.responsible ?? "buyer") === "buyer"
      ? t("ক্রেতার দায়িত্ব", "Buyer arranges")
      : t("বিক্রেতার দায়িত্ব", "Seller arranges");

  const canRequestQuotes = Boolean(logistics?.can_request);
  const requests = logistics?.requests ?? [];

  return (
    <>
      <button
        type="button"
        className="stock-action-pill-btn order-logistics-pill-btn"
        onClick={() => setOpen(true)}
      >
        <span className="stock-action-pill-icon" aria-hidden="true">
          🚚
        </span>
        <span>{t("পরিবহন ও দর", "Transport and quotes")}</span>
      </button>

      {open &&
        createPortal(
          <div
            className="stock-modal-backdrop"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              className="stock-modal-dialog order-logistics-dialog"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="stock-modal-header">
                <div className="offer-modal-header-info">
                  <div className="offer-modal-header-top">
                    <span className="trade-card-hash">
                      #{orderId.slice(0, 8)}
                    </span>
                    <span className="trade-status-pill verified">
                      <span className="trade-status-dot" aria-hidden="true" />
                      {state(locale, orderStatus)}
                    </span>
                  </div>
                  <h2 className="stock-modal-title">
                    {t("পরিবহন ব্যবস্থাপনা ও দর", "Transport & Quotes")}
                  </h2>
                </div>
                <button
                  type="button"
                  className="stock-modal-close"
                  onClick={() => setOpen(false)}
                  aria-label={t("বন্ধ করুন", "Close")}
                >
                  ✕
                </button>
              </div>

              <div className="stock-modal-body">
                {/* Clean Overview Card */}
                <div className="offer-modal-summary-box">
                  <div className="offer-modal-summary-item">
                    <span className="offer-modal-summary-label">
                      {t("পরিবহনের দায়িত্ব", "Responsibility")}
                    </span>
                    <strong className="offer-modal-summary-val">
                      {responsibleText}
                    </strong>
                  </div>
                  <div className="offer-modal-summary-item">
                    <span className="offer-modal-summary-label">
                      {t("পণ্যের পরিমাণ", "Quantity")}
                    </span>
                    <strong className="offer-modal-summary-val">
                      {kg(locale, logistics?.quantity_kg || quantityKg)}
                    </strong>
                  </div>
                  <div className="offer-modal-summary-item">
                    <span className="offer-modal-summary-label">
                      {t("পণ্যের মূল্য", "Goods Value")}
                    </span>
                    <strong className="offer-modal-summary-val highlight">
                      {taka(locale, logistics?.goods_total_bdt || goodsTotal)}
                    </strong>
                  </div>
                </div>

                {/* Transport Requests & Quotes */}
                <div className="order-logistics-section">
                  <div className="order-logistics-section-head">
                    <h3 className="offer-history-section-title">
                      {t(
                        "পরিবহন অনুরোধ ও প্রাপ্ত দর",
                        "Transport Requests & Quotes",
                      )}
                    </h3>
                    {canRequestQuotes && !showRequestForm && (
                      <button
                        type="button"
                        className="order-logistics-new-btn"
                        onClick={() => setShowRequestForm(true)}
                      >
                        + {t("দরের অনুরোধ করুন", "Request quotes")}
                      </button>
                    )}
                  </div>

                  {requests.length > 0 ? (
                    <div className="order-logistics-requests-list">
                      {requests.map((req) => (
                        <div
                          key={req.id}
                          className="order-logistics-request-card"
                        >
                          <div className="order-logistics-req-row">
                            <strong className="order-logistics-route">
                              {req.pickup_district} → {req.delivery_district}
                            </strong>
                            <span className="trade-status-pill pending">
                              <span
                                className="trade-status-dot"
                                aria-hidden="true"
                              />
                              {logisticsState(locale, req.status)}
                            </span>
                          </div>

                          <div className="order-logistics-req-details">
                            <span>
                              {t("সংগ্রহের তারিখ", "Pickup")}:{" "}
                              <strong>
                                {timeLabel(locale, req.pickup_on)}
                              </strong>
                            </span>
                            {req.handling && (
                              <>
                                <span className="stock-row-dot">•</span>
                                <span>{req.handling}</span>
                              </>
                            )}
                          </div>

                          {req.quotes && req.quotes.length > 0 ? (
                            <div className="order-logistics-quotes-cluster">
                              <span className="order-quotes-label">
                                {t("প্রাপ্ত দরসমূহ", "Quotes received")}:
                              </span>
                              {req.quotes.map((q) => (
                                <div key={q.id} className="order-quote-row">
                                  <span>{q.provider}</span>
                                  <strong>
                                    {taka(locale, q.freight_total_bdt)}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="order-logistics-waiting">
                              {t(
                                "পরিবহনকারীদের কাছ থেকে দরের অপেক্ষায় রয়েছে।",
                                "Awaiting quotations from transporters.",
                              )}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="order-logistics-empty-box">
                      <p>
                        {t(
                          "এখনো কোনো পরিবহন অনুরোধ তৈরি করা হয়নি।",
                          "No transport requests submitted yet.",
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Submit New Quote Request Form */}
                {canRequestQuotes && showRequestForm && (
                  <div className="order-logistics-form-box">
                    <div className="order-logistics-form-header">
                      <h4>
                        {t(
                          "নতুন পরিবহন দরের অনুরোধ",
                          "New Transport Quote Request",
                        )}
                      </h4>
                      <button
                        type="button"
                        className="order-logistics-form-cancel"
                        onClick={() => setShowRequestForm(false)}
                      >
                        {t("বাতিল", "Cancel")}
                      </button>
                    </div>

                    <WorkspaceForm
                      locale={locale}
                      action={pilotMutate.bind(
                        null,
                        locale,
                        "transport",
                        orderId,
                        "",
                      )}
                      label={t("অনুরোধ জমা দিন", "Submit Request")}
                    >
                      <RequestKey />
                      <div className="work-grid order-logistics-form-grid">
                        <div className="field">
                          <label>{t("সংগ্রহের তারিখ", "Pickup date")}</label>
                          <input
                            name="pickup_on"
                            type="date"
                            min={dhakaToday()}
                            defaultValue={dhakaToday()}
                            required
                          />
                        </div>
                        <div className="field">
                          <label>
                            {t("মাল তোলার নির্দেশনা", "Handling instructions")}
                          </label>
                          <input
                            name="handling"
                            maxLength={100}
                            placeholder={t(
                              "যেমন: সাবধানে লোড করুন",
                              "e.g., Load with care",
                            )}
                            required
                          />
                        </div>
                      </div>
                    </WorkspaceForm>
                  </div>
                )}

                <div className="offer-history-modal-footer">
                  <button
                    type="button"
                    className="offer-modal-cancel-btn"
                    onClick={() => setOpen(false)}
                  >
                    {t("বন্ধ করুন", "Close")}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
