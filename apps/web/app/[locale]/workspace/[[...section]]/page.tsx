import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLogo } from "../../../../components/brand-logo";
import { AdvicePage } from "../../../../components/workspace/advice";
import { AgentsPage } from "../../../../components/workspace/agents";
import { AlertsPage } from "../../../../components/workspace/alerts";
import { AssistancePage } from "../../../../components/workspace/assistance";
import { Dashboard } from "../../../../components/workspace/dashboard";
import { WorkspaceIcon } from "../../../../components/workspace/icon";
import { LogisticsPage } from "../../../../components/workspace/logistics";
import { OfflineNotice } from "../../../../components/workspace/offline";
import { OperationsPage } from "../../../../components/workspace/operations";
import {
  ImportsPage,
  PricePage,
} from "../../../../components/workspace/prices";
import { VerificationsPage } from "../../../../components/workspace/verifications";
import { VoicePage } from "../../../../components/workspace/voice";
import { Details, Field } from "../../../../components/workspace/fields";
import { WorkspaceForm } from "../../../../components/workspace/form";
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
import type { Filters } from "../../../../lib/workspace-types";
import {
  mutate,
  passwordSignIn,
  signIn,
  signOut,
  signupAction,
} from "../actions";

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
  pages.push(["alerts", local(locale, "বিজ্ঞপ্তি", "Alerts")]);
  if (canUseVoice(actor))
    pages.push(["voice", local(locale, "বাংলা সহকারী", "Bangla assistant")]);
  pages.push(["help", local(locale, "সহায়তা", "Help")]);
  if (actor.role === "agent" && actor.verified && !actor.is_demo)
    pages.push([
      "verifications",
      local(locale, "নিবন্ধন যাচাই", "Signup verification"),
    ]);
  if (actor.role === "farmer")
    pages.push(["agents", local(locale, "সহায়তাকারী", "Agent access")]);
  if (actor.role === "admin")
    pages.push(["operations", local(locale, "পরিচালনা", "Operations")]);
  if (actor.role === "admin")
    pages.push(["imports", local(locale, "দর আমদানি", "Market imports")]);
  return pages;
}

function Overview({
  locale,
  actor,
  base,
}: {
  locale: Locale;
  actor: Profile;
  base: string;
}) {
  return (
    <>
      <Dashboard locale={locale} actor={actor} base={base} />
      <section className="work-panel work-profile">
        <div>
          <h2>{actor.name}</h2>
          <p>
            {local(locale, ...roles[actor.role])} · {actor.district}
          </p>
          <p>
            {actor.verified
              ? local(locale, "যাচাইকৃত অ্যাকাউন্ট", "Verified account")
              : local(locale, "নিজস্ব তথ্য", "Self-reported profile")}
          </p>
          {actor.role === "agent" && actor.verified && (
            <p>
              {local(
                locale,
                "কৃষককে দেওয়ার আইডি",
                "Agent access ID to share with a farmer",
              )}{" "}
              · <code>{actor.membership_id}</code>
            </p>
          )}
        </div>
        <WorkspaceForm
          locale={locale}
          action={signOut.bind(null, locale)}
          label={local(locale, "সাইন আউট", "Sign out")}
        />
      </section>
      <section className="work-panel">
        <Details label={local(locale, "প্রোফাইল বদলান", "Edit profile")}>
          <WorkspaceForm
            locale={locale}
            action={mutate.bind(null, locale, "profile", "", "")}
            label={local(locale, "প্রোফাইল সংরক্ষণ করুন", "Save profile")}
          >
            <div className="work-grid">
              <Field label={local(locale, "নাম", "Name")}>
                <input
                  name="name"
                  defaultValue={actor.name}
                  maxLength={100}
                  required
                />
              </Field>
              <Field label={local(locale, "জেলা", "District")}>
                <input
                  name="district"
                  defaultValue={actor.district}
                  maxLength={100}
                  required
                />
              </Field>
              <Field label={local(locale, "পছন্দের ভাষা", "Preferred language")}>
                <select name="language" defaultValue={actor.language}>
                  <option value="bn">বাংলা</option>
                  <option value="en">English</option>
                </select>
              </Field>
            </div>
          </WorkspaceForm>
        </Details>
      </section>
    </>
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
  if (!page) return <Overview {...context} />;
  if (!destinations(locale, actor).some(([path]) => path === page)) {
    if (page === "verifications") {
      return (
        <section className="work-panel">
          <p role="alert">{errorText(locale, "signup_review_access")}</p>
          <WorkspaceForm
            locale={locale}
            action={signOut.bind(null, locale)}
            label={local(locale, "সাইন আউট", "Sign out")}
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
  }
  if (page === "imports" && !child) return ImportsPage({ ...context, id });
  if (page === "voice" && !child) return VoicePage({ ...context, id });
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
  const reviewingSignups =
    section.length === 1 && section[0] === "verifications";
  const alternative = locale === "bn" ? "en" : "bn";
  let actor: Profile | undefined;
  let error: string | undefined;
  let identities: DemoIdentity[] = [];
  try {
    actor = await api<Profile>("/v1/me");
  } catch (exception) {
    if (!(exception instanceof ApiError)) throw exception;
    if (exception.status !== 401) error = exception.code;
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
  if (actor) {
    try {
      content = await panel(locale, actor, base, section, filters);
    } catch (exception) {
      if (!(exception instanceof ApiError)) throw exception;
      content = (
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
    }
  }
  return (
    <div
      className={
        actor ? "work-shell work-shell-signed" : "work-shell work-shell-guest"
      }
    >
      <a className="skip-link" href="#main">
        {local(locale, "মূল অংশে যান", "Skip to main content")}
      </a>
      <header className="work-header">
        <Link className="brand-link" href={actor ? base : `/${locale}`}>
          <BrandLogo />
        </Link>
        <div className="work-header-actions">
          {actor && (
            <span className="work-user">
              <span aria-hidden="true">{Array.from(actor.name)[0]}</span>
              <span>
                {actor.name}
                <small>{local(locale, ...roles[actor.role])}</small>
              </span>
            </span>
          )}
          <Link
            className="language"
            href={`/${alternative}/workspace${section.length ? `/${section.map(encodeURIComponent).join("/")}` : ""}${alternateQuery.size ? `?${alternateQuery}` : ""}`}
            lang={alternative}
          >
            {local(locale, "English", "বাংলা")}
          </Link>
        </div>
      </header>
      {actor && (
        <nav
          className="work-nav"
          aria-label={local(
            locale,
            "ওয়ার্কস্পেস নেভিগেশন",
            "Workspace navigation",
          )}
        >
          {destinations(locale, actor).map(([path, name]) => (
            <Link
              key={path}
              href={path ? `${base}/${path}` : base}
              aria-current={(section[0] ?? "") === path ? "page" : undefined}
            >
              <WorkspaceIcon name={path} />
              {name}
            </Link>
          ))}
        </nav>
      )}
      <main className="work-main" id="main" tabIndex={-1}>
        <OfflineNotice locale={locale} />
        {actor ? (
          <>
            {filters.saved === "1" && (
              <p className="work-feedback" role="status">
                {local(locale, "পরিবর্তন সংরক্ষিত হয়েছে।", "Changes saved.")}
              </p>
            )}
            {content}
          </>
        ) : (
          <div className="work-sign-in">
            <div className="signin-photo" aria-hidden="true" />
            <div className="signin-content">
              <h1>{local(locale, "সাইন ইন", "Sign in")}</h1>
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
                <p role="status" className="work-panel">
                  {errorText(locale, error)}
                </p>
              )}
              {identities.length > 0 && (
                <section className="work-panel">
                  <h2>
                    {local(locale, "অ্যাকাউন্ট বেছে নিন", "Choose an account")}
                  </h2>
                  <WorkspaceForm
                    locale={locale}
                    action={signIn.bind(null, locale)}
                    label={local(locale, "ওয়ার্কস্পেস খুলুন", "Open workspace")}
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
              <section className="work-panel">
                <h2>
                  {local(locale, "নতুন অ্যাকাউন্ট খুলুন", "Create new account")}
                </h2>
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
                      pattern="[0-9০-৯]{10,20}"
                      maxLength={20}
                      required
                      minLength={10}
                      title={local(
                        locale,
                        "জাতীয় পরিচয়পত্র নম্বর দিন।",
                        "Enter your National ID number.",
                      )}
                    />
                  </Field>
                </WorkspaceForm>
              </section>
              <Link className="work-link" href={`/${locale}`}>
                {local(locale, "প্রচ্ছদে ফিরুন", "Back to home")}
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
