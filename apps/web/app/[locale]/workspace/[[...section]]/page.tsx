import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLogo } from "../../../../components/brand-logo";
import { AdvicePage } from "../../../../components/workspace/advice";
import { AgentsPage } from "../../../../components/workspace/agents";
import { AlertsPage } from "../../../../components/workspace/alerts";
import { AssistancePage } from "../../../../components/workspace/assistance";
import { Dashboard } from "../../../../components/workspace/dashboard";
import { WorkspaceIcon } from "../../../../components/workspace/icon";
import { ChatbotWidget } from "../../../../components/workspace/chatbot-widget";
import { LogisticsPage } from "../../../../components/workspace/logistics";
import { OfflineNotice } from "../../../../components/workspace/offline";
import { OperationsPage } from "../../../../components/workspace/operations";
import {
  ImportsPage,
  PricePage,
} from "../../../../components/workspace/prices";
import { VerificationsPage } from "../../../../components/workspace/verifications";
import { VoicePage } from "../../../../components/workspace/voice";
import { ProfilePage } from "../../../../components/workspace/profile";
import { ThemeToggle } from "../../../../components/theme-toggle";
import {
  QuickSearch,
  type SearchItem,
} from "../../../../components/workspace/quick-search";
import { RouteWarmer } from "../../../../components/workspace/route-warmer";
import { SimulatorPage } from "../../../../components/workspace/simulator";
import { Details, Field } from "../../../../components/workspace/fields";
import { WorkspaceForm } from "../../../../components/workspace/form";
import {
  NotificationBell,
  type NotificationItem,
} from "../../../../components/workspace/notification-bell";
import {
  InspectionsPage,
  RiskPage,
} from "../../../../components/workspace/inspection";
import {
  DemandPage,
  SupplyPage,
} from "../../../../components/workspace/market";
import { LotPage, StockPage } from "../../../../components/workspace/stock";
import {
  OfferHistoryPage,
  OffersPage,
  OrderPage,
  OrdersPage,
} from "../../../../components/workspace/trade";
import { isLocale, type Locale } from "../../../../lib/copy";
import {
  api,
  ApiError,
  canUseVoice,
  type DemoIdentity,
  type Profile,
} from "../../../../lib/workspace-api";
import { errorText, local, roles } from "../../../../lib/workspace-copy";
import type {
  Filters,
  Lot,
  Offer,
  Order,
} from "../../../../lib/workspace-types";
import { numberLabel } from "../../../../lib/workspace-values";
import {
  logoutAction,
  mutate,
  otpSignIn,
  passwordSignIn,
  requestOtp,
  signIn,
  signOut,
  signupAction,
} from "../actions";
import { AuthCompleted } from "../../../../components/auth-transition-overlay";
import { SignOutButton } from "../../../../components/workspace/signout-button";

export const dynamic = "force-dynamic";

function destinations(locale: Locale, actor: Profile) {
  const pages = [["", local(locale, "সংক্ষিপ্ত চিত্র", "Overview")]];
  if (actor.role !== "buyer")
    pages.push([
      "stock",
      actor.role === "farmer"
        ? local(locale, "আমার মজুত", "My stock")
        : local(locale, "মজুত", "Stock"),
    ]);
  if (actor.role === "buyer")
    pages.push(
      ["demand", local(locale, "চাহিদা", "Demand")],
      ["supply", local(locale, "মজুত খুঁজুন", "Browse supply")],
    );
  if (actor.role !== "agent")
    pages.push(
      ["offers", local(locale, "অফার", "Offers")],
      ["orders", local(locale, "অর্ডার", "Orders")],
    );
  pages.push(["prices", local(locale, "বাজারদর", "Market prices")]);
  if (actor.role === "agent" && actor.verified && !actor.is_demo)
    pages.push([
      "verifications",
      local(locale, "নিবন্ধন যাচাই", "Signup verification"),
    ]);
  if (actor.role === "farmer")
    pages.push(["agents", local(locale, "সহায়তাকারী", "Agent access")]);
  if (actor.role === "admin")
    pages.push(["imports", local(locale, "দর আমদানি", "Market imports")]);
  pages.push(["profile", local(locale, "প্রোফাইল", "Profile")]);
  pages.push(["help", local(locale, "সহায়তা", "Help")]);
  return pages;
}

function Overview({
  locale,
  actor,
  base,
  filters,
}: {
  locale: Locale;
  actor: Profile;
  base: string;
  filters: Filters;
}) {
  return (
    <Dashboard locale={locale} actor={actor} base={base} filters={filters} />
  );
}

async function panel(
  locale: Locale,
  actor: Profile,
  base: string,
  section: string[],
  filters: Filters,
): Promise<ReactNode> {
  const [page, id, child, extra] = section;
  const rawOffset = Number(filters.offset ?? 0);
  const offset =
    Number.isSafeInteger(rawOffset) && rawOffset >= 0 && rawOffset <= 1_000_000
      ? rawOffset
      : 0;
  const context = { locale, actor, base, offset };
  if (!page) return <Overview {...context} filters={filters} />;
  if (
    page !== "alerts" &&
    !((page === "voice" || page === "simulator") && canUseVoice(actor)) &&
    !destinations(locale, actor).some(([path]) => path === page)
  ) {
    if (page === "verifications") {
      return (
        <section className="work-panel">
          <p role="alert">{errorText(locale, "signup_review_access")}</p>
          <WorkspaceForm
            locale={locale}
            action={signOut.bind(null, locale)}
            label={local(locale, "সাইন আউট", "Sign out")}
            authType="signout"
          />
        </section>
      );
    }
    return (
      <p className="work-panel" role="alert">
        {errorText(locale, "role_forbidden")}
      </p>
    );
  }
  if (
    extra ||
    (id && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
  )
    notFound();
  if (!id) {
    if (page === "stock")
      return StockPage({ ...context, unverified: filters.unverified === "1" });
    if (page === "demand") return DemandPage(context);
    if (page === "supply") return SupplyPage({ ...context, filters });
    if (page === "offers") return OffersPage(context);
    if (page === "orders") return OrdersPage(context);
    if (page === "prices") return PricePage({ ...context, filters });
    if (page === "alerts") return AlertsPage(context);
    if (page === "help") return AssistancePage(context);
    if (page === "agents") return AgentsPage(context);
    if (page === "operations") return OperationsPage({ ...context, filters });
    if (page === "verifications") return VerificationsPage(context);
    if (page === "profile") return ProfilePage(context);
  }
  if (page === "imports" && !child) return ImportsPage({ ...context, id });
  if (page === "voice" && !child) return VoicePage({ ...context, id });
  if (page === "simulator" && !id && canUseVoice(context.actor))
    return SimulatorPage(context);
  if (id && page === "stock") {
    if (!child) return LotPage({ ...context, id });
    if (child === "inspections") return InspectionsPage({ ...context, id });
    if (child === "risk") return RiskPage({ ...context, id });
    if (child === "advice") return AdvicePage({ ...context, id });
  }
  if (id && page === "orders" && !child) return OrderPage({ ...context, id });
  if (id && page === "orders" && child === "logistics")
    return LogisticsPage({ ...context, id });
  if (id && page === "offers" && !child)
    return OfferHistoryPage({ ...context, id });
  notFound();
}

export default async function WorkspacePage({
  params,
  searchParams,
}: PageProps<"/[locale]/workspace/[[...section]]">) {
  const { locale, section = [] } = await params;
  if (!isLocale(locale)) notFound();
  const base = `/${locale}/workspace`;
  if (section[0] === "operations") {
    const filters = await searchParams;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      for (const item of Array.isArray(value)
        ? value
        : value === undefined
          ? []
          : [value]) {
        query.append(key, item);
      }
    }
    redirect(`${base}${query.size ? `?${query}` : ""}`);
  }
  const reviewingSignups =
    section.length === 1 && section[0] === "verifications";
  const alternative = locale === "bn" ? "en" : "bn";
  let actor: Profile | undefined;
  let error: string | undefined;
  let identities: DemoIdentity[] = [];
  let smsSignIn = false;
  try {
    actor = await api<Profile>("/v1/me");
  } catch (exception) {
    if (!(exception instanceof ApiError)) throw exception;
    if (exception.status !== 401) error = exception.code;
  }
  if (!actor && !error) {
    // SMS codes are offered only when the API has a configured SMS provider.
    smsSignIn = await api<{ available: boolean }>("/v1/auth/otp")
      .then((result) => result.available)
      .catch(() => false);
  }
  if (!actor && !error && !reviewingSignups) {
    try {
      identities = await api<DemoIdentity[]>("/v1/auth/demo");
    } catch (exception) {
      if (!(exception instanceof ApiError)) throw exception;
      if (exception.code !== "demo_disabled") error = exception.code;
    }
  }
  const filters = await searchParams;
  const alternateQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === "string" && key !== "saved")
      alternateQuery.set(key, value);
  }
  let content: ReactNode;
  let notificationsResult = { items: [] as NotificationItem[], unread: 0 };
  if (actor) {
    const contentPromise = panel(locale, actor, base, section, filters).catch(
      (exception) => {
        if (!(exception instanceof ApiError)) throw exception;
        return (
          <section className="work-panel" role="alert">
            <h1>
              {local(
                locale,
                "এই পৃষ্ঠাটি খোলা যায়নি",
                "This page could not be opened",
              )}
            </h1>
            <p>{errorText(locale, exception.code)}</p>
            <Link className="work-link" href={base}>
              {local(locale, "ওয়ার্কস্পেসে ফিরুন", "Back to workspace")}
            </Link>
          </section>
        );
      },
    );

    const notificationsPromise = api<{
      items: NotificationItem[];
      unread: number;
    }>("/v1/notifications?offset=0").catch(() => ({
      items: [] as NotificationItem[],
      unread: 0,
    }));

    const [resolvedContent, resolvedNotifs] = await Promise.all([
      contentPromise,
      notificationsPromise,
    ]);
    content = resolvedContent;
    notificationsResult = resolvedNotifs;
  }
  if (actor) {
    const navItems = destinations(locale, actor);
    let pageTitle = local(locale, "সংক্ষিপ্ত চিত্র", "Overview");
    const sec0 = section[0] ?? "";
    const sec1 = section[1];
    const sec2 = section[2];

    const activeItem = navItems.find(([path]) => sec0 === path);
    if (activeItem) {
      pageTitle = activeItem[1];
    }
    if (sec0 === "alerts") {
      pageTitle = local(locale, "বিজ্ঞপ্তি", "Alerts");
    }
    if (sec0 === "stock" && sec1) {
      if (!sec2) pageTitle = local(locale, "মজুতের বিবরণ", "Lot details");
      else if (sec2 === "inspections")
        pageTitle = local(locale, "পরিদর্শন ও ছবি", "Inspections & photos");
      else if (sec2 === "risk")
        pageTitle = local(locale, "সংরক্ষণের ঝুঁকি", "Storage risk");
      else if (sec2 === "advice")
        pageTitle = local(locale, "অপেক্ষা নাকি বিক্রি", "Hold or sell");
    } else if (sec0 === "orders" && sec1) {
      if (!sec2) pageTitle = local(locale, "অর্ডারের বিবরণ", "Order details");
      else if (sec2 === "logistics")
        pageTitle = local(locale, "পরিবহন ও দর", "Transport & quotes");
    } else if (sec0 === "offers" && sec1) {
      pageTitle = local(locale, "অফারের ইতিহাস", "Offer history");
    } else if (sec0 === "imports") {
      pageTitle = local(locale, "বাজারদর আমদানি", "Market imports");
    } else if (sec0 === "operations") {
      pageTitle = local(locale, "পরিচালনা", "Operations");
    }
    const orderStatuses: Record<string, [string, string]> = {
      sent: ["পাঠানো হয়েছে", "Sent"],
      countered: ["পাল্টা অফার", "Countered"],
      accepted: ["গ্রহণ করা হয়েছে", "Accepted"],
      rejected: ["প্রত্যাখ্যাত", "Rejected"],
      withdrawn: ["প্রত্যাহার করা হয়েছে", "Withdrawn"],
      expired: ["মেয়াদ শেষ", "Expired"],
      confirmed: ["নিশ্চিত", "Confirmed"],
      dispatched: ["পাঠানো হয়েছে", "Dispatched"],
      delivered: ["পৌঁছেছে", "Delivered"],
      cancelled: ["বাতিল", "Cancelled"],
      disputed: ["বিরোধ আছে", "Disputed"],
      dispute_resolved: ["বিরোধ নিষ্পত্তি", "Resolved"],
    };

    const formatKg = (val: string | number) =>
      `${numberLabel(locale, val)} ${local(locale, "কেজি", "kg")}`;
    const formatTaka = (val: string | number) => `৳${numberLabel(locale, val)}`;
    const formatStatus = (st: string) =>
      local(locale, ...(orderStatuses[st] ?? [st, st]));

    // Only fetch search entities on overview page to keep all subpage routing instant
    const isOverview = !sec0;
    const shouldFetchLots = isOverview && actor.role !== "buyer";
    const shouldFetchOffers = isOverview && actor.role !== "agent";
    const shouldFetchOrders = isOverview && actor.role !== "agent";

    const [lotsResult, offersResult, ordersResult] = isOverview
      ? await Promise.all([
          shouldFetchLots
            ? api<Lot[]>("/v1/lots").catch(() => [])
            : Promise.resolve([]),
          shouldFetchOffers
            ? api<Offer[]>("/v1/offers").catch(() => [])
            : Promise.resolve([]),
          shouldFetchOrders
            ? api<Order[]>("/v1/orders").catch(() => [])
            : Promise.resolve([]),
        ])
      : [[], [], []];

    const searchItems: SearchItem[] = [];

    // 1. Navigation / Pages
    for (const [path, name] of navItems) {
      searchItems.push({
        id: `nav-${path || "overview"}`,
        name,
        href: path ? `${base}/${path}` : base,
        icon: path || "",
        category: local(locale, "পৃষ্ঠা", "Navigation"),
        detail: local(
          locale,
          `ওয়ার্কস্পেস ${name} পৃষ্ঠায় যান`,
          `Navigate to ${name} workspace section`,
        ),
        keywords: `${name} ${path} page navigation মেনু পৃষ্ঠা`,
      });
    }

    // 2. Orders (Search by Order #ID, Buyer Name, Seller Name, Variety, Quantity, Amount, Status)
    for (const ord of ordersResult) {
      const shortId = ord.id.slice(0, 8);
      const buyer = ord.offer.buyer_name;
      const seller = ord.offer.seller_name;
      const statusLabel = formatStatus(ord.status);
      searchItems.push({
        id: `order-${ord.id}`,
        name: `${ord.offer.lot_label} · #${shortId}`,
        category: local(locale, "অর্ডার", "Orders"),
        href: `${base}/orders/${ord.id}`,
        icon: "orders",
        badge: statusLabel,
        detail: `${local(locale, "ক্রেতা", "Buyer")}: ${buyer} · ${local(locale, "বিক্রেতা", "Seller")}: ${seller} · ${ord.offer.variety} · ${formatKg(ord.offer.quantity_kg)} · ${formatTaka(ord.offer.total_bdt)}`,
        keywords: `${ord.id} ${shortId} #${shortId} ${buyer} ${seller} ${ord.offer.variety} ${ord.offer.delivery_district} ${ord.offer.lot_label} ${ord.status} ${statusLabel} order অর্ডার চালান ডেলিভারি`,
      });
    }

    // 3. Offers (Search by Offer #ID, Buyer Name, Seller Name, Variety, Quantity, Price, Status)
    for (const off of offersResult) {
      const shortId = off.id.slice(0, 8);
      const statusLabel = formatStatus(off.status);
      searchItems.push({
        id: `offer-${off.id}`,
        name: `${off.lot_label} · #${shortId}`,
        category: local(locale, "অফার", "Offers"),
        href: `${base}/offers/${off.id}`,
        icon: "offers",
        badge: statusLabel,
        detail: `${local(locale, "ক্রেতা", "Buyer")}: ${off.buyer_name} · ${local(locale, "বিক্রেতা", "Seller")}: ${off.seller_name} · ${off.variety} · ${formatKg(off.quantity_kg)} · ${formatTaka(off.total_bdt)}`,
        keywords: `${off.id} ${shortId} #${shortId} ${off.buyer_name} ${off.seller_name} ${off.variety} ${off.delivery_district} ${off.lot_label} ${off.status} ${statusLabel} offer অফার দরদাম প্রস্তাব`,
      });
    }

    // 4. Stock Lots (Search by Lot #ID, Variety, District, Storage, Available Quantity)
    for (const lot of lotsResult) {
      const shortId = lot.id.slice(0, 8);
      searchItems.push({
        id: `lot-${lot.id}`,
        name: `${lot.label} · #${shortId}`,
        category: local(locale, "মজুত", "Stock"),
        href: `${base}/stock/${lot.id}`,
        icon: "stock",
        badge: lot.grade ? `Grade ${lot.grade}` : undefined,
        detail: `${lot.variety} · ${lot.district} · ${local(locale, "অবশিষ্ট", "Available")}: ${formatKg(lot.sellable_kg)} · ${lot.storage_type}`,
        keywords: `${lot.id} ${shortId} #${shortId} ${lot.label} ${lot.variety} ${lot.district} ${lot.storage_type} ${lot.grade} lot stock মজুত গুদাম পেঁয়াজ`,
      });
    }

    // 5. Market Prices
    searchItems.push({
      id: "prices-pabna",
      name: local(locale, "পাবনা মোকাম বাজারদর", "Pabna Mokam Market Prices"),
      category: local(locale, "বাজারদর", "Prices"),
      href: `${base}/prices`,
      icon: "prices",
      detail: local(
        locale,
        "পাবনা মোকাম ও কাওরান বাজারের দৈনিক পাইকারি দর পর্যবেক্ষণ",
        "Daily farmgate & wholesale onion price benchmark comparison",
      ),
      keywords:
        "পাবনা কাওরান বাজার মোকাম পাইকারি রেট দর price pabna dhaka karwan bazar benchmark",
    });

    // 6. Alerts / Notifications
    searchItems.push({
      id: "nav-alerts",
      name: local(locale, "বিজ্ঞপ্তি", "Alerts"),
      category: local(locale, "পৃষ্ঠা", "Navigation"),
      href: `${base}/alerts`,
      icon: "alerts",
      detail: local(
        locale,
        "ইনবক্স ও সিস্টেম বিজ্ঞপ্তি দেখুন",
        "View notifications and inbox alerts",
      ),
      keywords: "alerts বিজ্ঞপ্তি নোটিফিকেশন inbox notification",
    });

    return (
      <div className="work-shell work-shell-signed">
        <AuthCompleted target="signed" />
        <RouteWarmer base={base} paths={navItems.map(([path]) => path)} />
        <a className="skip-link" href="#main">
          {local(locale, "মূল অংশে যান", "Skip to main content")}
        </a>
        <div className="canvas-blobs" aria-hidden="true" />

        {/* Desktop Sidebar (Solid) */}
        <aside className="work-sidebar">
          <div className="work-sidebar-header">
            <Link className="brand-link" href={base} prefetch={true}>
              <BrandLogo />
            </Link>
          </div>

          <nav
            className="work-nav"
            aria-label={local(
              locale,
              "ওয়ার্কস্পেস নেভিগেশন",
              "Workspace navigation",
            )}
          >
            <div className="work-nav-section-title">
              {local(locale, "প্রধান মেনু", "Main Menu")}
            </div>
            {navItems
              .filter(([path]) => path !== "help" && path !== "profile")
              .map(([path, name]) => {
                const isCurrent = (section[0] ?? "") === path;
                return (
                  <Link
                    key={path}
                    href={path ? `${base}/${path}` : base}
                    prefetch={true}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`work-nav-link ${isCurrent ? "active" : ""}`}
                  >
                    <span className="work-nav-icon">
                      <WorkspaceIcon name={path} />
                    </span>
                    <span className="work-nav-label">{name}</span>
                    {isCurrent && (
                      <span className="work-nav-pill" aria-hidden="true" />
                    )}
                  </Link>
                );
              })}

            <div
              className="work-nav-section-title"
              style={{ marginTop: "24px" }}
            >
              {local(locale, "অ্যাকাউন্ট ও সেটিংস", "Account & Settings")}
            </div>
            <Link
              href={`${base}/profile`}
              prefetch={true}
              aria-current={
                (section[0] ?? "") === "profile" ? "page" : undefined
              }
              className={`work-nav-link ${(section[0] ?? "") === "profile" ? "active" : ""}`}
            >
              <span className="work-nav-icon">
                <WorkspaceIcon name="profile" />
              </span>
              <span className="work-nav-label">
                {local(locale, "প্রোফাইল", "Profile")}
              </span>
              {(section[0] ?? "") === "profile" && (
                <span className="work-nav-pill" aria-hidden="true" />
              )}
            </Link>
            <Link
              href={`${base}/help`}
              prefetch={true}
              aria-current={(section[0] ?? "") === "help" ? "page" : undefined}
              className={`work-nav-link ${(section[0] ?? "") === "help" ? "active" : ""}`}
            >
              <span className="work-nav-icon">
                <WorkspaceIcon name="help" />
              </span>
              <span className="work-nav-label">
                {local(locale, "সহায়তা", "Help")}
              </span>
              {(section[0] ?? "") === "help" && (
                <span className="work-nav-pill" aria-hidden="true" />
              )}
            </Link>
          </nav>

          <div className="work-sidebar-footer">
            {actor.role === "admin" && actor.verified && !actor.is_demo && (
              <Link
                prefetch={false}
                className="work-nav-link"
                href="/docs/manage"
              >
                <span className="work-nav-icon">
                  <WorkspaceIcon name="help" />
                </span>
                <span className="work-nav-label">
                  {local(
                    locale,
                    "ডকুমেন্টেশন প্রকাশনা",
                    "Documentation publishing",
                  )}
                </span>
              </Link>
            )}
            <div className="work-user-chip glass-1">
              <Link
                href={`${base}/profile`}
                prefetch={true}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flex: 1,
                  minWidth: 0,
                  textDecoration: "none",
                  color: "inherit",
                }}
                title={local(
                  locale,
                  "প্রোফাইল দেখুন ও পরিবর্তন করুন",
                  "View and edit profile",
                )}
              >
                <span className="work-user-avatar" aria-hidden="true">
                  {Array.from(actor.name)[0]}
                </span>
                <div className="work-user-meta">
                  <strong className="work-user-name">{actor.name}</strong>
                  <small className="work-user-role">
                    {actor.district} · {local(locale, ...roles[actor.role])}
                  </small>
                </div>
              </Link>
              <SignOutButton
                action={logoutAction.bind(null, locale)}
                title={local(locale, "সাইন আউট", "Sign out")}
              />
            </div>
          </div>
        </aside>

        {/* Content Wrap with Top Bar */}
        <div className="work-content-wrap">
          <header className="work-topbar">
            <div className="work-topbar-left">
              <h1 className="work-topbar-title">{pageTitle}</h1>
            </div>

            <div className="work-topbar-right">
              <QuickSearch
                items={searchItems}
                placeholder={local(
                  locale,
                  "অনুসন্ধান... (Ctrl+K)",
                  "Search... (Ctrl+K)",
                )}
                locale={locale}
              />

              <NotificationBell
                locale={locale}
                base={base}
                initialUnread={notificationsResult.unread}
                initialItems={notificationsResult.items}
              />

              <ThemeToggle
                labels={{
                  light: local(locale, "লাইট", "Light"),
                  dark: local(locale, "ডার্ক", "Dark"),
                }}
              />

              <Link
                className="work-lang-pill"
                href={`/${alternative}/workspace${section.length ? `/${section.map(encodeURIComponent).join("/")}` : ""}${alternateQuery.size ? `?${alternateQuery}` : ""}`}
                lang={alternative}
              >
                {local(locale, "English", "বাংলা")}
              </Link>
            </div>
          </header>

          <main className="work-main" id="main" tabIndex={-1}>
            <OfflineNotice locale={locale} />
            {filters.saved === "1" && (
              <p className="work-feedback" role="status">
                {local(locale, "পরিবর্তন সংরক্ষিত হয়েছে।", "Changes saved.")}
              </p>
            )}
            {content}
          </main>
        </div>

        {/* Mobile Floating Bottom Tabs */}
        <nav
          className="work-mobile-tabs"
          aria-label={local(locale, "মোবাইল নেভিগেশন", "Mobile navigation")}
        >
          {navItems.slice(0, 5).map(([path, name]) => {
            const isCurrent = (section[0] ?? "") === path;
            return (
              <Link
                key={path}
                href={path ? `${base}/${path}` : base}
                prefetch={true}
                aria-current={isCurrent ? "page" : undefined}
                className={`work-mobile-tab ${isCurrent ? "active" : ""}`}
              >
                <WorkspaceIcon name={path} />
                <span>{name}</span>
              </Link>
            );
          })}
        </nav>
        {/* Floating Chatbot Widget (Bottom Right) */}
        <ChatbotWidget locale={locale} base={base} actor={actor} />
      </div>
    );
  }

  // Guest State: Split Sign In / Sign Up
  const isSignup = filters.mode === "signup";

  return (
    <div className="work-shell work-shell-guest">
      <AuthCompleted target="guest" />
      <a className="skip-link" href="#main">
        {local(locale, "মূল অংশে যান", "Skip to main content")}
      </a>
      <div className="canvas-blobs" aria-hidden="true" />

      <header className="work-guest-header">
        <Link className="brand-link" href={`/${locale}`}>
          <BrandLogo />
        </Link>
        <div className="work-guest-actions">
          <ThemeToggle
            labels={{
              light: local(locale, "লাইট", "Light"),
              dark: local(locale, "ডার্ক", "Dark"),
            }}
          />
          <Link
            className="work-lang-pill"
            href={`/${alternative}/workspace${alternateQuery.size ? `?${alternateQuery}` : ""}`}
            lang={alternative}
          >
            {local(locale, "English", "বাংলা")}
          </Link>
          <Link className="work-link" href={`/${locale}`}>
            {local(locale, "প্রচ্ছদে ফিরুন", "Back to home")}
          </Link>
        </div>
      </header>

      <main className="work-auth-main" id="main" tabIndex={-1}>
        <OfflineNotice locale={locale} />

        <div className="work-sign-in">
          {/* Split Left Column: Auth Forms */}
          <div className="signin-content glass-2">
            {/* Mode Switcher Tabs */}
            <div className="auth-modes" role="tablist">
              <Link
                href={`${base}?mode=signin`}
                role="tab"
                aria-selected={!isSignup}
                className={`auth-mode-tab ${!isSignup ? "active" : ""}`}
              >
                {local(locale, "সাইন ইন", "Sign in")}
              </Link>
              <Link
                href={`${base}?mode=signup`}
                role="tab"
                aria-selected={isSignup}
                className={`auth-mode-tab ${isSignup ? "active" : ""}`}
              >
                {local(locale, "নতুন অ্যাকাউন্ট", "Create account")}
              </Link>
            </div>

            {filters.signed_up === "1" && (
              <p className="work-feedback" role="status">
                {local(
                  locale,
                  "নিবন্ধন সফল। এজেন্ট যাচাই করার পর আপনি সাইন ইন করতে পারবেন।",
                  "Registration successful. You can sign in after agent verification.",
                )}
              </p>
            )}
            {error && (
              <p role="status" className="work-panel form-error">
                {errorText(locale, error)}
              </p>
            )}

            {/* Mode: Sign In */}
            {!isSignup && (
              <>
                <div className="auth-header-copy">
                  <p className="eyebrow">
                    {local(locale, "স্বাগতম", "Welcome back")}
                  </p>
                  <h1>{local(locale, "সাইন ইন", "Sign in")}</h1>
                  <p className="auth-subcopy">
                    {local(
                      locale,
                      "পেঁয়াজফ্লো ওয়ার্কস্পেসে প্রবেশ করে মজুত ও অর্ডার পরিচালনা করুন।",
                      "Access your PeyajFlow workspace to manage stock, offers and deliveries.",
                    )}
                  </p>
                </div>

                {identities.length > 0 && (
                  <section className="work-panel">
                    <h2>
                      {local(
                        locale,
                        "ডেমো অ্যাকাউন্ট বেছে নিন",
                        "Choose demo account",
                      )}
                    </h2>
                    <WorkspaceForm
                      locale={locale}
                      action={signIn.bind(null, locale)}
                      label={local(locale, "ওয়ার্কস্পেস খুলুন", "Open workspace")}
                      authType="signin"
                    >
                      <Field label={local(locale, "অ্যাকাউন্ট", "Account")}>
                        <select name="identity" required defaultValue="">
                          <option value="" disabled>
                            {local(locale, "বেছে নিন", "Choose an account")}
                          </option>
                          {identities.map((identity) => (
                            <option
                              key={identity.identity}
                              value={identity.identity}
                            >
                              {identity.name} ·{" "}
                              {local(locale, ...roles[identity.role])}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {process.env.SHOWCASE_REQUIRE_CODE === "true" && (
                        <Field
                          label={local(
                            locale,
                            "প্রবেশ কোড",
                            "Workspace access code",
                          )}
                        >
                          <input
                            name="access_key"
                            type="password"
                            maxLength={256}
                            required
                          />
                        </Field>
                      )}
                    </WorkspaceForm>
                  </section>
                )}

                <section className="work-panel">
                  <h2>
                    {local(locale, "পাসওয়ার্ড দিয়ে প্রবেশ", "Password sign-in")}
                  </h2>
                  {reviewingSignups && (
                    <p>{errorText(locale, "signup_review_access")}</p>
                  )}
                  <WorkspaceForm
                    locale={locale}
                    action={passwordSignIn.bind(
                      null,
                      locale,
                      reviewingSignups ? "verifications" : "",
                    )}
                    label={local(
                      locale,
                      "পাসওয়ার্ড দিয়ে সাইন ইন",
                      "Sign in with password",
                    )}
                    authType="signin"
                  >
                    <Field label={local(locale, "অ্যাকাউন্ট আইডি", "Account ID")}>
                      <input
                        name="username"
                        autoComplete="username"
                        maxLength={64}
                        required
                      />
                    </Field>
                    <Field label={local(locale, "পাসওয়ার্ড", "Password")}>
                      <input
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        maxLength={256}
                        required
                      />
                    </Field>
                  </WorkspaceForm>
                </section>

                {smsSignIn && (
                  <section className="work-panel">
                    <h2>
                      {local(
                        locale,
                        "এসএমএস কোডে প্রবেশ",
                        "Sign in with SMS code",
                      )}
                    </h2>
                    <p>
                      {local(
                        locale,
                        "যাচাই করা ফোন নম্বরে কোড পাঠানো হয়। কোড কাউকে জানাবেন না।",
                        "A code is sent to your verified phone number. Never share it.",
                      )}
                    </p>
                    <WorkspaceForm
                      locale={locale}
                      action={requestOtp.bind(null, locale)}
                      label={local(locale, "কোড পাঠান", "Send code")}
                    >
                      <Field label={local(locale, "ফোন নম্বর", "Phone number")}>
                        <input
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          placeholder="+8801XXXXXXXXX"
                          maxLength={16}
                          required
                        />
                      </Field>
                    </WorkspaceForm>
                    <WorkspaceForm
                      locale={locale}
                      action={otpSignIn.bind(null, locale)}
                      authType="signin"
                      label={local(
                        locale,
                        "কোড দিয়ে প্রবেশ",
                        "Sign in with code",
                      )}
                    >
                      <Field label={local(locale, "ফোন নম্বর", "Phone number")}>
                        <input
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          maxLength={16}
                          required
                        />
                      </Field>
                      <Field
                        label={local(locale, "৬ অঙ্কের কোড", "6-digit code")}
                      >
                        <input
                          name="code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          minLength={6}
                          required
                        />
                      </Field>
                    </WorkspaceForm>
                  </section>
                )}

                <div className="auth-switch-note">
                  <span>
                    {local(
                      locale,
                      "নতুন অ্যাকাউন্ট প্রয়োজন?",
                      "Need an account?",
                    )}{" "}
                  </span>
                  <Link className="work-link" href={`${base}?mode=signup`}>
                    {local(locale, "নিবন্ধন করুন", "Create one now")}
                  </Link>
                </div>
              </>
            )}

            {/* Mode: Sign Up */}
            {isSignup && (
              <>
                <div className="auth-header-copy">
                  <p className="eyebrow">
                    {local(locale, "নতুন অ্যাকাউন্ট", "Get Started")}
                  </p>
                  <h1>{local(locale, "নিবন্ধন করুন", "Create account")}</h1>
                  <p className="auth-subcopy">
                    {local(
                      locale,
                      "কৃষক বা পাইকারি ক্রেতা হিসেবে যুক্ত হয়ে স্বচ্ছ সরবরাহ ব্যবস্থার সুবিধা নিন।",
                      "Join as a farmer or buyer for transparent onion supply tracking.",
                    )}
                  </p>
                </div>

                <section className="work-panel">
                  <WorkspaceForm
                    locale={locale}
                    action={signupAction.bind(null, locale)}
                    label={local(locale, "নিবন্ধন করুন", "Sign up")}
                  >
                    <Field label={local(locale, "পুরো নাম", "Full name")}>
                      <input
                        name="name"
                        autoComplete="name"
                        maxLength={100}
                        required
                      />
                    </Field>
                    <Field label={local(locale, "জেলা", "District")}>
                      <input
                        name="district"
                        autoComplete="address-level2"
                        maxLength={100}
                        required
                      />
                    </Field>
                    <Field label={local(locale, "ভূমিকা", "Role")}>
                      <select name="role" required defaultValue="">
                        <option value="" disabled>
                          {local(locale, "বেছে নিন", "Choose a role")}
                        </option>
                        <option value="farmer">
                          {local(locale, "কৃষক", "Farmer")}
                        </option>
                        <option value="buyer">
                          {local(locale, "ক্রেতা", "Buyer")}
                        </option>
                      </select>
                    </Field>
                    <Field label={local(locale, "অ্যাকাউন্ট আইডি", "Account ID")}>
                      <input
                        name="username"
                        autoComplete="username"
                        maxLength={64}
                        required
                        pattern={String.raw`[a-zA-Z][a-zA-Z0-9_.\-]{2,63}`}
                        title={local(
                          locale,
                          "ইংরেজি অক্ষর দিয়ে শুরু করুন। অক্ষর, সংখ্যা, আন্ডারস্কোর, ডট বা হাইফেন ব্যবহার করুন।",
                          "Must start with a letter. Use letters, numbers, underscore, dot or hyphen.",
                        )}
                      />
                    </Field>
                    <Field label={local(locale, "পাসওয়ার্ড", "Password")}>
                      <input
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        maxLength={256}
                        required
                        minLength={14}
                        title={local(
                          locale,
                          "কমপক্ষে ১৪ অক্ষরের পাসফ্রেজ ব্যবহার করুন।",
                          "Use a passphrase of at least 14 characters.",
                        )}
                      />
                    </Field>
                    <Field
                      label={local(
                        locale,
                        "ফোন নম্বর (E.164)",
                        "Phone number (E.164)",
                      )}
                    >
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        maxLength={20}
                        required
                        placeholder="+8801XXXXXXXXX"
                        pattern={String.raw`\+[1-9১-৯][0-9০-৯]{7,14}`}
                        title={local(
                          locale,
                          "আন্তর্জাতিক বিন্যাসে ফোন নম্বর দিন। উদাহরণ: +8801XXXXXXXXX",
                          "Enter phone in international format. Example: +8801XXXXXXXXX",
                        )}
                      />
                    </Field>
                    <Field label={local(locale, "এনআইডি নম্বর", "NID number")}>
                      <input
                        name="nid"
                        inputMode="numeric"
                        pattern="[0-9০-৯]{10}|[0-9০-৯]{13}|[0-9০-৯]{17}"
                        maxLength={17}
                        required
                        minLength={10}
                        title={local(
                          locale,
                          "জাতীয় পরিচয়পত্র নম্বর দিন: ১০, ১৩ বা ১৭ অঙ্ক।",
                          "Enter your National ID number: 10, 13 or 17 digits.",
                        )}
                      />
                    </Field>
                  </WorkspaceForm>
                </section>

                <div className="auth-switch-note">
                  <span>
                    {local(
                      locale,
                      "ইতিমধ্যে অ্যাকাউন্ট আছে?",
                      "Already registered?",
                    )}{" "}
                  </span>
                  <Link className="work-link" href={`${base}?mode=signin`}>
                    {local(locale, "সাইন ইন করুন", "Sign in here")}
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Split Right Column: Visual Brand Card */}
          <div className="signin-photo">
            <div className="signin-floating-tag">
              <span className="hero-dot" aria-hidden="true" />
              <span>
                {local(
                  locale,
                  "পাবনা মোকাম · যাচাইকৃত সংরক্ষণ",
                  "Pabna Hub · Verified Storage",
                )}
              </span>
            </div>
            <div className="signin-photo-content">
              <p className="eyebrow" style={{ color: "rgba(255,255,255,0.9)" }}>
                {local(locale, "পাবনা থেকে ঢাকা", "Pabna to Dhaka")}
              </p>
              <h2>
                {local(
                  locale,
                  "মাঠ থেকে বাজার, প্রতিটি পেঁয়াজের স্বচ্ছ হিসাব",
                  "From farm storage to market sale with complete clarity",
                )}
              </h2>
              <p>
                {local(
                  locale,
                  "ওজন, আর্দ্রতা, সংরক্ষণ অবস্থা এবং প্রকৃত বাজারদরের ভিত্তিতে আত্মবিশ্বাসের সাথে ক্রয়-বিক্রয় করুন।",
                  "Real inspection evidence, weight verification, and source-attributed wholesale prices.",
                )}
              </p>
              <div className="signin-trust-badges">
                <span className="signin-trust-chip">
                  <WorkspaceIcon name="check" />
                  {local(locale, "যাচাইকৃত ওজন", "Verified weight")}
                </span>
                <span className="signin-trust-chip">
                  <WorkspaceIcon name="check" />
                  {local(locale, "সরাসরি দর", "Transparent pricing")}
                </span>
                <span className="signin-trust-chip">
                  <WorkspaceIcon name="check" />
                  {local(locale, "দ্বিভাষিক সহায়তা", "Bilingual support")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
