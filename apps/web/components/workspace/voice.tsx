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
      <section className="voice-hero-card glass-1">
        {/* Ambient Top Glow */}
        <div className="voice-hero-ambient" aria-hidden="true" />

        {/* Top Meta Strip */}
        <div className="voice-hero-header">
          <div className="voice-live-badge">
            <span className="voice-live-dot" aria-hidden="true" />
            <span>{t("লাইভ ভয়েস সহকারী", "Live Voice Assistant")}</span>
          </div>
          <div className="voice-engine-badge">
            <span className="voice-engine-icon" aria-hidden="true">
              🗣️
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
                🇧🇩 {t("বাংলা (পাবনা উপভাষা সমর্থিত)", "Bangla (Pabna dialect)")}
              </span>
              <span className="voice-bubble-user-tag">
                {actor.name} · {local(locale, ...roles[actor.role])}
              </span>
            </div>
            <p className="voice-bubble-text">
              {t(
                "“আমার মাচায় তাহেরপুরী পেঁয়াজের বর্তমান মজুত ও কাওরান বাজারের দর কত?”",
                "“What is my current Taherpuri stock balance and Karwan Bazar wholesale price?”",
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
                🧅 {t("PeyajFlow ভয়েস সহকারী", "PeyajFlow Voice AI")}
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

        {/* Dynamic Voice Waveform Visualizer */}
        <div className="voice-visualizer-container" aria-hidden="true">
          <div className="voice-waveform-wrap">
            {Array.from({ length: 32 }).map((_, idx) => (
              <span
                key={idx}
                className="voice-wave-bar"
                style={{
                  animationDelay: `${(idx % 10) * 0.12}s`,
                  height: `${Math.sin(idx * 0.42) * 22 + 28}px`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Hero Call Action Dock */}
        <div className="voice-hero-action-dock">
          <form
            action={startSimulatedCall.bind(null, locale)}
            className="voice-call-trigger-form"
          >
            <button
              type="submit"
              className="voice-mic-main-btn"
              title={t("সিমুলেটেড কল শুরু করুন", "Start simulated call")}
              aria-label={t("সিমুলেটেড কল শুরু করুন", "Start simulated call")}
            >
              <span className="voice-mic-ripple voice-ripple-1" aria-hidden="true" />
              <span className="voice-mic-ripple voice-ripple-2" aria-hidden="true" />
              <span className="voice-mic-icon-pod" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="36"
                  height="36"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon
                    points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                    fill="rgba(255,255,255,0.2)"
                  />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </span>
            </button>

            <div className="voice-dock-copy">
              <strong className="voice-dock-main-label">
                {t("সিমুলেটেড কল শুরু করুন", "Start Simulated Voice Call")}
              </strong>
              <span className="voice-dock-sub-label">
                {t(
                  "ট্যাপ করে সরাসরি কথা বলুন · কিপ্যাড ও ভয়েস স্বীকৃতি প্রস্তুত",
                  "Tap to speak · Automatic keypad & speech recognition ready",
                )}
              </span>
            </div>
          </form>
        </div>

        {/* Quick Voice Prompt Shortcuts */}
        <div className="voice-prompts-tray">
          <div className="voice-prompts-label">
            {t("সমর্থিত কণ্ঠস্বর নির্দেশনাসমূহ:", "Common voice commands you can speak:")}
          </div>
          <div className="voice-prompts-grid">
            <div className="voice-prompt-chip">
              <span className="voice-prompt-emoji">📦</span>
              <div className="voice-prompt-text">
                <strong>{t("মজুত পরীক্ষা", "Check stock")}</strong>
                <small>{t("“আমার মাচায় পেঁয়াজ কত আছে?”", "“How much onion in my shed?”")}</small>
              </div>
            </div>

            <div className="voice-prompt-chip">
              <span className="voice-prompt-emoji">📈</span>
              <div className="voice-prompt-text">
                <strong>{t("বাজারদর অনুসন্ধান", "Market prices")}</strong>
                <small>{t("“পাবনা মোকামের পাইকারি রেট কত?”", "“Pabna wholesale onion rate”")}</small>
              </div>
            </div>

            <div className="voice-prompt-chip">
              <span className="voice-prompt-emoji">🤝</span>
              <div className="voice-prompt-text">
                <strong>{t("অফার প্রেরণ", "Send offer")}</strong>
                <small>{t("“২০০ কেজি তাহেরপুরী বিক্রির অফার দিন”", "“Offer 200 kg for sale”")}</small>
              </div>
            </div>

            <div className="voice-prompt-chip">
              <span className="voice-prompt-emoji">🔍</span>
              <div className="voice-prompt-text">
                <strong>{t("মাঠ পরিদর্শন", "Field inspection")}</strong>
                <small>{t("“মাচায় আর্দ্রতা পরিদর্শনের অনুরোধ”", "“Request moisture inspection”")}</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. INSPECTION & SUPPORT REQUESTS QUEUE ─── */}
      <section className="voice-tasks-section">
        <header className="voice-tasks-header">
          <div>
            <div className="voice-tasks-eyebrow">
              <span className="dash-pulse-dot" aria-hidden="true" />
              <span>{t("মাঠ কার্যক্রম", "Field Operations")}</span>
            </div>
            <h2 className="voice-tasks-title">
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
            <span className="voice-tasks-count-pill">
              <span className="voice-count-num stat-num">
                {numberLabel(locale, openTasksCount)}
              </span>{" "}
              {t("চলমান অনুরোধ", "open requests")}
            </span>
          )}
        </header>

        {tasks.length === 0 ? (
          <div className="voice-empty-box glass-1">
            <div className="voice-empty-icon" aria-hidden="true">
              <WorkspaceIcon name="help" />
            </div>
            <h3 className="voice-empty-title">
              {t("এখনও কোনো অনুরোধ নেই", "No requests yet")}
            </h3>
            <p className="voice-empty-sub">
              {t(
                "ভয়েস কলের মাধ্যমে পরিদর্শন বা সহায়তার অনুরোধ জানানো হলে তা সরাসরি এখানে জমা হবে।",
                "Any inspection or field assistance requested during simulated voice calls will appear here.",
              )}
            </p>
          </div>
        ) : (
          <div className="voice-tasks-grid">
            {tasks.map((task) => {
              const isOpen = task.status !== "resolved";
              const isInspection = task.kind === "inspection";
              return (
                <article key={task.id} className="voice-task-card glass-1">
                  <div className="voice-task-card-top">
                    <span
                      className={`voice-kind-badge ${isInspection ? "inspection" : "support"}`}
                    >
                      <span className="voice-kind-icon" aria-hidden="true">
                        {isInspection ? "🔍" : "🤝"}
                      </span>
                      <span>
                        {isInspection
                          ? t("পরিদর্শন", "Inspection")
                          : t("সহায়তা", "Support")}
                      </span>
                    </span>

                    <span
                      className={`voice-task-status-pill ${isOpen ? "open" : "resolved"}`}
                    >
                      <span className="voice-status-dot" aria-hidden="true" />
                      <span>{isOpen ? t("খোলা", "Open") : t("সম্পন্ন", "Resolved")}</span>
                    </span>
                  </div>

                  <p className="voice-task-note">{task.note}</p>

                  <div className="voice-task-timestamp">
                    <span>🕒 {timeLabel(locale, task.created_at)}</span>
                  </div>

                  <div className="voice-task-actions">
                    {task.lot_id && (
                      <Link
                        className="voice-task-action-btn"
                        href={`${base}/stock/${task.lot_id}/inspections`}
                      >
                        <span>{t("মজুতের পরিদর্শন", "Lot inspections")}</span>
                        <span className="voice-action-arrow" aria-hidden="true">
                          <WorkspaceIcon name="arrow" />
                        </span>
                      </Link>
                    )}

                    {task.can_resolve && (
                      <form
                        action={resolveVoiceTask.bind(null, locale, task.id)}
                        className="voice-task-resolve-form"
                      >
                        <button type="submit" className="voice-task-resolve-btn">
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
