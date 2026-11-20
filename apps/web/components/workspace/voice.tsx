import Link from "next/link";
import {
  pilotMutate,
  resolveVoiceTask,
  startSimulatedCall,
} from "../../app/[locale]/workspace/pilot-actions";
import type { Locale } from "../../lib/copy";
import type { PriceSeries, VoiceCall, VoiceTask } from "../../lib/pilot-types";
import { api, type Profile } from "../../lib/workspace-api";
import { local, roles } from "../../lib/workspace-copy";
import type {
  Lot,
  Offer,
  Order,
  PageResult,
  Supply,
} from "../../lib/workspace-types";
import { numberLabel, timeLabel } from "../../lib/workspace-values";
import { WorkspaceIcon } from "./icon";
import { VoiceDesk } from "./voice-desk";

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

  const tasks = await api<VoiceTask[]>("/v1/voice/tasks");
  const openTasksCount = tasks.filter((task) => task.status !== "resolved").length;

  return (
    <div className="voice-page-wrap">
      {/* ─── 1. HERO VOICE INTERACTION STAGE (Modern Voice-to-Text UI) ─── */}
      <section className="work-panel voice-hero-card glass-1">
        {/* Ambient Top Glow */}
        <div className="voice-hero-ambient" aria-hidden="true" />

        {/* Top Meta Strip */}
        <div className="voice-hero-header">
          <div className="dash-welcome-eyebrow">
            <span className="dash-pulse-dot" aria-hidden="true" />
            <span>{t("লাইভ ভয়েস সহকারী", "Live Voice Assistant")}</span>
          </div>
          <div className="voice-engine-badge">
            <span className="voice-engine-icon" aria-hidden="true">
              <WorkspaceIcon name="speech" size={18} />
            </span>
            <span>
              {t(
                "স্বয়ংক্রিয় বাক্য শনাক্তকরণ (Speech-to-Text)",
                "Speech-to-Text Engine Ready",
              )}
            </span>
          </div>
        </div>

        {/* Title & Tagline */}
        <div className="voice-hero-intro">
          <h1 className="voice-hero-title">
            <span className="headline-primary">
              {t("বাংলা কণ্ঠস্বর সহকারী", "Bangla Voice Assistant")}
            </span>
          </h1>
          <p className="voice-hero-desc">
            {t(
              "বাংলায় সরাসরি কথা বলে মজুত জানুন, মোকামের দর দেখুন এবং কিপ্যাডে নিশ্চিত করে নতুন অফার ও অর্ডার তৈরি করুন।",
              "Speak naturally in Bangla to query storage weights, review wholesale benchmarks, and execute trades.",
            )}
          </p>
        </div>

        {/* Interactive Speech Dialogue Canvas (Inspired by sample) */}
        <div className="voice-dialogue-stage">
          {/* User Spoken Utterance Bubble */}
          <div className="voice-speech-bubble voice-speech-user">
            <div className="voice-bubble-header">
              <span className="voice-bubble-lang-pill">
                <WorkspaceIcon name="bd" size={16} />
                <span>{t("বাংলা (পাবনা উপভাষা সমর্থিত)", "Bangla (Pabna dialect)")}</span>
              </span>
              <span className="voice-bubble-user-tag">
                {actor.name} · {local(locale, ...roles[actor.role])}
              </span>
            </div>
            <p className="voice-bubble-text">
              {t(
                "“আমার তাহেরপুরী স্টকের বর্তমান মজুদ ও কাওরান বাজারে পাইকারী দর কত?”",
                "“আমার তাহেরপুরী স্টকের বর্তমান মজুদ ও কাওরান বাজারে পাইকারী দর কত?”",
              )}
            </p>
          </div>

          <div className="voice-dialogue-divider" aria-hidden="true">
            <span className="voice-divider-dot" />
            <span className="voice-divider-line" />
            <span className="voice-divider-dot" />
          </div>

          {/* AI Voice Assistant Response Bubble */}
          <div className="voice-speech-bubble voice-speech-ai">
            <div className="voice-bubble-header">
              <span className="voice-bubble-ai-pill">
                <span className="voice-pulse-dot" aria-hidden="true" />
                <WorkspaceIcon name="onion" size={16} />
                <span>{t("PeyajFlow ভয়েস সহকারী", "PeyajFlow Voice AI")}</span>
              </span>
              <span className="voice-bubble-ai-tag">
                {t("স্বীকৃত উত্তর", "Recognized Response")}
              </span>
            </div>
            <p className="voice-bubble-text">
              {t(
                "“আপনার মাচায় তাহেরপুরী পেঁয়াজ ২০,৭২০ কেজি মজুদ রয়েছে। কাওরান বাজারে আজকের পাইকারি দর ৪৫.৫৫ ৳/কেজি।”",
                "“You have 20,720 kg of Taherpuri onion in storage. Today's wholesale price in Karwan Bazar is 45.55 ৳/kg.”",
              )}
            </p>
          </div>
        </div>

        {/* Voice Assistant Trigger CTA Button (Replaces waveform & circular mic on main page) */}
        <div className="voice-assistant-cta-wrap">
          <form
            action={startSimulatedCall.bind(null, locale)}
            className="voice-assistant-cta-form"
          >
            <button
              type="submit"
              className="voice-assistant-cta-btn"
              title={t("ভয়েস সহকারী শুরু করুন", "Start Voice Assistant")}
            >
              <span className="voice-cta-mic-badge" aria-hidden="true">
                <WorkspaceIcon name="mic" size={24} />
              </span>
              <span className="voice-cta-content">
                <span className="voice-cta-title">
                  {t("ভয়েস সহকারী শুরু করুন", "Start Voice Assistant")}
                </span>
                <span className="voice-cta-hint">
                  {t(
                    "সিমুলেটেড কল চালু করে লাইভ কথা বলুন ও লেনদেন করুন",
                    "Launch simulated call to speak and trade directly",
                  )}
                </span>
              </span>
              <span className="voice-cta-arrow" aria-hidden="true">
                <WorkspaceIcon name="arrow" />
              </span>
            </button>
          </form>
        </div>

        {/* Quick Voice Prompt Shortcuts (Styled as Overview KPI Cards) */}
        <div className="voice-prompts-tray">
          <div className="voice-prompts-label">
            {t("সমর্থিত কণ্ঠস্বর নির্দেশনাসমূহ:", "Common voice commands you can speak:")}
          </div>
          <div className="dash-kpi-grid voice-prompts-grid">
            <div className="dash-kpi-card glass-1 voice-prompt-chip">
              <div className="dash-kpi-header">
                <span className="dash-kpi-icon">
                  <WorkspaceIcon name="package" />
                </span>
                <span className="dash-kpi-badge">{t("মজুত", "Stock")}</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">{t("মজুত পরীক্ষা", "Check stock")}</span>
                <strong className="voice-prompt-sample">
                  {t("“আমার মাচায় পেঁয়াজ কত আছে?”", "“How much onion in my shed?”")}
                </strong>
              </div>
            </div>

            <div className="dash-kpi-card glass-1 voice-prompt-chip">
              <div className="dash-kpi-header">
                <span className="dash-kpi-icon">
                  <WorkspaceIcon name="trendUp" />
                </span>
                <span className="dash-kpi-badge">{t("দর", "Rates")}</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">{t("বাজারদর অনুসন্ধান", "Market prices")}</span>
                <strong className="voice-prompt-sample">
                  {t("“পাবনা মোকামের পাইকারি রেট কত?”", "“Pabna wholesale onion rate”")}
                </strong>
              </div>
            </div>

            <div className="dash-kpi-card glass-1 voice-prompt-chip">
              <div className="dash-kpi-header">
                <span className="dash-kpi-icon">
                  <WorkspaceIcon name="handshake" />
                </span>
                <span className="dash-kpi-badge">{t("বাণিজ্য", "Trade")}</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">{t("অফার প্রেরণ", "Send offer")}</span>
                <strong className="voice-prompt-sample">
                  {t("“২০০ কেজি তাহেরপুরী বিক্রির অফার দিন”", "“Offer 200 kg for sale”")}
                </strong>
              </div>
            </div>

            <div className="dash-kpi-card glass-1 voice-prompt-chip">
              <div className="dash-kpi-header">
                <span className="dash-kpi-icon">
                  <WorkspaceIcon name="search" />
                </span>
                <span className="dash-kpi-badge">{t("মাঠ", "Field")}</span>
              </div>
              <div className="dash-kpi-body">
                <span className="dash-kpi-label">{t("মাঠ পরিদর্শন", "Field inspection")}</span>
                <strong className="voice-prompt-sample">
                  {t("“মাচায় আর্দ্রতা পরিদর্শনের অনুরোধ”", "“Request moisture inspection”")}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. INSPECTION & SUPPORT REQUESTS QUEUE ─── */}
      <section className="work-panel voice-tasks-section">
        <header className="dash-analysis-header">
          <div>
            <div className="dash-quality-eyebrow">
              <span className="dash-pulse-dot" aria-hidden="true" />
              <span>{t("মাঠ কার্যক্রম", "Field Operations")}</span>
            </div>
            <h2 className="dash-analysis-title">
              {t("পরিদর্শন ও সহায়তার অনুরোধ", "Inspection and Support Requests")}
            </h2>
            <p className="voice-tasks-sub">
              {t(
                "কৃষকদের মাচা পরিদর্শন এবং ওজন ও আর্দ্রতা যাচাইয়ের সক্রিয় অনুরোধসমূহ",
                "Active queue of storage inspection, weight verification, and farmer support requests",
              )}
            </p>
          </div>

          {tasks.length > 0 && (
            <span className="trade-status-pill pending">
              <span className="trade-status-dot" aria-hidden="true" />
              <span className="stat-num">{numberLabel(locale, openTasksCount)}</span>{" "}
              {t("চলমান অনুরোধ", "open requests")}
            </span>
          )}
        </header>

        {tasks.length === 0 ? (
          <div className="price-empty-state">
            <span className="price-empty-icon" aria-hidden="true">
              <WorkspaceIcon name="help" size={32} />
            </span>
            <p>{t("ভয়েস কলের মাধ্যমে পরিদর্শন বা সহায়তার অনুরোধ জানানো হলে তা সরাসরি এখানে জমা হবে।", "Any inspection or field assistance requested during simulated voice calls will appear here.")}</p>
          </div>
        ) : (
          <div className="trade-cards-grid">
            {tasks.map((task) => {
              const isOpen = task.status !== "resolved";
              const isInspection = task.kind === "inspection";
              return (
                <article key={task.id} className="trade-order-card voice-task-card">
                  <div className="trade-card-header">
                    <div className="trade-card-id-wrap">
                      <span className="trade-card-hash">#{task.id.slice(0, 8)}</span>
                      <span className="trade-card-variety">
                        {isInspection ? t("মাচা পরিদর্শন", "Storage Inspection") : t("মাঠ সহায়তা", "Field Support")}
                      </span>
                    </div>

                    <span
                      className={`trade-status-pill ${isOpen ? "pending" : "verified"}`}
                    >
                      <span className="trade-status-dot" aria-hidden="true" />
                      <span>{isOpen ? t("খোলা", "Open") : t("সম্পন্ন", "Resolved")}</span>
                    </span>
                  </div>

                  <div className="trade-card-main-title">
                    <p className="voice-task-note">{task.note}</p>
                  </div>

                  <div className="trade-meta-dates">
                    <span className="trade-meta-location">
                      <WorkspaceIcon name="clock" size={13} />
                      {" "}
                      {timeLabel(locale, task.created_at)}
                    </span>
                  </div>

                  <div className="trade-card-divider dashed" />

                  <div className="trade-card-footer">
                    {task.lot_id && (
                      <Link
                        className="trade-card-action-btn primary"
                        href={`${base}/stock/${task.lot_id}/inspections`}
                      >
                        <span>{t("মজুতের পরিদর্শন", "Lot inspections")}</span>
                        <WorkspaceIcon name="arrow" size={14} />
                      </Link>
                    )}

                    {task.can_resolve && (
                      <form
                        action={resolveVoiceTask.bind(null, locale, task.id)}
                        className="voice-task-resolve-form"
                      >
                        <button type="submit" className="trade-card-action-btn secondary">
                          {t("সম্পন্ন চিহ্নিত করুন", "Mark resolved")}
                        </button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
