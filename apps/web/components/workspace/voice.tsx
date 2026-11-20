import Link from "next/link";
import type { Locale } from "../../lib/copy";
import type { PriceSeries, VoiceCall } from "../../lib/pilot-types";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type {
  Lot,
  Offer,
  Order,
  PageResult,
  Supply,
} from "../../lib/workspace-types";
import { WorkspaceIcon } from "./icon";
import { VoiceDesk } from "./voice-desk";
import { PhoneDialer } from "./phone-dialer";

export async function VoicePage({
  locale,
  base,
  actor,
  id,
}: {
  locale: Locale;
  base: string;
  actor: Profile;
  id?: string;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);

  if (id) {
    const [call, lots, offers, orders, supply, series] = await Promise.all([
      api<VoiceCall>(`/v1/voice/calls/${id}`),
      actor.role !== "buyer" ? api<Lot[]>("/v1/lots") : Promise.resolve([]),
      actor.role !== "agent" ? api<Offer[]>("/v1/offers") : Promise.resolve([]),
      actor.role !== "agent" ? api<Order[]>("/v1/orders") : Promise.resolve([]),
      actor.role === "buyer"
        ? api<PageResult<Supply>>("/v1/matches").then((result) => result.items)
        : Promise.resolve([]),
      api<PriceSeries[]>("/v1/market/series"),
    ]);
    return (
      <div className="voice-active-page">
        <Link className="voice-back-btn" href={`${base}/voice`}>
          <span className="voice-back-arrow" aria-hidden="true">
            <WorkspaceIcon name="arrow" />
          </span>
          <span>{t("সহকারী ডেস্কে ফিরুন", "Back to Voice Assistant")}</span>
        </Link>
        <VoiceDesk
          locale={locale}
          base={base}
          initial={call}
          actor={actor}
          lots={lots}
          offers={offers}
          orders={orders}
          supply={supply}
          series={series}
        />
      </div>
    );
  }

  return (
    <div className="voice-page-wrap voice-clean-dialer-page">
      <PhoneDialer locale={locale} />
    </div>
  );
}
