import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { isLocale, type Locale } from "../../../../lib/copy";
import { local } from "../../../../lib/workspace-copy";
import { BrandLogo } from "../../../../components/brand-logo";
import { ThemeToggle } from "../../../../components/theme-toggle";
import { WorkspaceIcon } from "../../../../components/workspace/icon";
import { PhoneDialer } from "../../../../components/workspace/phone-dialer";
import { VoiceDesk } from "../../../../components/workspace/voice-desk";
import { KnowledgePanel } from "../../../../components/workspace/knowledge";
import {
  api,
  type Profile,
  sessionCookie,
} from "../../../../lib/workspace-api";
import type { VoiceCall, PriceSeries } from "../../../../lib/pilot-types";
import type {
  Lot,
  Offer,
  Order,
  PageResult,
  Supply,
} from "../../../../lib/workspace-types";

export const dynamic = "force-dynamic";

export default async function CallSimulatorPage({
  params,
}: {
  params: Promise<{ locale: string; id?: string[] }>;
}) {
  const { locale, id: idSegments = [] } = await params;
  if (!isLocale(locale)) notFound();

  const callId = idSegments[0];
  const t = (bn: string, en: string) => local(locale, bn, en);
  const alternate = locale === "bn" ? "en" : "bn";

  // Check optional session for authenticated commands during active calls
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  let actor: Profile | null = null;
  if (token) {
    try {
      actor = await api<Profile>("/v1/me");
    } catch {
      actor = null;
    }
  }

  return (
    <div className="call-simulator-shell">
      <div className="canvas-blobs" aria-hidden="true" />

      {/* Standalone Simulator Header - Decoupled from Dashboard */}
      <header className="call-simulator-header">
        <div className="call-simulator-header-left">
          <Link className="brand-link" href={`/${locale}`} prefetch={true}>
            <BrandLogo />
          </Link>
          <div className="call-simulator-tag">
            <span className="call-simulator-live-dot" aria-hidden="true" />
            <span>{t("কল সিমুলেটর", "Call Simulator")}</span>
          </div>
        </div>

        <div className="call-simulator-header-right">
          <Link
            href={`/${locale}/workspace`}
            className="call-simulator-workspace-link"
            prefetch={true}
            title={t(
              "ওয়ার্কস্পেস ড্যাশবোর্ডে ফিরুন",
              "Return to Workspace Dashboard",
            )}
          >
            <WorkspaceIcon name="logout" size={15} />
            <span>{t("ড্যাশবোর্ড", "Dashboard")}</span>
          </Link>

          <ThemeToggle
            labels={{
              light: local(locale, "লাইট", "Light"),
              dark: local(locale, "ডার্ক", "Dark"),
            }}
          />

          <Link
            className="work-lang-pill"
            href={`/${alternate}/call-simulator${callId ? `/${callId}` : ""}`}
            lang={alternate}
          >
            {local(locale, "English", "বাংলা")}
          </Link>
        </div>
      </header>

      {/* Main Simulator Stage */}
      <main className="call-simulator-main">
        {callId && actor ? (
          <VoiceActiveSession locale={locale} callId={callId} actor={actor} />
        ) : (
          <div className="call-simulator-dialer-wrap">
            <PhoneDialer
              locale={locale}
              initialTime={new Date().toLocaleTimeString(
                locale === "bn" ? "bn-BD" : "en-US",
                { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" },
              )}
            />
          </div>
        )}
      </main>
    </div>
  );
}

async function VoiceActiveSession({
  locale,
  callId,
  actor,
}: {
  locale: Locale;
  callId: string;
  actor: Profile;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);

  const [call, lots, offers, orders, supply, series] = await Promise.all([
    api<VoiceCall>(`/v1/voice/calls/${callId}`),
    actor.role !== "buyer" ? api<Lot[]>("/v1/lots") : Promise.resolve([]),
    actor.role !== "agent" ? api<Offer[]>("/v1/offers") : Promise.resolve([]),
    actor.role !== "agent" ? api<Order[]>("/v1/orders") : Promise.resolve([]),
    actor.role === "buyer"
      ? api<PageResult<Supply>>("/v1/matches").then((result) => result.items)
      : Promise.resolve([]),
    api<PriceSeries[]>("/v1/market/series"),
  ]);

  return (
    <div className="voice-active-page call-simulator-desk-stage">
      <Link className="voice-back-btn" href={`/${locale}/call-simulator`}>
        <span className="voice-back-arrow" aria-hidden="true">
          <WorkspaceIcon name="arrow" />
        </span>
        <span>{t("ডায়ালারে ফিরুন", "Back to Dialer")}</span>
      </Link>
      <VoiceDesk
        locale={locale}
        base={`/${locale}/workspace`}
        initial={call}
        actor={actor}
        lots={lots}
        offers={offers}
        orders={orders}
        supply={supply}
        series={series}
      />
      <KnowledgePanel locale={locale} />
    </div>
  );
}
