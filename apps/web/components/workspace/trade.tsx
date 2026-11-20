import Link from "next/link";
import {
  OfferRowItem,
  OrderActionModal,
  OrderLogisticsModal,
} from "./trade-client";
import { mutate } from "../../app/[locale]/workspace/actions";
import type { Locale } from "../../lib/copy";
import type { Logistics } from "../../lib/pilot-types";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type {
  Offer,
  OfferDetail,
  Order,
  OrderDetail,
  Settlement,
} from "../../lib/workspace-types";
import { timeLabel } from "../../lib/workspace-values";
import { DecimalField, Details, RequestKey } from "./fields";
import { WorkspaceForm } from "./form";
import { LocationIcon } from "./location-icon";
import { taka } from "./market";
import { OrderSettlement } from "./settlement";
import { kg } from "./stock";

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

function state(locale: Locale, status: string) {
  return local(locale, ...(states[status] ?? [status, status]));
}

function Terms({ locale, offer }: { locale: Locale; offer: Offer }) {
  const pairs = [
    [
      local(locale, "ক্রেতা", "Buyer"),
      `${offer.buyer_name} · ${offer.buyer_verified ? local(locale, "যাচাইকৃত", "Verified") : local(locale, "যাচাই হয়নি", "Unverified")}`,
    ],
    [local(locale, "বিক্রেতা", "Seller"), offer.seller_name],
    [local(locale, "পরিমাণ", "Quantity"), kg(locale, offer.quantity_kg)],
    [
      local(locale, "প্রতি কেজির দর", "Price per kg"),
      taka(locale, offer.price_bdt_kg),
    ],
    [local(locale, "মোট মূল্য", "Total value"), taka(locale, offer.total_bdt)],
    [local(locale, "সরবরাহ", "Delivery district"), offer.delivery_district],
    [
      local(locale, "সরবরাহের সময়", "Delivery window"),
      offer.delivery_from && offer.delivery_to
        ? offer.delivery_from === offer.delivery_to
          ? timeLabel(locale, offer.delivery_from)
          : `${timeLabel(locale, offer.delivery_from)} – ${timeLabel(locale, offer.delivery_to)}`
        : local(locale, "আলোচনা সাপেক্ষ", "By arrangement"),
    ],
    [
      local(locale, "পরিবহন", "Transport"),
      offer.transport === "buyer"
        ? local(locale, "ক্রেতার দায়িত্ব", "Buyer arranges")
        : local(locale, "বিক্রেতার দায়িত্ব", "Seller arranges"),
    ],
    [local(locale, "গ্রেড", "Grade"), offer.grade],
  ];
  return (
    <dl className="work-metrics">
      {pairs.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function OfferAction({
  locale,
  offer,
  action,
  label,
}: {
  locale: Locale;
  offer: Offer;
  action: "accept" | "reject" | "counter" | "withdraw";
  label: string;
}) {
  return (
    <Details label={label}>
      <WorkspaceForm
        locale={locale}
        action={mutate.bind(null, locale, "offer-reply", offer.id, action)}
        label={label}
      >
        <RequestKey />
        <input type="hidden" name="version" value={offer.version} />
        {action === "accept" && (
          <label className="checkbox">
            <input type="checkbox" name="confirm" required />
            {local(
              locale,
              "উপরের শর্ত পড়েছি এবং মজুত সংরক্ষণ নিশ্চিত করছি।",
              "I reviewed the terms and confirm the stock reservation.",
            )}
          </label>
        )}
        {action === "counter" && (
          <div className="work-grid">
            <DecimalField
              name="quantity_kg"
              label={local(locale, "নতুন পরিমাণ (কেজি)", "New quantity (kg)")}
              value={offer.quantity_kg}
            />
            <DecimalField
              name="price_bdt_kg"
              label={local(locale, "নতুন দর (৳/কেজি)", "New price (BDT/kg)")}
              value={offer.price_bdt_kg}
            />
          </div>
        )}
      </WorkspaceForm>
    </Details>
  );
}

function TradePagination({
  locale,
  base,
  offset,
  length,
}: {
  locale: Locale;
  base: string;
  offset: number;
  length: number;
}) {
  return (
    <div className="work-row">
      {offset > 0 && (
        <Link
          className="work-link"
          href={`${base}?offset=${Math.max(0, offset - 50)}`}
        >
          {local(locale, "আগের পৃষ্ঠা", "Previous page")}
        </Link>
      )}
      {length === 50 && (
        <Link className="work-link" href={`${base}?offset=${offset + 50}`}>
          {local(locale, "পরের পৃষ্ঠা", "Next page")}
        </Link>
      )}
    </div>
  );
}

export function OfferCard({
  locale,
  offer,
  base,
  actor,
}: {
  locale: Locale;
  offer: Offer;
  base: string;
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
    <article key={offer.id} className="trade-order-card offer-card">
      {/* Top Header: Offer ID + Grade + Status */}
      <div className="trade-card-header">
        <div className="trade-card-id-wrap">
          <span className="trade-card-hash">#{offer.id.slice(0, 8)}</span>
          <span className="trade-card-variety">
            {offer.grade ? `${t("গ্রেড", "Grade")} ${offer.grade}` : offer.variety}
          </span>
        </div>
        <span className={`trade-status-pill ${statusClass}`}>
          <span className="trade-status-dot" aria-hidden="true" />
          {state(locale, offer.status)}
        </span>
      </div>

      {/* Lot Name & Counterparty */}
      <div className="trade-card-main-title">
        <h2 className="trade-card-heading">
          {offer.lot_label} · {offer.variety}
        </h2>
        <div className="trade-card-meta-strip">
          <span>
            {offer.buyer_name} ({offer.buyer_verified ? t("যাচাইকৃত", "Verified") : t("স্বঘোষিত", "Unverified")})
          </span>
          <span className="trade-meta-dot">•</span>
          <span className="trade-meta-location">
            <LocationIcon size={13} /> {offer.delivery_district}
          </span>
        </div>
      </div>

      {/* Real Dates from Backend (No fake progress slider line) */}
      <div className="trade-meta-dates">
        <span>
          <strong>{t("সরবরাহ", "Delivery")}:</strong>{" "}
          {offer.delivery_from && offer.delivery_to
            ? offer.delivery_from === offer.delivery_to
              ? timeLabel(locale, offer.delivery_from)
              : `${timeLabel(locale, offer.delivery_from)} – ${timeLabel(locale, offer.delivery_to)}`
            : t("আলোচনা সাপেক্ষ", "By arrangement")}
        </span>
        <span className="trade-meta-dot">•</span>
        <span>
          <strong>{t("মেয়াদ শেষ", "Expires")}:</strong>{" "}
          {timeLabel(locale, offer.expires_at)}
        </span>
      </div>

      <div className="trade-card-divider dashed" />

      {/* Receipt Financial Terms (All from Backend) */}
      <div className="trade-receipt-body">
        <div className="trade-receipt-row">
          <span className="trade-receipt-label">{t("পরিমাণ", "Quantity")}</span>
          <span className="trade-receipt-val">{kg(locale, offer.quantity_kg)}</span>
        </div>
        <div className="trade-receipt-row">
          <span className="trade-receipt-label">{t("প্রতি কেজির দর", "Price per kg")}</span>
          <span className="trade-receipt-val">{taka(locale, offer.price_bdt_kg)} / {t("কেজি", "kg")}</span>
        </div>
        <div className="trade-receipt-row">
          <span className="trade-receipt-label">{t("পরিবহন", "Transport")}</span>
          <span className="trade-receipt-val">
            {offer.transport === "buyer"
              ? t("ক্রেতার দায়িত্ব", "Buyer arranges")
              : t("বিক্রেতার দায়িত্ব", "Seller arranges")}
          </span>
        </div>
        <div className="trade-receipt-divider dashed" />
        <div className="trade-receipt-total">
          <span className="trade-receipt-total-label">{t("মোট মূল্য", "TOTAL VALUE")}</span>
          <strong className="trade-receipt-total-val">{taka(locale, offer.total_bdt)}</strong>
        </div>
      </div>

      {/* Interactive Actions for Active Negotiation */}
      {open && (
        <div className="trade-offer-actions-drawer">
          {proposer ? (
            <OfferAction
              locale={locale}
              offer={offer}
              action="withdraw"
              label={t("অফার প্রত্যাহার", "Withdraw offer")}
            />
          ) : (
            <div className="trade-actions-cluster">
              <OfferAction
                locale={locale}
                offer={offer}
                action="accept"
                label={t("অফার গ্রহণ", "Accept offer")}
              />
              <OfferAction
                locale={locale}
                offer={offer}
                action="counter"
                label={t("পাল্টা অফার", "Counter offer")}
              />
              <OfferAction
                locale={locale}
                offer={offer}
                action="reject"
                label={t("প্রত্যাখ্যান", "Reject offer")}
              />
            </div>
          )}
        </div>
      )}

      {/* Footer: Direct Link to Offer History (No fake actor persona/avatar, no disconnected View orders button) */}
      <div className="trade-card-footer offer-card-footer">
        <Link
          href={`${base}/offers/${offer.id}`}
          className="trade-card-action-btn"
          title={t("অফারের ইতিহাস দেখুন", "View offer history")}
        >
          <span>{t("ইতিহাস", "History")}</span>
          <span className="trade-card-circle-arrow" aria-hidden="true">
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
        </Link>
      </div>
    </article>
  );
}

export function OrderCard({
  locale,
  order,
  base,
}: {
  locale: Locale;
  order: Order;
  base: string;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const statusClass = ["delivered", "confirmed"].includes(order.status)
    ? "verified"
    : ["cancelled", "disputed"].includes(order.status)
      ? "rejected"
      : "pending";

  return (
    <article key={order.id} className="trade-order-card">
      <div className="trade-card-header">
        <div className="trade-card-id-wrap">
          <span className="trade-card-hash">#{order.id.slice(0, 8)}</span>
          <span className="trade-card-variety">{order.offer.lot_label}</span>
        </div>
        <span className={`trade-status-pill ${statusClass}`}>
          <span className="trade-status-dot" aria-hidden="true" />
          {state(locale, order.status)}
        </span>
      </div>

      <div className="trade-card-main-title">
        <h2 className="trade-card-heading">
          <Link
            href={`${base}/orders/${order.id}`}
            className="trade-card-title-link"
          >
            {order.offer.lot_label}
          </Link>
        </h2>
        <div className="trade-card-meta-strip">
          <span>{order.offer.variety}</span>
          <span className="trade-meta-dot">•</span>
          <span className="trade-meta-location">
            <LocationIcon size={13} /> {order.offer.delivery_district}
          </span>
        </div>
      </div>

      <div className="trade-card-divider dashed" />

      {/* Receipt Breakdown */}
      <div className="trade-receipt-body">
        <div className="trade-receipt-row">
          <span className="trade-receipt-label">{t("পরিমাণ", "Quantity")}</span>
          <span className="trade-receipt-val">{kg(locale, order.offer.quantity_kg)}</span>
        </div>
        <div className="trade-receipt-row">
          <span className="trade-receipt-label">{t("দর (প্রতি কেজি)", "Price per kg")}</span>
          <span className="trade-receipt-val">{taka(locale, order.offer.price_bdt_kg)}</span>
        </div>
        <div className="trade-receipt-divider dashed" />
        <div className="trade-receipt-total">
          <span className="trade-receipt-total-label">{t("মোট মূল্য", "TOTAL VALUE")}</span>
          <strong className="trade-receipt-total-val">{taka(locale, order.offer.total_bdt)}</strong>
        </div>
      </div>

      <div className="trade-card-footer order-card-footer">
        <Link
          href={`${base}/orders/${order.id}`}
          className="trade-card-action-btn"
          title={t("অর্ডারের বিবরণ দেখুন", "View order details")}
        >
          <span>{t("অর্ডার বিবরণ", "Order details")}</span>
          <span className="trade-card-circle-arrow" aria-hidden="true">
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
        </Link>
      </div>
    </article>
  );
}

export async function OffersPage({
  locale,
  actor,
  base,
  offset,
}: {
  locale: Locale;
  actor: Profile;
  base: string;
  offset: number;
}) {
  const offers = await api<Offer[]>(`/v1/offers?offset=${offset}`);
  const offersWithDetails = await Promise.all(
    offers.map((offer) =>
      api<OfferDetail>(`/v1/offers/${offer.id}`).catch(() => ({
        ...offer,
        activity: [],
      })),
    ),
  );
  return (
    <>
      {!offers.length && (
        <p className="work-panel">
          {local(locale, "এই পৃষ্ঠায় কোনো অফার নেই।", "No offers on this page.")}
        </p>
      )}
      <div className="offer-cards-list offer-rows-container">
        {offersWithDetails.map((offer) => (
          <OfferRowItem
            key={offer.id}
            locale={locale}
            offer={offer}
            actor={actor}
          />
        ))}
      </div>
      <TradePagination
        locale={locale}
        base={`${base}/offers`}
        offset={offset}
        length={offers.length}
      />
    </>
  );
}

export async function OfferHistoryPage({
  locale,
  base,
  id,
}: {
  locale: Locale;
  base: string;
  id: string;
}) {
  const offer = await api<OfferDetail>(`/v1/offers/${id}`);
  return (
    <>
      <Link className="work-link" href={`${base}/offers`}>
        {local(locale, "অফারে ফিরুন", "Back to offers")}
      </Link>
      <section className="work-panel">
        <div className="work-row">
          <h2>{offer.lot_label}</h2>
          <span className="work-tag">{state(locale, offer.status)}</span>
        </div>
        <Terms locale={locale} offer={offer} />
        <ul className="work-history">
          {offer.activity.map((entry) => (
            <li key={entry.version}>
              <strong>
                {state(locale, entry.action)} · {entry.by}
              </strong>
              {entry.quantity_kg !== null && entry.price_bdt_kg !== null && (
                <span>
                  {kg(locale, entry.quantity_kg)} ·{" "}
                  {taka(locale, entry.price_bdt_kg)}/
                  {local(locale, "কেজি", "kg")}
                </span>
              )}
              <time dateTime={entry.recorded_at}>
                {timeLabel(locale, entry.recorded_at)}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export async function OrdersPage({
  locale,
  base,
  offset,
}: {
  locale: Locale;
  base: string;
  offset: number;
}) {
  const orders = await api<Order[]>(`/v1/orders?offset=${offset}`);
  return (
    <>
      {!orders.length && (
        <p className="work-panel">
          {local(locale, "এই পৃষ্ঠায় কোনো অর্ডার নেই।", "No orders on this page.")}
        </p>
      )}
      <div className="trade-cards-grid">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            locale={locale}
            order={order}
            base={base}
          />
        ))}
      </div>
      <TradePagination
        locale={locale}
        base={`${base}/orders`}
        offset={offset}
        length={orders.length}
      />
    </>
  );
}

export async function OrderPage({
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
  const [order, settlement, logistics] = await Promise.all([
    api<OrderDetail>(`/v1/orders/${id}`),
    api<Settlement>(`/v1/orders/${id}/settlement`),
    api<Logistics>(`/v1/orders/${id}/logistics`).catch(() => null),
  ]);

  const actions: {
    action: "dispatch" | "receive" | "cancel" | "dispute";
    bn: string;
    en: string;
    btnClass?: string;
  }[] = [];

  if (actor.role === "farmer" && order.status === "confirmed")
    actions.push({
      action: "dispatch",
      bn: "পাঠানো নিশ্চিত করুন",
      en: "Confirm dispatch",
      btnClass: "order-btn-dispatch",
    });
  if (actor.role === "buyer" && order.status === "dispatched")
    actions.push({
      action: "receive",
      bn: "পণ্য গ্রহণ নিশ্চিত করুন",
      en: "Confirm receipt",
      btnClass: "order-btn-receive",
    });
  if (actor.role !== "admin" && order.status === "confirmed")
    actions.push({
      action: "cancel",
      bn: "অর্ডার বাতিল করুন",
      en: "Cancel order",
      btnClass: "order-btn-cancel",
    });
  if (
    actor.role !== "admin" &&
    ["dispatched", "delivered"].includes(order.status)
  )
    actions.push({
      action: "dispute",
      bn: "বিরোধ জানান",
      en: "Report dispute",
      btnClass: "order-btn-dispute",
    });

  const statusClass = ["delivered", "confirmed"].includes(order.status)
    ? "verified"
    : ["cancelled", "disputed"].includes(order.status)
      ? "rejected"
      : "pending";

  return (
    <div className="lot-page-wrap">
      {/* Top Bar with circular back arrow and popup action buttons */}
      <div className="lot-page-top-bar">
        <Link className="work-link lot-back-link" href={`${base}/orders`}>
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
          <span>{local(locale, "সব অর্ডারে ফিরুন", "Back to orders")}</span>
        </Link>

        {/* Top Action Modal Buttons */}
        <div className="lot-page-actions-group">
          <OrderLogisticsModal
            locale={locale}
            orderId={id}
            orderLabel={order.offer.lot_label}
            logistics={logistics}
            actor={actor}
            quantityKg={order.offer.quantity_kg}
            goodsTotal={order.offer.total_bdt}
            orderStatus={order.status}
          />

          {actions.map(({ action, bn, en, btnClass }) => (
            <OrderActionModal
              key={action}
              locale={locale}
              orderId={id}
              orderLabel={order.offer.lot_label}
              action={action}
              label={local(locale, bn, en)}
              btnClass={btnClass}
            />
          ))}
        </div>
      </div>

      {/* Main Order Details Panel (Lot Details Tabular Style) */}
      <section className="work-panel lot-details-page-panel">
        <div className="lot-page-header-row">
          <div>
            <h1 className="lot-page-title">{order.offer.lot_label}</h1>
            <div className="lot-page-meta-strip">
              <span className="lot-page-location">
                <LocationIcon size={14} /> {order.offer.delivery_district}
              </span>
              <span className="trade-meta-dot">•</span>
              <span>#{order.id.slice(0, 8)}</span>
              <span className="trade-meta-dot">•</span>
              <span>
                {order.offer.grade
                  ? `${local(locale, "গ্রেড", "Grade")} ${order.offer.grade}`
                  : local(locale, "অনির্ধারিত", "Ungraded")}
              </span>
            </div>
          </div>
          <span className={`trade-status-pill ${statusClass}`}>
            <span className="trade-status-dot" aria-hidden="true" />
            {state(locale, order.status)}
          </span>
        </div>

        {/* Tabular Specification List */}
        <div className="lot-table-container">
          <table className="lot-tabular-list">
            <tbody>
              <tr>
                <th scope="row">{local(locale, "অর্ডার আইডি", "Order ID")}</th>
                <td><code>#{order.id}</code></td>
              </tr>
              <tr>
                <th scope="row">{local(locale, "ক্রেতা", "Buyer")}</th>
                <td>
                  <strong>{order.offer.buyer_name}</strong> · {order.offer.delivery_district}{" "}
                  {order.offer.buyer_verified ? (
                    <span className="stock-verified-badge" title="Verified">✓ {local(locale, "যাচাইকৃত", "Verified")}</span>
                  ) : (
                    <span className="stock-unverified-tag">{local(locale, "যাচাই হয়নি", "Unverified")}</span>
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">{local(locale, "বিক্রেতা", "Seller")}</th>
                <td><strong>{order.offer.seller_name}</strong></td>
              </tr>
              <tr className="row-highlight">
                <th scope="row">{local(locale, "মোট মূল্য", "Total value")}</th>
                <td><strong className="stock-highlight-kg">{taka(locale, order.offer.total_bdt)}</strong></td>
              </tr>
              <tr>
                <th scope="row">{local(locale, "পরিমাণ", "Quantity")}</th>
                <td><strong>{kg(locale, order.offer.quantity_kg)}</strong></td>
              </tr>
              <tr>
                <th scope="row">{local(locale, "প্রতি কেজির দর", "Price per kg")}</th>
                <td>{taka(locale, order.offer.price_bdt_kg)} / {local(locale, "কেজি", "kg")}</td>
              </tr>
              <tr>
                <th scope="row">{local(locale, "সরবরাহের জেলা", "Delivery district")}</th>
                <td>{order.offer.delivery_district}</td>
              </tr>
              <tr>
                <th scope="row">{local(locale, "সরবরাহের সময়সীমা", "Delivery window")}</th>
                <td>
                  {order.offer.delivery_from && order.offer.delivery_to
                    ? order.offer.delivery_from === order.offer.delivery_to
                      ? timeLabel(locale, order.offer.delivery_from)
                      : `${timeLabel(locale, order.offer.delivery_from)} – ${timeLabel(locale, order.offer.delivery_to)}`
                    : local(locale, "আলোচনা সাপেক্ষ", "By arrangement")}
                </td>
              </tr>
              <tr>
                <th scope="row">{local(locale, "পরিবহন ব্যবস্থা", "Transport responsibility")}</th>
                <td>
                  {order.offer.transport === "buyer"
                    ? local(locale, "ক্রেতার দায়িত্ব", "Buyer arranges")
                    : local(locale, "বিক্রেতার দায়িত্ব", "Seller arranges")}
                </td>
              </tr>
              <tr>
                <th scope="row">{local(locale, "গ্রেড", "Grade")}</th>
                <td>
                  {order.offer.grade
                    ? `${local(locale, "গ্রেড", "Grade")} ${order.offer.grade}`
                    : local(locale, "অনির্ধারিত", "Ungraded")}
                </td>
              </tr>
              {order.status === "confirmed" && order.expires_at && (
                <tr>
                  <th scope="row">{local(locale, "সংরক্ষণের শেষ সময়", "Reservation expires")}</th>
                  <td>{timeLabel(locale, order.expires_at)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Settlement Section */}
      <OrderSettlement
        locale={locale}
        id={id}
        data={settlement}
        mayReport={actor.role === "buyer" && order.status === "delivered"}
      />

      {/* Order History Timeline Panel */}
      {order.activity && order.activity.length > 0 && (
        <section className="work-panel lot-details-page-panel order-history-panel">
          <div className="lot-page-header-row">
            <h2 className="lot-page-title">{local(locale, "অর্ডারের ইতিহাস", "Order history")}</h2>
          </div>
          <ul className="offer-history-timeline order-history-timeline">
            {order.activity.map((event, index) => (
              <li key={`${event.recorded_at}-${index}`} className="offer-history-timeline-item">
                <span className="offer-history-timeline-dot" />
                <div className="offer-history-timeline-content">
                  <div className="offer-history-timeline-row">
                    <span className="offer-history-action-tag">
                      {state(locale, event.action)}
                    </span>
                    <span className="offer-history-time">
                      {timeLabel(locale, event.recorded_at)}
                    </span>
                  </div>
                  {event.by_system && (
                    <div className="offer-history-by-line">
                      <span className="offer-history-muted">{local(locale, "স্বয়ংক্রিয় প্রক্রিয়া", "Automated system")}</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
