import Link from "next/link";
import type { Locale } from "../../lib/copy";
import { api, canUseVoice, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
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
          [
            "stock",
            t("যাচাই বাকি মজুত", "Lots to verify"),
            count(operations.unverified_lots),
            "stock?unverified=1",
          ],
          [
            "imports",
            t("বাজারদর পর্যালোচনা", "Imports to review"),
            count(operations.pending_imports),
            "imports",
          ],
          [
            "operations",
            t("অমীমাংসিত বিরোধ", "Open disputes"),
            count(operations.open_disputes),
            "operations?view=disputes",
          ],
        ]
      : [
          buyer
            ? [
                "demand",
                t("চলমান চাহিদা", "Open requirements"),
                count(
                  demand.items.filter((row) => row.status === "open").length,
                ),
                "demand",
              ]
            : [
                "stock",
                t("সাম্প্রতিক মজুতের খালি পরিমাণ", "Unreserved in recent lots"),
                kg(
                  locale,
                  stock
                    .reduce((sum, lot) => sum + Number(lot.sellable_kg), 0)
                    .toFixed(3),
                ),
                "stock",
              ],
          agent
            ? [
                "stock",
                t("যাচাই বাকি মজুত", "Lots to verify"),
                count(stock.filter((row) => row.verified_kg === null).length),
                "stock?unverified=1",
              ]
            : [
                "offers",
                t("সক্রিয় অফার", "Active offers"),
                count(activeOffers.length),
                "offers",
              ],
          agent
            ? [
                "help",
                t("পরিদর্শন ও সহায়তা", "Inspection requests"),
                t("দেখুন", "View"),
                "help",
              ]
            : [
                "orders",
                t("চলমান অর্ডার", "Open orders"),
                count(activeOrders.length),
                "orders",
              ],
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
          href: `${base}/orders/${order.id}`,
        }));

  return (
    <>
      <section className="dash-welcome">
        <div>
          <p className="dash-location">
            {local(locale, "আপনার কাজের স্থান", "Your workspace")} ·{" "}
            {actor.district}
          </p>
          <h1>{t("ওয়ার্কস্পেস", "Workspace")}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="dash-actions">
          <Link
            className="dash-cta"
            href={`${base}/${signupReviewer ? "verifications" : primary}`}
          >
            {signupReviewer
              ? t("যাচাই বাকি নিবন্ধন দেখুন", "Review pending registrations")
              : primaryLabel}
            <WorkspaceIcon name="arrow" />
          </Link>
          {canUseVoice(actor) && (
            <Link className="dash-cta" href={`${base}/voice`}>
              <WorkspaceIcon name="voice" />
              {t("বাংলা সহকারী", "Bangla assistant")}
            </Link>
          )}
        </div>
      </section>
      <div className="dash-metrics">
        {metrics.map(([icon, label, value, path]) => (
          <Link className="dash-stat" key={label} href={`${base}/${path}`}>
            <span className="dash-icon">
              <WorkspaceIcon name={icon} />
            </span>
            <span className="dash-stat-label">{label}</span>
            <strong>{value}</strong>
          </Link>
        ))}
        <Link className="dash-stat" href={`${base}/alerts`}>
          <span className="dash-icon">
            <WorkspaceIcon name="alerts" />
          </span>
          <span className="dash-stat-label">
            {t("অপঠিত বিজ্ঞপ্তি", "Unread alerts")}
          </span>
          <strong>{count(alerts.unread)}</strong>
        </Link>
      </div>
      <div className="dash-grid">
        <section className="dash-card">
          <header>
            <h2>
              {agent || farmer
                ? t("সাম্প্রতিক মজুত", "Recent stock")
                : t("সাম্প্রতিক অর্ডার", "Recent orders")}
            </h2>
            <Link
              className="work-link"
              href={`${base}/${agent || farmer ? "stock" : "orders"}`}
            >
              {t("সব দেখুন", "View all")}
            </Link>
          </header>
          {rows.length ? (
            <ul className="dash-list">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link href={row.href}>
                    <span>
                      <strong>{row.title}</strong>
                      <small>{row.detail}</small>
                    </span>
                    <span className="dash-list-value">
                      <strong>{row.value}</strong>
                      <span className="work-tag">{row.label}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dash-empty">
              <WorkspaceIcon name={agent || farmer ? "stock" : "orders"} />
              <p>
                {agent || farmer
                  ? t("এখনও মজুত নেই।", "No lots yet.")
                  : t("এখনও অর্ডার নেই।", "No orders yet.")}
              </p>
              <Link className="work-link" href={`${base}/${primary}`}>
                {primaryLabel}
              </Link>
            </div>
          )}
        </section>
        <section className="dash-card">
          <header>
            <h2>{t("দ্রুত কাজ", "Quick actions")}</h2>
          </header>
          <ul className="dash-quick">
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
                      t("তথ্যের মান", "Review data quality"),
                    ],
                  ]
                : agent
                  ? [
                      ["stock?unverified=1", t("মজুত যাচাই", "Verify stock")],
                      ["help", t("সহায়তার অনুরোধ", "Assistance queue")],
                    ]
                  : [
                      ["offers", t("অফার পর্যালোচনা", "Review offers")],
                      ["agents", t("সহায়তাকারীর অনুমতি", "Manage agent access")],
                    ]
            )
              .concat([
                ["prices", t("বাজারদর দেখুন", "Explore market prices")],
                ["alerts", t("বিজ্ঞপ্তি দেখুন", "View alerts")],
              ])
              .map(([path, label]) => (
                <li key={path}>
                  <Link href={`${base}/${path}`}>
                    <span className="dash-icon">
                      <WorkspaceIcon name={path.split("?")[0]} />
                    </span>
                    <span>{label}</span>
                    <WorkspaceIcon name="arrow" />
                  </Link>
                </li>
              ))}
          </ul>
          {alerts.items[0] && (
            <p className="dash-latest">
              {t("সর্বশেষ বিজ্ঞপ্তি", "Latest alert")} ·{" "}
              {timeLabel(locale, alerts.items[0].created_at)}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
