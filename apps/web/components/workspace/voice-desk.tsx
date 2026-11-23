"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  resolveVoice,
  runVoice,
} from "../../app/[locale]/workspace/pilot-actions";
import type { Locale } from "../../lib/copy";
import type { PriceSeries, VoiceCall } from "../../lib/pilot-types";
import type { Profile } from "../../lib/workspace-api";
import { errorText, local } from "../../lib/workspace-copy";
import type { Lot, Offer, Order, Supply } from "../../lib/workspace-types";
import { dhakaToday, timeLabel } from "../../lib/workspace-values";
import type { Recognition } from "./speech-input";
import { WorkspaceIcon } from "./icon";
import { WorkspaceDropdown } from "./dropdown";

const commands: Record<string, [string, string]> = {
  stock: ["মজুত", "My stock"],
  prices: ["বাজার দর", "Market prices"],
  advice: ["পরামর্শ", "Hold or sell advice"],
  offers: ["অফার", "Offers"],
  orders: ["অর্ডার", "Orders"],
  accept: ["অফার গ্রহণ", "Accept offer"],
  reject: ["অফার প্রত্যাখ্যান", "Reject offer"],
  counter: ["পাল্টা অফার", "Counteroffer"],
  movement: ["ওজন সমন্বয়", "Adjust stock"],
  register: ["মজুত নিবন্ধন", "Register a lot"],
  send_offer: ["অফার পাঠান", "Send offer"],
  transport: ["পরিবহন চাই", "Request transport"],
  inspection: ["পরিদর্শন চাই", "Request inspection"],
  support: ["সহায়তা", "Request agent help"],
};

const statuses: Record<string, [string, string]> = {
  active: ["চলছে", "Active"],
  ended: ["শেষ", "Ended"],
  expired: ["মেয়াদ শেষ", "Expired"],
  answered: ["উত্তর", "Answered"],
  pending: ["নিশ্চিতকরণের অপেক্ষায়", "Awaiting confirmation"],
  committed: ["সম্পন্ন", "Completed"],
  cancelled: ["বাতিল", "Cancelled"],
  failed: ["সম্পন্ন হয়নি", "Failed"],
};

export function VoiceDesk({
  locale,
  base,
  initial,
  actor,
  lots,
  offers,
  orders,
  supply,
  series,
}: {
  locale: Locale;
  base: string;
  initial: VoiceCall;
  actor: Profile;
  lots: Lot[];
  offers: Offer[];
  orders: Order[];
  supply: Supply[];
  series: PriceSeries[];
}) {
  const [state, submit, busy] = useActionState(
    runVoice.bind(null, initial.id),
    { call: initial },
  );
  const call = state.call ?? initial;
  const [tool, setTool] = useState("prices");
  const [phrase, setPhrase] = useState(commands.prices[0]);
  const [seriesKey, setSeriesKey] = useState("");
  const [lotId, setLotId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [eventType, setEventType] = useState("WEIGHED_ADJUSTMENT");
  const [grade, setGrade] = useState("ungraded");
  const [unit, setUnit] = useState<"kg" | "maund">("kg");
  const [transport, setTransport] = useState("buyer");
  const [orderId, setOrderId] = useState("");
  const [digits, setDigits] = useState("");
  const [audio, setAudio] = useState("");
  const [checking, setChecking] = useState(false);
  const [heard, setHeard] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  // A quantity heard in the command, used to fill the matching form field.
  const [spoken, setSpoken] = useState<{
    quantity: string;
    unit: "kg" | "maund";
  } | null>(null);
  const [prefill, setPrefill] = useState(0);
  const [listening, setListening] = useState(false);
  const engine = useRef<Recognition | null>(null);

  useEffect(
    () => () => {
      if (engine.current) {
        engine.current.onend = null;
        engine.current.onresult = null;
        engine.current.onerror = null;
        engine.current.abort();
      }
    },
    [],
  );

  function toggleSpeech() {
    if (!active) return;
    if (engine.current) {
      engine.current.abort();
      engine.current = null;
      setListening(false);
      return;
    }

    const browser = window as Window & {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const BrowserRecognition =
      browser.SpeechRecognition ?? browser.webkitSpeechRecognition;

    if (!BrowserRecognition) {
      speak(phrase);
      setHeard({
        ok: true,
        text: t(
          "আপনার ব্রাউজারে স্পিচ রিকগনিশন সক্রিয় নেই। বক্তব্য শুনুন বা নিচে টেক্সট লিখুন।",
          "Voice input is unavailable in this browser. You can listen or type below.",
        ),
      });
      return;
    }

    try {
      const recognition = new BrowserRecognition();
      recognition.lang = "bn-BD";
      recognition.maxAlternatives = 3;

      recognition.onresult = (event) => {
        const alternatives = Array.from(event.results[0] ?? [])
          .map((item) => item.transcript.trim().slice(0, 100))
          .filter(Boolean)
          .slice(0, 3);
        if (alternatives.length) {
          understand(alternatives);
        }
      };

      recognition.onerror = (event) => {
        setListening(false);
        engine.current = null;
        if (event.error !== "aborted") {
          setHeard({
            ok: false,
            text: t(
              "বাংলা বক্তব্য স্পষ্ট বোঝা যায়নি। আবার বলুন বা শুনুন।",
              "Speech could not be understood. Try speaking again or listen.",
            ),
          });
        }
      };

      recognition.onend = () => {
        engine.current = null;
        setListening(false);
      };

      recognition.start();
      engine.current = recognition;
      setListening(true);
    } catch {
      setListening(false);
      engine.current = null;
      speak(phrase);
    }
  }
  const pending = call.entries.find((entry) => entry.state === "pending");
  // Demo accounts type the displayed 4-digit code; real accounts their PIN.
  const pinLength = actor.is_demo ? 4 : 6;
  const active = call.status === "active";
  const buyer = actor.role === "buyer";
  const farmer = actor.role === "farmer";
  const agent = actor.role === "agent";
  const choice = [
    "prices",
    ...(!buyer ? ["stock", "advice"] : []),
    ...(!agent ? ["offers", "orders"] : []),
    ...(farmer || buyer ? ["accept", "reject", "counter", "transport"] : []),
    ...(farmer || agent ? ["movement", "inspection"] : []),
    ...(farmer ? ["register"] : []),
    ...(buyer ? ["send_offer"] : []),
    "support",
  ];
  const t = (bn: string, en: string) => local(locale, bn, en);
  const option = (key: string) => local(locale, ...commands[key]);
  const status = (key: string) =>
    local(locale, ...(statuses[key] ?? [key, key]));
  const unitLabel = (unit: "kg" | "maund") =>
    unit === "maund" ? t("মণ", "maund") : t("কেজি", "kg");
  async function understand(alternatives: string[]) {
    const first = alternatives[0]?.trim();
    if (!first) return;
    setPhrase(first);
    setHeard(null);
    setChecking(true);
    const response = await resolveVoice(alternatives);
    setChecking(false);
    if (!response.results) {
      setHeard({
        ok: false,
        text: errorText(locale, response.error ?? "voice_repeat"),
      });
      return;
    }
    const usable = response.results.find(
      (item) =>
        item.status === "resolved" && item.tool && choice.includes(item.tool),
    );
    const best = usable ?? response.results[0];
    setPhrase(best.phrase);
    if (usable?.tool) {
      const amount =
        usable.quantity && usable.unit
          ? { quantity: usable.quantity, unit: usable.unit }
          : null;
      setTool(usable.tool);
      if (amount?.unit) {
        setUnit(amount.unit);
      }
      setSpoken(amount);
      setEventType(usable.loss ? "LOSS_REPORTED" : "WEIGHED_ADJUSTMENT");
      setPrefill((count) => count + 1);
      setHeard({
        ok: true,
        text: `${t("বোঝা গেছে", "Understood")}: ${option(usable.tool)}${
          amount ? ` · ${amount.quantity} ${unitLabel(amount.unit)}` : ""
        }. ${t("পাঠানোর আগে ফর্ম যাচাই করুন।", "Check the form before sending.")}`,
      });
    } else if (best.status === "resolved") {
      setHeard({
        ok: false,
        text: t(
          "এই কাজটি আপনার অ্যাকাউন্টের জন্য নয়।",
          "That command is not available for your account.",
        ),
      });
    } else {
      setHeard({
        ok: false,
        text: errorText(locale, best.error ?? "voice_repeat"),
      });
    }
  }
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  };
  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      setAudio(
        t(
          "বাংলা কণ্ঠ পাওয়া যাচ্ছে না।",
          "Bangla playback is unavailable on this device.",
        ),
      );
      return;
    }
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => /^bn(?:-|$)/i.test(item.lang));
    if (!voice) {
      setAudio(
        t(
          "বাংলা কণ্ঠ পাওয়া যাচ্ছে না।",
          "Bangla playback is unavailable on this device.",
        ),
      );
      return;
    }
    setAudio("");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "bn-BD";
    utterance.voice = voice;
    utterance.onerror = () =>
      setAudio(t("কণ্ঠ চালানো যায়নি।", "Playback could not start."));
    window.speechSynthesis.speak(utterance);
  }
  const offerAction = ["accept", "reject", "counter"].includes(tool);
  const terms = (
    <>
      <label>
        {t("পরিমাণ (কেজি)", "Quantity (kg)")}
        <input
          key={`kg-${prefill}`}
          name="quantity_kg"
          inputMode="decimal"
          defaultValue={spoken?.unit === "kg" ? spoken.quantity : undefined}
          required
        />
      </label>
      <label>
        {t("দর (৳/কেজি)", "Price (BDT/kg)")}
        <input name="price_bdt_kg" inputMode="decimal" required />
      </label>
    </>
  );
  const quantity = (
    <>
      <label>
        {t("পরিমাণ", "Quantity")}
        <input
          key={`quantity-${prefill}`}
          name="quantity"
          inputMode="decimal"
          defaultValue={spoken?.quantity}
          required
        />
      </label>
      <div className="work-field-col">
        <label htmlFor="voice-unit-select" className="work-field-label">
          {t("একক", "Unit")}
        </label>
        <WorkspaceDropdown
          id="voice-unit-select"
          name="unit"
          value={unit}
          onChange={(val) => setUnit(val as "kg" | "maund")}
          options={[
            { value: "kg", label: t("কেজি", "kg") },
            { value: "maund", label: t("মণ", "maund") },
          ]}
        />
      </div>
      <label>
        {t("মণ হলে প্রতি মণে কেজি", "If using maunds, kg per maund")}
        <input name="kg_per_maund" inputMode="decimal" />
      </label>
    </>
  );
  return (
    <>
      {/* ─── 1. SIMULATED VOICE CALL STAGE (Waveform & Interactive Calling Dock) ─── */}
      <section className="work-panel voice-call-hero-stage glass-1">
        <div className="voice-call-hero-ambient" aria-hidden="true" />

        {/* Top Status Bar */}
        <div className="voice-call-status-bar">
          <div className="voice-call-status-pill">
            <span
              className={`trade-status-pill ${active ? "verified" : "expired"}`}
            >
              <span className="trade-status-dot" aria-hidden="true" />
              <span>
                {active
                  ? t("সিমুলেটেড কল চলছে", "Simulated Call Active")
                  : t("কল সমাপ্ত", "Call Ended")}
              </span>
            </span>
            <span className="trade-card-hash">{status(call.status)}</span>
          </div>

          <div className="voice-call-timer">
            <span className="voice-timer-icon" aria-hidden="true">
              <WorkspaceIcon name="clock" size={14} />
            </span>
            <span>
              {t("মেয়াদ", "Expires")}: {timeLabel(locale, call.expires_at)}
            </span>
          </div>
        </div>

        {/* Dynamic Voice Waveform Visualizer (from user design) */}
        <div className="voice-visualizer-container" aria-hidden="true">
          <div
            className={`voice-waveform-wrap ${active ? "is-active" : "is-ended"} ${listening ? "is-listening" : ""}`}
          >
            {Array.from({ length: 32 }).map((_, idx) => (
              <span
                key={idx}
                className="voice-wave-bar"
                style={{
                  animationDelay: `${(idx % 10) * 0.1}s`,
                  height: active
                    ? `${Math.sin(idx * 0.42) * (listening ? 26 : 20) + (listening ? 34 : 26)}px`
                    : "6px",
                  opacity: active ? undefined : 0.3,
                }}
              />
            ))}
          </div>
        </div>

        {/* Glowing Circular Microphone Button with Ripples (Works as Speak Bangla button) */}
        <div className="voice-hero-action-dock">
          <div className="voice-call-trigger-form">
            <button
              type="button"
              className={`voice-mic-main-btn ${listening ? "is-listening" : active ? "is-calling" : "is-ended"}`}
              title={
                listening
                  ? t("শোনা বন্ধ করুন", "Stop listening")
                  : active
                    ? t("বাংলায় বলুন (ট্যাপ করুন)", "Speak Bangla (Tap to speak)")
                    : t("কল শেষ হয়েছে", "Call ended")
              }
              aria-label={
                listening
                  ? t("শোনা বন্ধ করুন", "Stop listening")
                  : active
                    ? t("বাংলায় বলুন (ট্যাপ করুন)", "Speak Bangla (Tap to speak)")
                    : t("কল শেষ হয়েছে", "Call ended")
              }
              disabled={!active}
              onClick={toggleSpeech}
            >
              {active && (
                <>
                  <span
                    className={`voice-mic-ripple voice-ripple-1 ${listening ? "is-active-listening" : ""}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`voice-mic-ripple voice-ripple-2 ${listening ? "is-active-listening" : ""}`}
                    aria-hidden="true"
                  />
                  {listening && (
                    <span
                      className="voice-mic-ripple voice-ripple-3 is-active-listening"
                      aria-hidden="true"
                    />
                  )}
                </>
              )}
              <span className="voice-mic-icon-pod" aria-hidden="true">
                <WorkspaceIcon name="mic" size={36} />
              </span>
            </button>

            <div className="voice-dock-copy">
              <strong className="voice-dock-main-label">
                {listening
                  ? t("শুনছি... বাংলায় বলুন", "Listening... Speak in Bangla")
                  : active
                    ? t("বাংলায় কথা বলুন", "Speak in Bangla")
                    : t("কল সমাপ্ত হয়েছে", "Simulated Voice Call Ended")}
              </strong>
              <span className="voice-dock-sub-label">
                {listening
                  ? t(
                      "আপনার কথা সরাসরি টেক্সটে রূপান্তরিত হচ্ছে...",
                      "Transcribing your voice in real-time...",
                    )
                  : active
                    ? t(
                        "মাইক্রোফোন চেপে পেঁয়াজের দর বা মজুত সম্পর্কে বলুন · নিচে শুনুন ও টেক্সট দেখুন",
                        "Tap microphone to speak · Listen & verify command text below",
                      )
                    : t(
                        "এই কলটির মেয়াদ শেষ বা সমাপ্ত করা হয়েছে।",
                        "This call has been completed or expired.",
                      )}
              </span>
            </div>

            {/* Modern Transcript Presentation Card (matches sample media_1795132314672_e5e11267) */}
            <div className="voice-transcript-card">
              <div className="voice-transcript-topbar">
                <div className="voice-transcript-label-group">
                  <span className="voice-transcript-tag-label">
                    {t("Text :", "Text :")}
                  </span>
                </div>

                <div className="voice-transcript-actions">
                  {listening && (
                    <span className="voice-transcript-live-pill">
                      <span className="voice-pulse-dot" aria-hidden="true" />
                      <span>{t("মাইক্রোফোন চালু", "Mic Active")}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    className="voice-transcript-audio-btn"
                    onClick={() => speak(phrase)}
                    title={t("বাংলায় শুনুন", "Listen audio in Bangla")}
                  >
                    <WorkspaceIcon name="volume" size={16} />
                    <span>{t("শুনুন", "Listen")}</span>
                  </button>
                </div>
              </div>

              <blockquote className="voice-transcript-body">
                &ldquo;{phrase}&rdquo;
              </blockquote>

              {heard && (
                <div
                  className={`voice-transcript-feedback ${heard.ok ? "is-ok" : "is-error"}`}
                >
                  <span
                    className="voice-transcript-feedback-icon"
                    aria-hidden="true"
                  >
                    <WorkspaceIcon
                      name={heard.ok ? "check" : "info"}
                      size={16}
                    />
                  </span>
                  <span>{heard.text}</span>
                </div>
              )}
            </div>

            {/* Call Controls: End Call or Return to Desk */}
            <div className="voice-call-controls-row">
              {active ? (
                <form
                  action={submit}
                  onSubmit={send}
                  className="voice-end-call-form"
                >
                  <input name="mode" type="hidden" value="end" />
                  <button
                    className="voice-call-end-btn"
                    type="submit"
                    disabled={busy}
                    title={t("কল শেষ করুন", "End call")}
                  >
                    <span className="voice-end-call-icon" aria-hidden="true">
                      <WorkspaceIcon name="phoneOff" size={18} />
                    </span>
                    <span>{t("কল শেষ করুন", "End call")}</span>
                  </button>
                </form>
              ) : (
                <Link
                  className="voice-call-restart-btn"
                  href={
                    base.includes("call-simulator")
                      ? base
                      : `/${locale}/call-simulator`
                  }
                >
                  <span className="voice-restart-icon" aria-hidden="true">
                    <WorkspaceIcon name="voice" size={18} />
                  </span>
                  <span>
                    {t("সহকারী ডেস্কে ফিরুন", "Back to Voice Assistant")}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {state.error && (
          <p role="alert" className="form-error voice-stage-alert">
            {errorText(locale, state.error)}
          </p>
        )}
        {audio && (
          <p role="status" className="voice-stage-audio-note">
            {audio}
          </p>
        )}
      </section>
      {active && !pending && (
        <section className="work-panel">
          <div className="dash-quality-eyebrow" style={{ marginBottom: "8px" }}>
            <span className="dash-pulse-dot" aria-hidden="true" />
            <span>
              {t("কণ্ঠস্বর ও কমান্ড কিপ্যাড", "Voice & Command Interface")}
            </span>
          </div>
          <h2 className="dash-analysis-title" style={{ marginBottom: "18px" }}>
            {t("কথা লিখুন বা নির্বাচন করুন", "Enter or Select a Command")}
          </h2>
          <form action={submit} onSubmit={send} className="work-form">
            <input name="mode" type="hidden" value="intent" />
            <div className="work-grid">
              <div className="work-field-col">
                <label
                  htmlFor="voice-command-select"
                  className="work-field-label"
                >
                  {t("কাজ", "Command")}
                </label>
                <WorkspaceDropdown
                  id="voice-command-select"
                  name="tool"
                  value={tool}
                  onChange={(val) => {
                    setTool(val);
                    setPhrase(commands[val][0]);
                    setSpoken(null);
                    setHeard(null);
                  }}
                  options={choice.map((key) => ({
                    value: key,
                    label: option(key),
                  }))}
                />
              </div>
              <label>
                {t("বাংলা বক্তব্য", "Typed Bangla utterance")}
                <input
                  name="phrase"
                  maxLength={100}
                  value={phrase}
                  onChange={(event) => {
                    setPhrase(event.target.value);
                    setHeard(null);
                  }}
                  required
                />
              </label>
              {[
                "stock",
                "advice",
                "movement",
                "inspection",
                "support",
              ].includes(tool) &&
                !buyer && (
                  <div className="work-field-col">
                    <label
                      htmlFor="voice-lot-select"
                      className="work-field-label"
                    >
                      {t("মজুত", "Lot")}
                    </label>
                    <WorkspaceDropdown
                      id="voice-lot-select"
                      name="lot_id"
                      value={lotId}
                      onChange={setLotId}
                      placeholder={t("বেছে নিন", "Select a lot")}
                      required={["advice", "movement", "inspection"].includes(
                        tool,
                      )}
                      options={[
                        { value: "", label: t("বেছে নিন", "Select a lot") },
                        ...lots.map((row) => ({
                          value: row.id,
                          label: row.label,
                        })),
                      ]}
                    />
                  </div>
                )}
              {["prices", "advice"].includes(tool) && (
                <div className="work-field-col">
                  <label
                    htmlFor="voice-series-select"
                    className="work-field-label"
                  >
                    {t("দরের ধারা", "Market series")}
                  </label>
                  <WorkspaceDropdown
                    id="voice-series-select"
                    name="series"
                    value={seriesKey}
                    onChange={setSeriesKey}
                    placeholder={t("বেছে নিন", "Select a series")}
                    options={[
                      { value: "", label: t("বেছে নিন", "Select a series") },
                      ...series.map((row) => ({
                        value: row.series,
                        label: `${row.market} · ${row.price_type}${row.synthetic ? t(" · কাল্পনিক", " · Synthetic") : ""}`,
                      })),
                    ]}
                  />
                </div>
              )}
              {offerAction && (
                <div className="work-field-col">
                  <label
                    htmlFor="voice-offer-select"
                    className="work-field-label"
                  >
                    {t("অফার", "Offer")}
                  </label>
                  <WorkspaceDropdown
                    id="voice-offer-select"
                    name="offer"
                    value={offerId}
                    onChange={setOfferId}
                    placeholder={t("বেছে নিন", "Select an offer")}
                    required
                    options={[
                      { value: "", label: t("বেছে নিন", "Select an offer") },
                      ...offers
                        .filter(
                          (row) =>
                            row.proposer_id !== actor.membership_id &&
                            ["sent", "countered"].includes(row.status),
                        )
                        .map((row) => ({
                          value: `${row.id}/${row.lot_id}/${row.version}`,
                          label: `${row.lot_label} · ${row.buyer_name} · ${row.quantity_kg} kg`,
                        })),
                    ]}
                  />
                </div>
              )}
              {tool === "counter" && terms}
              {tool === "movement" && (
                <>
                  <div className="work-field-col">
                    <label
                      htmlFor="voice-movement-type-select"
                      className="work-field-label"
                    >
                      {t("পরিবর্তনের ধরন", "Movement type")}
                    </label>
                    <WorkspaceDropdown
                      id="voice-movement-type-select"
                      name="event_type"
                      value={eventType}
                      onChange={setEventType}
                      options={[
                        {
                          value: "WEIGHED_ADJUSTMENT",
                          label: t(
                            "ওজন সমন্বয় (+/−)",
                            "Weight adjustment (+/−)",
                          ),
                        },
                        {
                          value: "LOSS_REPORTED",
                          label: t("ক্ষতি (যতটা কমেছে)", "Loss (amount lost)"),
                        },
                      ]}
                    />
                  </div>
                  {quantity}
                  <label>
                    {t("কারণ", "Reason")}
                    <input name="reason" maxLength={200} required />
                  </label>
                </>
              )}
              {tool === "register" && (
                <>
                  <label>
                    {t("মজুতের নাম", "Lot name")}
                    <input name="label" maxLength={100} required />
                  </label>
                  <label>
                    {t("জেলা", "District")}
                    <input
                      name="district"
                      maxLength={100}
                      defaultValue={actor.district}
                      required
                    />
                  </label>
                  <label>
                    {t("জাত", "Variety")}
                    <input name="variety" maxLength={100} required />
                  </label>
                  <label>
                    {t("সংরক্ষণের ধরন", "Storage type")}
                    <input name="storage_type" maxLength={100} required />
                  </label>
                  <label>
                    {t("ফসল তোলার দিন", "Harvest date")}
                    <input
                      type="date"
                      name="harvest_on"
                      defaultValue={dhakaToday()}
                      required
                    />
                  </label>
                  <label>
                    {t("সংরক্ষণ শুরুর দিন", "Storage date")}
                    <input
                      type="date"
                      name="stored_on"
                      defaultValue={dhakaToday()}
                      required
                    />
                  </label>
                  <div className="work-field-col">
                    <label
                      htmlFor="voice-grade-select"
                      className="work-field-label"
                    >
                      {t("গ্রেড", "Grade")}
                    </label>
                    <WorkspaceDropdown
                      id="voice-grade-select"
                      name="grade"
                      value={grade}
                      onChange={setGrade}
                      options={[
                        { value: "ungraded", label: t("গ্রেড নেই", "Ungraded") },
                        { value: "A", label: "A" },
                        { value: "B", label: "B" },
                        { value: "C", label: "C" },
                      ]}
                    />
                  </div>
                  {quantity}
                  <label className="checkbox">
                    <input name="listed" type="checkbox" />
                    {t("ক্রেতাদের জন্য তালিকাভুক্ত", "List for buyers")}
                  </label>
                </>
              )}
              {tool === "send_offer" && (
                <>
                  <div className="work-field-col">
                    <label
                      htmlFor="voice-supply-lot-select"
                      className="work-field-label"
                    >
                      {t("তালিকাভুক্ত মজুত", "Listed lot")}
                    </label>
                    <WorkspaceDropdown
                      id="voice-supply-lot-select"
                      name="lot_id"
                      value={lotId}
                      onChange={setLotId}
                      placeholder={t("বেছে নিন", "Select a lot")}
                      required
                      options={[
                        { value: "", label: t("বেছে নিন", "Select a lot") },
                        ...supply.map((row) => ({
                          value: row.id,
                          label: `${row.variety} · ${row.district} · ${row.sellable_kg} kg`,
                        })),
                      ]}
                    />
                  </div>
                  {terms}
                  <label>
                    {t("গন্তব্য জেলা", "Delivery district")}
                    <input
                      name="delivery_district"
                      maxLength={100}
                      defaultValue={actor.district}
                      required
                    />
                  </label>
                  <div className="work-field-col">
                    <label
                      htmlFor="voice-transport-select"
                      className="work-field-label"
                    >
                      {t("পরিবহনের দায়িত্ব", "Transport responsibility")}
                    </label>
                    <WorkspaceDropdown
                      id="voice-transport-select"
                      name="transport"
                      value={transport}
                      onChange={setTransport}
                      options={[
                        { value: "buyer", label: t("ক্রেতা", "Buyer") },
                        { value: "seller", label: t("বিক্রেতা", "Seller") },
                      ]}
                    />
                  </div>
                </>
              )}
              {tool === "transport" && (
                <>
                  <div className="work-field-col">
                    <label
                      htmlFor="voice-order-select"
                      className="work-field-label"
                    >
                      {t("অর্ডার", "Order")}
                    </label>
                    <WorkspaceDropdown
                      id="voice-order-select"
                      name="order_id"
                      value={orderId}
                      onChange={setOrderId}
                      placeholder={t("বেছে নিন", "Select an order")}
                      required
                      options={[
                        { value: "", label: t("বেছে নিন", "Select an order") },
                        ...orders
                          .filter(
                            (row) =>
                              row.status === "confirmed" &&
                              row.offer.transport ===
                                (buyer ? "buyer" : "seller"),
                          )
                          .map((row) => ({
                            value: row.id,
                            label: `${row.offer.lot_label} · ${row.offer.quantity_kg} kg`,
                          })),
                      ]}
                    />
                  </div>
                  <label>
                    {t("সংগ্রহের দিন", "Pickup date")}
                    <input
                      name="pickup_on"
                      type="date"
                      min={dhakaToday()}
                      defaultValue={dhakaToday()}
                      required
                    />
                  </label>
                  <label>
                    {t("নির্দেশনা", "Handling instructions")}
                    <input name="handling" maxLength={100} required />
                  </label>
                </>
              )}
              {["inspection", "support"].includes(tool) && (
                <label>
                  {t("অনুরোধের বিবরণ", "Request note")}
                  <input name="note" maxLength={200} required />
                </label>
              )}
            </div>
            {heard && (
              <p
                role={heard.ok ? "status" : "alert"}
                className={heard.ok ? undefined : "form-error"}
              >
                {heard.text}
              </p>
            )}
            <div className="work-row voice-command-actions-row">
              <button
                className="voice-command-check-btn pilot-secondary"
                type="button"
                disabled={busy || checking || !phrase.trim()}
                onClick={() => understand([phrase])}
              >
                <span className="voice-btn-icon" aria-hidden="true">
                  <WorkspaceIcon name="search" size={16} />
                </span>
                <span>
                  {checking
                    ? t("যাচাই হচ্ছে…", "Checking…")
                    : t("কাজটি যাচাই করুন", "Check command")}
                </span>
              </button>
              <button
                className="voice-command-send-btn refresh"
                disabled={busy}
                type="submit"
              >
                <span className="voice-btn-icon" aria-hidden="true">
                  <WorkspaceIcon name="arrow" size={16} />
                </span>
                <span>
                  {busy
                    ? t("অপেক্ষা করুন…", "Please wait…")
                    : t("বক্তব্য পাঠান", "Send utterance")}
                </span>
              </button>
            </div>
          </form>
        </section>
      )}
      {active && pending && (
        <section className="work-panel">
          <div className="dash-quality-eyebrow" style={{ marginBottom: "8px" }}>
            <span className="dash-pulse-dot" aria-hidden="true" />
            <span>{t("দ্বিমুখী নিশ্চিতকরণ", "Dual Confirmation")}</span>
          </div>
          <h2 className="dash-analysis-title" style={{ marginBottom: "18px" }}>
            {t("শর্ত শুনে নিশ্চিত করুন", "Confirm the read-back")}
          </h2>
          <p lang="bn">{pending.readback_bn}</p>
          <button
            className="pilot-secondary"
            type="button"
            onClick={() => speak(pending.readback_bn)}
          >
            {t("বাংলায় শুনুন", "Play Bangla read-back")}
          </button>
          {!actor.is_demo || (state.code && state.pendingId === pending.id) ? (
            <form action={submit} onSubmit={send} className="work-form">
              <input type="hidden" name="mode" value="confirm" />
              <input type="hidden" name="action_id" value={pending.id} />
              {actor.is_demo && (
                <p>
                  {t("ডেমো কোড", "Demo keypad code")}{" "}
                  <strong>{state.code}</strong>
                </p>
              )}
              <label>
                {actor.is_demo
                  ? t("চার অঙ্কের নিশ্চিতকরণ", "Four-digit confirmation")
                  : t("আপনার ভয়েস পিন", "Your voice PIN")}
                <input
                  name="digits"
                  type={actor.is_demo ? "text" : "password"}
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={pinLength}
                  value={digits}
                  onChange={(event) => setDigits(event.target.value)}
                  required
                />
              </label>
              <div className="pilot-keypad">
                {Array.from({ length: 10 }, (_, n) => n).map((n) => (
                  <button
                    className="pilot-secondary"
                    type="button"
                    key={n}
                    onClick={() =>
                      setDigits((value) => `${value}${n}`.slice(0, pinLength))
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="work-row">
                <button
                  className="pilot-secondary"
                  type="button"
                  onClick={() => setDigits("")}
                >
                  {t("মুছুন", "Clear")}
                </button>
                <button
                  className="refresh"
                  type="submit"
                  disabled={
                    busy || digits.length < 4 || digits.length > pinLength
                  }
                >
                  {t("কিপ্যাডে নিশ্চিত করুন", "Confirm by keypad")}
                </button>
              </div>
            </form>
          ) : (
            <p>
              {t(
                "কোডটি একবারই দেখানো হয়। কাজটি বাতিল করে আবার পাঠান।",
                "The code is shown only once. Cancel this action and send the command again.",
              )}
            </p>
          )}
          <form action={submit} onSubmit={send} className="work-form">
            <input type="hidden" name="mode" value="cancel" />
            <input type="hidden" name="action_id" value={pending.id} />
            <button className="pilot-secondary" type="submit" disabled={busy}>
              {t("এই কাজটি বাতিল করুন", "Cancel this action")}
            </button>
          </form>
        </section>
      )}
      <section className="work-panel">
        <div className="dash-quality-eyebrow" style={{ marginBottom: "8px" }}>
          <span className="dash-pulse-dot" aria-hidden="true" />
          <span>{t("কলের ইতিহাস", "Call History")}</span>
        </div>
        <h2 className="dash-analysis-title" style={{ marginBottom: "18px" }}>
          {t("কলের কথোপকথন", "Call transcript")}
        </h2>
        {!call.entries.length && (
          <p>{t("এখনও কোনো বক্তব্য নেই।", "No turns yet.")}</p>
        )}
        <ul className="work-history">
          {call.entries.map((entry) => (
            <li key={entry.id}>
              <strong>
                {commands[entry.tool] ? option(entry.tool) : entry.tool} ·{" "}
                {status(entry.state)}
              </strong>
              <span lang="bn">{entry.readback_bn}</span>
              {entry.result?.error && (
                <span className="form-error">
                  {errorText(locale, entry.result.error)}
                </span>
              )}
              {entry.result?.order_id && (
                <Link
                  className="work-link"
                  href={`${base}/orders/${entry.result.order_id}`}
                >
                  {t("অর্ডার দেখুন", "View order")}
                </Link>
              )}
              <button
                type="button"
                className="pilot-secondary"
                onClick={() => speak(entry.readback_bn)}
              >
                {t("বাংলায় শুনুন", "Play Bangla read-back")}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
