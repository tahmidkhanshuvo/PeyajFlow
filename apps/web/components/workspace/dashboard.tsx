import Link from "next/link";
import type { Locale } from "../../lib/copy";
import { api, canUseVoice, type Profile } from "../../lib/workspace-api";
import { local, roles } from "../../lib/workspace-copy";
import type { Demand, Lot, Offer, Order } from "../../lib/workspace-types";
import { numberLabel, timeLabel } from "../../lib/workspace-values";
import { WorkspaceIcon } from "./icon";
import { taka } from "./market";
import { kg } from "./stock";

type Alerts = {
  unread: number;
  items: { id: string; kind: string; created_at: string }[];
};
type Ops = {
  unverified_lots: number;
  pending_imports: number;
  open_disputes: number;
};

export async function Dashboard({
  locale,
  actor,
  base,
}: {
  locale: Locale;
  actor: Profile;
  base: string;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const farmer = actor.role === "farmer";
  const buyer = actor.role === "buyer";
  const agent = actor.role === "agent";
  const signupReviewer = agent && actor.verified && !actor.is_demo;
  const admin = actor.role === "admin";

  const [stock, demand, offers, orders, alerts, operations] = await Promise.all(
    [
      farmer || agent ? api<Lot[]>("/v1/lots") : [],
      buyer ? api<{ items: Demand[] }>("/v1/buyer-requests") : { items: [] },
      agent || admin ? [] : api<Offer[]>("/v1/offers"),
      agent ? [] : api<Order[]>("/v1/orders"),
      api<Alerts>("/v1/notifications"),
      admin ? api<Ops>("/v1/admin/overview") : null,
    ],
  );

  const activeOffers = offers.filter((item) =>
    ["sent", "countered"].includes(item.status),
  );
  const activeOrders = orders.filter((item) =>
    ["confirmed", "dispatched", "disputed"].includes(item.status),
  );
  const primary = buyer ? "supply" : admin ? "operations" : "stock";
  const primaryLabel = buyer
    ? t("মজুত খুঁজুন", "Browse supply")
    : admin
      ? t("পরিচালনা দেখুন", "Open operations")
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
            icon: "stock",
            label: t("যাচাই বাকি মজুত", "Lots to verify"),
            value: count(operations.unverified_lots),
            path: "stock?unverified=1",
            badge: t("কার্যক্রম", "Action"),
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
            path: "operations?view=disputes",
            badge: operations.open_disputes > 0 ? t("জরুরি", "Urgent") : t("স্বাভাবিক", "Normal"),
          },
        ]
      : [
          buyer
            ? {
                icon: "demand",
                label: t("চলমান চাহিদা", "Open requirements"),
                value: count(demand.items.filter((row) => row.status === "open").length),
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
                value: count(stock.filter((row) => row.verified_kg === null).length),
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
            <span className="headline-secondary"> · {local(locale, ...roles[actor.role])}</span>
          </h1>
          <p className="dash-welcome-sub">{subtitle}</p>
        </div>

        <div className="dash-welcome-actions">
          <Link
            className="dash-primary-btn"
            href={`${base}/${signupReviewer ? "verifications" : primary}`}
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
          {canUseVoice(actor) && (
            <Link className="dash-ghost-btn" href={`${base}/voice`}>
              <WorkspaceIcon name="voice" />
              <span>{t("বাংলা সহকারী", "Bangla assistant")}</span>
            </Link>
          )}
        </div>
      </section>

      {/* ─── KPI METRIC CARDS (Glass-1) ─── */}
      <div className="dash-kpi-grid">
        {metrics.map((m) => (
          <Link className="dash-kpi-card glass-1" key={m.label} href={`${base}/${m.path}`}>
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
        <Link className="dash-kpi-card glass-1" href={`${base}/alerts`}>
          <div className="dash-kpi-header">
            <span className="dash-kpi-icon">
              <WorkspaceIcon name="alerts" />
            </span>
            <span className={`dash-kpi-badge ${alerts.unread > 0 ? "dash-badge-alert" : ""}`}>
              {alerts.unread > 0 ? t("নতুন", "New") : t("সব পঠিত", "Cleared")}
            </span>
          </div>
          <div className="dash-kpi-body">
            <span className="dash-kpi-label">{t("অপঠিত বিজ্ঞপ্তি", "Unread alerts")}</span>
            <strong className="dash-kpi-value stat-num">{count(alerts.unread)}</strong>
          </div>
        </Link>
      </div>

      {/* ─── LOWER GRID: RECENT ACTIVITY & QUICK ACTIONS ─── */}
      <div className="dash-lower-grid">
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
                  ? t("নিবন্ধিত মজুত ও গুণমান সনদ", "Registered inventory and verification state")
                  : t("চলমান ক্রয়-বিক্রয় ও চালান", "Active purchases and deliveries")}
              </p>
            </div>
            <Link
              className="work-link"
              href={`${base}/${agent || farmer ? "stock" : "orders"}`}
            >
              {t("সব দেখুন", "View all")} →
            </Link>
          </header>

          {rows.length ? (
            <ul className="dash-activity-list">
              {rows.map((row) => (
                <li key={row.id} className="dash-activity-item">
                  <Link href={row.href} className="dash-activity-link">
                    <div className="dash-activity-info">
                      <strong className="dash-activity-title">{row.title}</strong>
                      <span className="dash-activity-detail">{row.detail}</span>
                    </div>
                    <div className="dash-activity-meta">
                      <span className="dash-activity-value stat-num">{row.value}</span>
                      <span className={`work-tag ${row.verified ? "work-tag-verified" : ""}`}>
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
              <Link className="work-link" href={`${base}/${primary}`}>
                {primaryLabel} →
              </Link>
            </div>
          )}
        </section>

        {/* Quick actions & Alerts summary */}
        <section className="dash-card glass-1">
          <header className="dash-card-header">
            <div>
              <h2 className="dash-card-title">{t("দ্রুত কাজ", "Quick actions")}</h2>
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
                      ["stock?unverified=1", t("মজুত পরিদর্শন ও যাচাই", "Verify stock")],
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
                  <Link href={`${base}/${path}`} className="dash-quick-link">
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
              <Link className="work-link" href={`${base}/alerts`}>
                {t("দেখুন", "View")}
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
