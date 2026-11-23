import Link from "next/link";
import type { Locale } from "../../lib/copy";
import type { Observation } from "../../lib/pilot-types";
import { api, type Profile } from "../../lib/workspace-api";
import { local, roles } from "../../lib/workspace-copy";
import type {
  Demand,
  Lot,
  Offer,
  Order,
  Supply,
  Filters,
} from "../../lib/workspace-types";
import { numberLabel, timeLabel } from "../../lib/workspace-values";
import { ContactModal } from "./contact-modal";
import { WorkspaceIcon } from "./icon";
import { taka } from "./market";
import { kg } from "./stock";
import { OperationsNav, OperationsView } from "./operations";
import { DataChart } from "./data-chart";
import { pricePoints } from "../../lib/chart-data";

type Alerts = {
  unread: number;
  items: { id: string; kind: string; created_at: string }[];
};
type Ops = {
  unverified_accounts: number;
  unverified_lots: number;
  pending_imports: number;
  open_disputes: number;
  pending_sms: number;
  attention_sms: number;
  carrier_events_24h: number | null;
};

export async function Dashboard({
  locale,
  actor,
  base,
  filters,
}: {
  locale: Locale;
  actor: Profile;
  base: string;
  filters?: Filters;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const farmer = actor.role === "farmer";
  const buyer = actor.role === "buyer";
  const agent = actor.role === "agent";
  const signupReviewer = agent && actor.verified && !actor.is_demo;
  const admin = actor.role === "admin";

  const [
    stock,
    demand,
    offers,
    orders,
    alerts,
    operations,
    supply,
    marketPrices,
  ] = await Promise.all([
    farmer || agent || admin ? api<Lot[]>("/v1/lots") : [],
    buyer ? api<{ items: Demand[] }>("/v1/buyer-requests") : { items: [] },
    agent || admin ? [] : api<Offer[]>("/v1/offers"),
    agent ? [] : api<Order[]>("/v1/orders"),
    api<Alerts>("/v1/notifications"),
    admin ? api<Ops>("/v1/admin/overview") : null,
    buyer
      ? api<{ items: Supply[] }>("/v1/matches").catch(() => ({ items: [] }))
      : { items: [] },
    api<Observation[]>("/v1/market/prices?limit=100").catch(() => []),
  ]);

  // Real-time Stock Quality Analytics (100% database driven)
  let verifiedKg = 0;
  let unverifiedKg = 0;

  if (buyer) {
    for (const item of supply.items) {
      const quantity = Number(item.sellable_kg || 0);
      if (item.verification === "verified") {
        verifiedKg += quantity;
      } else {
        unverifiedKg += quantity;
      }
    }
  } else {
    for (const lot of stock) {
      const quantity = Number(lot.available_kg || 0);
      if (lot.verified_at !== null || lot.verified_kg !== null) {
        verifiedKg += quantity;
      } else {
        unverifiedKg += quantity;
      }
    }
  }

  verifiedKg = Math.round(verifiedKg);
  unverifiedKg = Math.round(unverifiedKg);
  const totalStockKg = verifiedKg + unverifiedKg;
  const verifiedPercent =
    totalStockKg > 0 ? Math.round((verifiedKg / totalStockKg) * 100) : 0;
  const unverifiedPercent = totalStockKg > 0 ? 100 - verifiedPercent : 0;

  // Donut chart stroke geometry (spacious, thicker, text never overlaps ring)
  const donutRadius = 88;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const verifiedArc =
    totalStockKg > 0 ? (verifiedPercent / 100) * donutCircumference : 0;
  const unverifiedArc = totalStockKg > 0 ? donutCircumference - verifiedArc : 0;

  const observedSeries = [
    {
      district: "Pabna",
      type: "farmgate",
      title: t("পাবনা খামারদর", "Pabna farmgate"),
    },
    {
      district: "Dhaka",
      type: "wholesale",
      title: t("ঢাকা পাইকারি দর", "Dhaka wholesale"),
    },
  ].map((item) => {
    const latest = marketPrices
      .filter(
        (row) => row.district === item.district && row.price_type === item.type,
      )
      .sort((a, b) => b.observed_on.localeCompare(a.observed_on))[0];
    return {
      ...item,
      latest,
      rows: latest
        ? marketPrices.filter((row) => row.series === latest.series)
        : [],
    };
  });

  const activeOffers = offers.filter((item) =>
    ["sent", "countered"].includes(item.status),
  );
  const activeOrders = orders.filter((item) =>
    ["confirmed", "dispatched", "disputed"].includes(item.status),
  );
  const primary = buyer ? "supply" : admin ? "?view=accounts" : "stock";
  const primaryLabel = buyer
    ? t("মজুত খুঁজুন", "Browse supply")
    : admin
      ? t("নিবন্ধন যাচাই দেখুন", "Review accounts")
      : t("মজুত দেখুন", "View stock");

  const subtitle = farmer
    ? t(
        "মজুত, নতুন অফার ও চালানের অবস্থা এক জায়গায় দেখুন।",
        "Track your inventory, offers, and deliveries in one place.",
      )
    : buyer
      ? t(
          "চাহিদা, সরবরাহ ও ক্রয়ের অগ্রগতি দেখুন।",
          "Review buying requirements and follow orders through delivery.",
        )
      : agent
        ? t(
            "নির্ধারিত মজুত পরিদর্শন করুন ও কৃষকদের সহায়তা করুন।",
            "Inspect assigned stock and follow up on requests from farmers.",
          )
        : t(
            "যাচাই, বাজারদর ও অর্ডারের পর্যালোচনা করুন।",
            "Review verifications, market data, and orders that need attention.",
          );

  const count = (n: number) => numberLabel(locale, n);

  const metrics =
    admin && operations
      ? [
          {
            icon: "profile",
            label: t("যাচাই বাকি অ্যাকাউন্ট", "Accounts to verify"),
            value: count(operations.unverified_accounts),
            path: "?view=accounts",
            badge: t("যাচাই", "Accounts"),
          },
          {
            icon: "stock",
            label: t("যাচাই বাকি মজুত", "Lots to verify"),
            value: count(operations.unverified_lots),
            path: "stock?unverified=1",
            badge: t("মজুত", "Lots"),
          },
          {
            icon: "imports",
            label: t("বাজারদর পর্যালোচনা", "Imports to review"),
            value: count(operations.pending_imports),
            path: "imports",
            badge: t("তথ্য", "Data"),
          },
          {
            icon: "operations",
            label: t("অমীমাংসিত বিরোধ", "Open disputes"),
            value: count(operations.open_disputes),
            path: "?view=disputes",
            badge:
              operations.open_disputes > 0
                ? t("জরুরি", "Urgent")
                : t("স্বাভাবিক", "Normal"),
          },
        ]
      : [
          buyer
            ? {
                icon: "demand",
                label: t("চলমান চাহিদা", "Open requirements"),
                value: count(
                  demand.items.filter((row) => row.status === "open").length,
                ),
                path: "demand",
                badge: t("চাহিদা", "Active"),
              }
            : {
                icon: "stock",
                label: t("সাম্প্রতিক খালি মজুত", "Unreserved stock"),
                value: kg(
                  locale,
                  stock
                    .reduce((sum, lot) => sum + Number(lot.sellable_kg), 0)
                    .toFixed(1),
                ),
                path: "stock",
                badge: t("মজুত", "Inventory"),
              },
          agent
            ? {
                icon: "stock",
                label: t("যাচাই বাকি মজুত", "Lots to verify"),
                value: count(
                  stock.filter((row) => row.verified_kg === null).length,
                ),
                path: "stock?unverified=1",
                badge: t("যাচাই", "Pending"),
              }
            : {
                icon: "offers",
                label: t("সক্রিয় অফার", "Active offers"),
                value: count(activeOffers.length),
                path: "offers",
                badge: t("দরদাম", "Negotiating"),
              },
          agent
            ? {
                icon: "help",
                label: t("পরিদর্শন ও সহায়তা", "Inspection queue"),
                value: t("দেখুন", "View"),
                path: "help",
                badge: t("সহায়তা", "Field"),
              }
            : {
                icon: "orders",
                label: t("চলমান অর্ডার", "Open orders"),
                value: count(activeOrders.length),
                path: "orders",
                badge: t("সরবরাহ", "In progress"),
              },
        ];

  const rows =
    agent || farmer
      ? stock.slice(0, 5).map((lot) => ({
          id: lot.id,
          title: lot.label,
          detail: `${lot.variety} · ${lot.district}`,
          value: kg(locale, lot.sellable_kg),
          label: lot.verified_at
            ? t("যাচাইকৃত", "Verified")
            : t("নিজস্ব তথ্য", "Self-reported"),
          verified: Boolean(lot.verified_at),
          href: `${base}/stock/${lot.id}`,
        }))
      : orders.slice(0, 5).map((order) => ({
          id: order.id,
          title: order.offer.lot_label,
          detail: `${kg(locale, order.offer.quantity_kg)} · ${order.offer.delivery_district}`,
          value: taka(locale, order.offer.total_bdt),
          label:
            {
              confirmed: t("নিশ্চিত", "Confirmed"),
              dispatched: t("পাঠানো হয়েছে", "Dispatched"),
              delivered: t("গৃহীত", "Received"),
              disputed: t("বিরোধ", "Disputed"),
              cancelled: t("বাতিল", "Cancelled"),
              expired: t("মেয়াদ শেষ", "Expired"),
            }[order.status] ?? order.status,
          verified: order.status === "delivered",
          href: `${base}/orders/${order.id}`,
        }));

  if (admin && filters?.view) {
    return (
      <div className="dash-container">
        {/* ─── WELCOME BANNER (Colored Hero Card) ─── */}
        <section className="dash-welcome">
          <div className="dash-welcome-text">
            <div className="dash-welcome-eyebrow">
              <span className="dash-pulse-dot" aria-hidden="true" />
              <span>
                {local(locale, "আপনার কাজের স্থান", "Active workspace")} ·{" "}
                <strong>{actor.district}</strong>
              </span>
            </div>
            <h1 className="dash-welcome-h1">
              <span className="headline-primary">{actor.name}</span>
              <span className="headline-secondary">
                {" "}
                · {local(locale, ...roles[actor.role])}
              </span>
            </h1>
            <p className="dash-welcome-sub">{subtitle}</p>
          </div>

          <div className="dash-welcome-actions">
            <ContactModal locale={locale} base={base} />
          </div>
        </section>

        {/* ─── OPERATIONS NAVIGATION TABS ─── */}
        <OperationsNav
          locale={locale}
          base={base}
          activeView={
            typeof filters.view === "string" ? filters.view : undefined
          }
        />

        {/* ─── ACTIVE OPERATIONS SUB-VIEW ─── */}
        <OperationsView
          locale={locale}
          base={base}
          filters={filters}
          offset={Number(filters.offset ?? 0)}
        />
      </div>
    );
  }

  return (
    <div className="dash-container">
      {/* ─── WELCOME BANNER (Colored Hero Card) ─── */}
      <section className="dash-welcome">
        <div className="dash-welcome-text">
          <div className="dash-welcome-eyebrow">
            <span className="dash-pulse-dot" aria-hidden="true" />
            <span>
              {local(locale, "আপনার কাজের স্থান", "Active workspace")} ·{" "}
              <strong>{actor.district}</strong>
            </span>
          </div>
          <h1 className="dash-welcome-h1">
            <span className="headline-primary">{actor.name}</span>
            <span className="headline-secondary">
              {" "}
              · {local(locale, ...roles[actor.role])}
            </span>
          </h1>
          <p className="dash-welcome-sub">{subtitle}</p>
        </div>

        <div className="dash-welcome-actions">
          <Link
            className="dash-primary-btn"
            href={`${base}${signupReviewer ? "/verifications" : primary.startsWith("?") ? primary : `/${primary}`}`}
            prefetch={true}
          >
            <span>
              {signupReviewer
                ? t("যাচাই বাকি নিবন্ধন দেখুন", "Review pending registrations")
                : primaryLabel}
            </span>
            <span className="dash-btn-chip" aria-hidden="true">
              <WorkspaceIcon name="arrow" />
            </span>
          </Link>
          <ContactModal locale={locale} base={base} />
        </div>
      </section>

      {/* ─── OPERATIONS NAVIGATION TABS (For Operator) ─── */}
      {admin && <OperationsNav locale={locale} base={base} activeView="" />}

      {/* ─── KPI METRIC CARDS (Glass-1) ─── */}
      <div className="dash-kpi-grid">
        {metrics.map((m) => (
          <Link
            className="dash-kpi-card glass-1"
            key={m.label}
            href={`${base}${m.path.startsWith("?") ? m.path : `/${m.path}`}`}
            prefetch={true}
          >
            <div className="dash-kpi-header">
              <span className="dash-kpi-icon">
                <WorkspaceIcon name={m.icon} />
              </span>
              <span className="dash-kpi-badge">{m.badge}</span>
            </div>
            <div className="dash-kpi-body">
              <span className="dash-kpi-label">{m.label}</span>
              <strong className="dash-kpi-value stat-num">{m.value}</strong>
            </div>
          </Link>
        ))}

        {/* Alerts KPI */}
        <Link
          className="dash-kpi-card glass-1"
          href={`${base}/alerts`}
          prefetch={true}
        >
          <div className="dash-kpi-header">
            <span className="dash-kpi-icon">
              <WorkspaceIcon name="alerts" />
            </span>
            <span
              className={`dash-kpi-badge ${alerts.unread > 0 ? "dash-badge-alert" : ""}`}
            >
              {alerts.unread > 0 ? t("নতুন", "New") : t("সব পঠিত", "Cleared")}
            </span>
          </div>
          <div className="dash-kpi-body">
            <span className="dash-kpi-label">
              {t("অপঠিত বিজ্ঞপ্তি", "Unread alerts")}
            </span>
            <strong className="dash-kpi-value stat-num">
              {count(alerts.unread)}
            </strong>
          </div>
        </Link>
      </div>

      {/* ─── DELIVERY SERVICE ACTIVITY (Transferred from Operations) ─── */}
      {admin && operations && (
        <section className="dash-card glass-1 ops-delivery-section">
          <div className="dash-card-header">
            <div>
              <div
                className="dash-quality-eyebrow"
                style={{ marginBottom: "6px" }}
              >
                <span className="dash-pulse-dot" aria-hidden="true" />
                <span>{t("সেবা কার্যক্রম", "SMS & Delivery Logistics")}</span>
              </div>
              <h2 className="dash-card-title">
                {t("সরবরাহ সেবার অবস্থা", "Delivery service activity")}
              </h2>
            </div>
          </div>
          <div className="ops-delivery-metrics-grid">
            <div className="ops-delivery-box">
              <span className="ops-delivery-label">
                {t("অপেক্ষমাণ এসএমএস", "Pending SMS")}
              </span>
              <strong className="ops-delivery-val stat-num">
                {count(operations.pending_sms)}
              </strong>
            </div>
            <div className="ops-delivery-box">
              <span className="ops-delivery-label">
                {t("পর্যালোচনা প্রয়োজন এমন এসএমএস", "SMS needing review")}
              </span>
              <strong className="ops-delivery-val stat-num">
                {count(operations.attention_sms)}
              </strong>
            </div>
            {operations.carrier_events_24h !== null && (
              <div className="ops-delivery-box">
                <span className="ops-delivery-label">
                  {t(
                    "গত ২৪ ঘণ্টার ক্যারিয়ার ঘটনা",
                    "Carrier callbacks in 24 hours",
                  )}
                </span>
                <strong className="ops-delivery-val stat-num">
                  {count(operations.carrier_events_24h)}
                </strong>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="dash-analysis-section glass-1">
        <h2 className="dash-analysis-title">
          {t("বাজারদরের পর্যবেক্ষণ", "Market price observations")}
        </h2>
        <div className="work-grid">
          {observedSeries.map((item) => (
            <DataChart
              key={item.district}
              locale={locale}
              title={item.title}
              summary={
                item.latest
                  ? `${item.latest.market} · ${item.latest.grade} · ${item.latest.synthetic ? t("কাল্পনিক নমুনা", "Synthetic sample") : t("অনুমোদিত উৎস", "Approved source")}`
                  : t("পর্যবেক্ষণ পাওয়া যায়নি।", "No observations available.")
              }
              points={pricePoints(item.rows, null)}
              unit={t("টাকা/কেজি", "BDT/kg")}
            />
          ))}
        </div>
        <Link className="work-link" href={`${base}/prices`}>
          {t("উৎস ও দরের বিস্তারিত দেখুন", "Review prices and source details")}
        </Link>
      </section>

      {/* ─── LOWER GRID: REAL-TIME ANALYTICS, RECENT ACTIVITY & QUICK ACTIONS ─── */}
      <div className="dash-lower-grid">
        {/* Real-time Stock Quality Analytics (Verified vs Self-Reported from Database) */}
        <section className="dash-card dash-quality-card glass-1">
          <header className="dash-card-header">
            <div>
              <div className="dash-quality-eyebrow">
                <span className="dash-pulse-dot" aria-hidden="true" />
                <span>{t("মজুতের মান", "Stock Quality")}</span>
              </div>
              <h2 className="dash-card-title">
                {t("যাচাই বনাম নিজস্ব তথ্য", "Verified vs. Self-Reported")}
              </h2>
            </div>
          </header>

          <div className="dash-donut-wrap">
            <svg
              className="dash-donut-svg"
              viewBox="0 0 240 240"
              width="220"
              height="220"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label={`${t("যাচাই বনাম নিজস্ব তথ্য", "Verified vs. Self-Reported")}: ${t("যাচাইকৃত", "Verified")} ${numberLabel(locale, verifiedPercent)}%, ${t("নিজস্ব তথ্য", "Self-reported")} ${numberLabel(locale, unverifiedPercent)}%`}
            >
              <circle
                cx="120"
                cy="120"
                r={donutRadius}
                stroke="var(--border)"
                strokeWidth="22"
                opacity="0.35"
              />

              {totalStockKg > 0 ? (
                <g transform="rotate(-90 120 120)">
                  <circle
                    cx="120"
                    cy="120"
                    r={donutRadius}
                    stroke="var(--onion-600)"
                    strokeWidth="22"
                    strokeDasharray={`${verifiedArc} ${donutCircumference - verifiedArc}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    className="dash-donut-segment dash-donut-verified"
                  />
                  <circle
                    cx="120"
                    cy="120"
                    r={donutRadius}
                    stroke="var(--skin-500)"
                    strokeWidth="22"
                    strokeDasharray={`${unverifiedArc} ${donutCircumference - unverifiedArc}`}
                    strokeDashoffset={-verifiedArc}
                    strokeLinecap="round"
                    className="dash-donut-segment dash-donut-unverified"
                  />
                </g>
              ) : null}

              <text
                x="120"
                y="114"
                textAnchor="middle"
                className="dash-donut-center-num stat-num"
              >
                {numberLabel(locale, totalStockKg)}{" "}
                {local(locale, "কেজি", "kg")}
              </text>
              <text
                x="120"
                y="138"
                textAnchor="middle"
                className="dash-donut-center-sub"
              >
                {t("মোট মজুত", "Total stock")}
              </text>
            </svg>
          </div>

          <div className="dash-quality-legend">
            <div className="dash-quality-row">
              <div className="dash-quality-label">
                <span className="dash-dot-verified" aria-hidden="true" />
                <span>
                  {t("মাঠ কর্মকর্তা যাচাইকৃত", "Field officer verified")}
                </span>
              </div>
              <strong className="dash-quality-value stat-num">
                {numberLabel(locale, verifiedPercent)}% (
                {numberLabel(locale, verifiedKg)} {local(locale, "কেজি", "kg")})
              </strong>
            </div>

            <div className="dash-quality-row">
              <div className="dash-quality-label">
                <span className="dash-dot-unverified" aria-hidden="true" />
                <span>
                  {t("নিজস্ব তথ্য (অযাচাইকৃত)", "Self-reported (Unverified)")}
                </span>
              </div>
              <strong className="dash-quality-value stat-num">
                {numberLabel(locale, unverifiedPercent)}% (
                {numberLabel(locale, unverifiedKg)}{" "}
                {local(locale, "কেজি", "kg")})
              </strong>
            </div>
          </div>
        </section>

        {/* Recent lots / orders */}
        <section className="dash-card glass-1">
          <header className="dash-card-header">
            <div>
              <h2 className="dash-card-title">
                {agent || farmer
                  ? t("সাম্প্রতিক মজুত", "Recent stock lots")
                  : t("সাম্প্রতিক অর্ডার", "Recent orders")}
              </h2>
              <p className="dash-card-sub">
                {agent || farmer
                  ? t(
                      "নিবন্ধিত মজুত ও গুণমান সনদ",
                      "Registered inventory and verification state",
                    )
                  : t(
                      "চলমান ক্রয়-বিক্রয় ও চালান",
                      "Active purchases and deliveries",
                    )}
              </p>
            </div>
            <Link
              className="work-link"
              href={`${base}/${agent || farmer ? "stock" : "orders"}`}
              prefetch={true}
            >
              <span>{t("সব দেখুন", "View all")}</span>
              <span className="work-link-circle-arrow" aria-hidden="true">
                <svg
                  width="12"
                  height="12"
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
          </header>

          {rows.length ? (
            <ul className="dash-activity-list">
              {rows.map((row) => (
                <li key={row.id} className="dash-activity-item">
                  <Link
                    href={row.href}
                    className="dash-activity-link"
                    prefetch={true}
                  >
                    <div className="dash-activity-info">
                      <strong className="dash-activity-title">
                        {row.title}
                      </strong>
                      <span className="dash-activity-detail">{row.detail}</span>
                    </div>
                    <div className="dash-activity-meta">
                      <span className="dash-activity-value stat-num">
                        {row.value}
                      </span>
                      <span
                        className={`work-tag ${row.verified ? "work-tag-verified" : ""}`}
                      >
                        {row.label}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dash-empty">
              <div className="dash-empty-rings" aria-hidden="true">
                <WorkspaceIcon name={agent || farmer ? "stock" : "orders"} />
              </div>
              <p>
                {agent || farmer
                  ? t("এখনও কোনো মজুত তালিকাভুক্ত নেই।", "No lots registered yet.")
                  : t("এখনও কোনো অর্ডার নেই।", "No active orders yet.")}
              </p>
              <Link
                className="work-link"
                href={`${base}/${primary}`}
                prefetch={true}
              >
                <span>{primaryLabel}</span>
                <span className="work-link-circle-arrow" aria-hidden="true">
                  <svg
                    width="12"
                    height="12"
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
          )}
        </section>

        {/* Quick actions & Alerts summary */}
        <section className="dash-card glass-1">
          <header className="dash-card-header">
            <div>
              <h2 className="dash-card-title">
                {t("দ্রুত কাজ", "Quick actions")}
              </h2>
              <p className="dash-card-sub">
                {t("জরুরি নেভিগেশন ও শর্টকাট", "Common workflows and shortcuts")}
              </p>
            </div>
          </header>

          <ul className="dash-quick-list">
            {(buyer
              ? [
                  ["demand", t("চাহিদা পরিচালনা", "Manage demand")],
                  ["offers", t("অফার পর্যালোচনা", "Review offers")],
                ]
              : admin
                ? [
                    [
                      "operations?view=settlements",
                      t("অর্থপ্রদান যাচাই", "Review settlements"),
                    ],
                    [
                      "operations?view=quality",
                      t("তথ্যের মান পর্যালোচনা", "Review data quality"),
                    ],
                  ]
                : agent
                  ? [
                      [
                        "stock?unverified=1",
                        t("মজুত পরিদর্শন ও যাচাই", "Verify stock"),
                      ],
                      ["help", t("সহায়তার অনুরোধ সারি", "Assistance queue")],
                    ]
                  : [
                      ["offers", t("অফার পর্যালোচনা", "Review offers")],
                      ["agents", t("সহায়তাকারীর অনুমতি", "Manage agent access")],
                    ]
            )
              .concat([
                ["prices", t("বাজারদর ও বিশ্লেষণ", "Explore market prices")],
                ["alerts", t("সকল বিজ্ঞপ্তি", "View all notifications")],
              ])
              .map(([path, label]) => (
                <li key={path}>
                  <Link
                    href={`${base}/${path}`}
                    className="dash-quick-link"
                    prefetch={true}
                  >
                    <span className="dash-quick-icon">
                      <WorkspaceIcon name={path.split("?")[0]} />
                    </span>
                    <span className="dash-quick-text">{label}</span>
                    <span className="dash-quick-arrow">
                      <WorkspaceIcon name="arrow" />
                    </span>
                  </Link>
                </li>
              ))}
          </ul>

          {alerts.items[0] && (
            <div className="dash-latest-banner">
              <span className="dash-latest-dot" aria-hidden="true" />
              <div>
                <strong>{t("সর্বশেষ বিজ্ঞপ্তি", "Latest alert")}</strong>
                <p>{timeLabel(locale, alerts.items[0].created_at)}</p>
              </div>
              <Link
                className="work-link"
                href={`${base}/alerts`}
                prefetch={true}
              >
                {t("দেখুন", "View")}
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
