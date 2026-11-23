"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import type { Locale } from "../../lib/copy";
import { local } from "../../lib/workspace-copy";
import { WorkspaceIcon } from "./icon";
import { useRouter } from "next/navigation";
import { simWorkspaceCallStart } from "../../app/[locale]/workspace/simulator-actions";
import { errorText } from "../../lib/workspace-copy";

interface DialKey {
  digit: string;
  sub?: string;
}

const subscribeToHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverHydratedSnapshot = () => false;

const dialKeys: DialKey[] = [
  { digit: "1" },
  { digit: "2", sub: "ABC" },
  { digit: "3", sub: "DEF" },
  { digit: "4", sub: "GHI" },
  { digit: "5", sub: "JKL" },
  { digit: "6", sub: "MNO" },
  { digit: "7", sub: "PQRS" },
  { digit: "8", sub: "TUV" },
  { digit: "9", sub: "WXYZ" },
  { digit: "*" },
  { digit: "0", sub: "+" },
  { digit: "#" },
];

export function PhoneDialer({
  locale,
  initialNumber = "7392",
  initialTime = "",
}: {
  locale: Locale;
  initialNumber?: string;
  initialTime?: string;
}) {
  const [number, setNumber] = useState(initialNumber);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    hydratedSnapshot,
    serverHydratedSnapshot,
  );
  const [clock, setClock] = useState(initialTime);
  useEffect(() => {
    const clockTimer = setInterval(
      () =>
        setClock(
          new Date().toLocaleTimeString(locale === "bn" ? "bn-BD" : "en-US", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Dhaka",
          }),
        ),
      30_000,
    );
    return () => clearInterval(clockTimer);
  }, [locale]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const router = useRouter();
  const [connectionError, setConnectionError] = useState("");

  // In-place calling interface state
  const [callState, setCallState] = useState<
    "idle" | "ringing" | "connected" | "ended"
  >("idle");
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);

  const endTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const t = (bn: string, en: string) => local(locale, bn, en);

  const quickNumbers = [
    {
      id: "ai",
      label: t("পেঁয়াজফ্লো সিমুলেটর", "PeyajFlow simulator"),
      number: "7392",
      icon: "bot",
    },
  ];

  // Format phone number with aesthetic grouping (e.g. 12 34 5678 or 01711 234567)
  const formatDisplay = (raw: string) => {
    const clean = raw.replace(/\s+/g, "");
    if (!clean) return "";
    if (clean.length <= 4) return clean;
    if (clean.length <= 8) {
      return `${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4)}`;
    }
    return `${clean.slice(0, 5)} ${clean.slice(5)}`;
  };

  const handleDigit = (char: string) => {
    setActiveKey(char);
    setTimeout(() => setActiveKey(null), 150);
    setNumber((prev) => {
      const clean = prev.replace(/\s+/g, "");
      if (clean.length >= 14) return prev;
      return formatDisplay(clean + char);
    });
  };

  const handleBackspace = () => {
    setNumber((prev) => {
      const clean = prev.replace(/\s+/g, "");
      if (clean.length <= 1) return "";
      return formatDisplay(clean.slice(0, -1));
    });
  };

  const handleClear = () => {
    setNumber("");
  };

  // Matched contact info
  const cleanNum = number.replace(/\s+/g, "");
  const matchedContact = quickNumbers.find(
    (item) => item.number.replace(/\s+/g, "") === cleanNum,
  );
  const activeCallerTitle = matchedContact
    ? matchedContact.label
    : number
      ? t("বহির্গামী কল", "Outbound Call")
      : t("পেঁয়াজফ্লো হটলাইন", "PeyajFlow Hotline");
  const activeCallerNumber = number || "7392";

  // Create the authorized session before opening its command interface.
  const handleStartCall = async () => {
    if (callState !== "idle") return;
    setConnectionError("");
    if (cleanNum !== "7392") {
      setConnectionError(
        t(
          "শুধু সিমুলেটরের 7392 নম্বর ব্যবহার করুন। কোনো ক্যারিয়ারে কল যায় না।",
          "Use simulator number 7392. No carrier call is placed.",
        ),
      );
      return;
    }
    setCallState("ringing");
    const result = await simWorkspaceCallStart();
    if (result.error || !result.data) {
      setConnectionError(
        errorText(locale, result.error ?? "service_unavailable"),
      );
      setCallState("idle");
      return;
    }
    router.push(`/${locale}/call-simulator/${result.data.id}`);
  };

  // End call and return to dialpad
  const handleEndCall = () => {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore
    }
    setCallState("ended");
    endTimeoutRef.current = setTimeout(() => {
      setCallState("idle");
      setCallSeconds(0);
      setShowKeypad(false);
    }, 800);
  };

  // Format seconds to mm:ss
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const secs = (sec % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (endTimeoutRef.current) clearTimeout(endTimeoutRef.current);
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // Ignore
      }
    };
  }, []);

  // Keyboard navigation support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (/^[0-9*#]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (callState === "idle") {
          handleStartCall();
        } else {
          handleEndCall();
        }
      } else if (e.key === "Escape" && callState !== "idle") {
        e.preventDefault();
        handleEndCall();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="phone-simulation-container">
      {connectionError && (
        <p className="work-panel" role="alert">
          {connectionError}
        </p>
      )}
      {/* Smartphone Chassis Mockup */}
      <div className="phone-chassis">
        {/* Hardware details: Speaker notch & camera */}
        <div className="phone-notch-bar">
          <span className="phone-speaker" />
          <span className="phone-camera-dot" />
        </div>

        {/* Screen Display Area */}
        <div className="phone-screen">
          {/* Top Status Strip */}
          <div className="phone-status-strip">
            <span className="phone-carrier">
              {t("পেঁয়াজফ্লো · সিমুলেটর", "PeyajFlow · Simulator")}
            </span>
            <span className="phone-time">{clock || "—"}</span>
            <div className="phone-battery-wrap">
              <span className="phone-battery-level" />
            </div>
          </div>

          {callState === "idle" ? (
            /* --- IDLE DIALPAD VIEW --- */
            <>
              {/* Dialed Number Display */}
              <div className="phone-number-display-wrap">
                <div
                  className={`phone-number-display ${!number ? "is-empty" : ""}`}
                  aria-live="polite"
                >
                  {number || t("নম্বর লিখুন...", "Dial number...")}
                </div>
                <span className="phone-sim-badge">
                  <span className="phone-pulse-dot" />
                  {t("ভয়েস সহকারী ডায়ালার", "Voice Assistant Dialer")}
                </span>
              </div>

              {/* 3x4 Dialpad Grid */}
              <div
                className="phone-keypad-grid"
                role="group"
                aria-label={t("ফোনের কীপ্যাড", "Phone keypad")}
              >
                {dialKeys.map(({ digit, sub }) => (
                  <button
                    key={digit}
                    type="button"
                    className={`phone-key-btn ${activeKey === digit ? "is-active" : ""}`}
                    onClick={() => handleDigit(digit)}
                    aria-label={sub ? `${digit} ${sub}` : digit}
                  >
                    <span className="phone-key-digit">{digit}</span>
                    {sub && <span className="phone-key-sub">{sub}</span>}
                  </button>
                ))}
              </div>

              {/* Bottom Call & Backspace Controls */}
              <div className="phone-bottom-actions">
                <div className="phone-action-placeholder">
                  {number ? (
                    <button
                      type="button"
                      className="phone-clear-text-btn"
                      onClick={handleClear}
                      title={t("সব মুছুন", "Clear all")}
                    >
                      {t("মুছুন", "Clear")}
                    </button>
                  ) : null}
                </div>

                {/* Green Call Button */}
                <button
                  type="button"
                  className="phone-call-btn"
                  disabled={!hydrated}
                  aria-busy={!hydrated}
                  onClick={handleStartCall}
                  title={t("কল শুরু করুন", "Place Call")}
                  aria-label={t("কল শুরু করুন", "Place Call")}
                >
                  <WorkspaceIcon name="phone" size={30} />
                </button>

                <div className="phone-action-right">
                  {number ? (
                    <button
                      type="button"
                      className="phone-backspace-btn"
                      onClick={handleBackspace}
                      title={t("একটি অঙ্ক মুছুন", "Backspace")}
                      aria-label={t("একটি অঙ্ক মুছুন", "Backspace")}
                    >
                      <WorkspaceIcon name="backspace" size={24} />
                    </button>
                  ) : (
                    <span className="phone-backspace-placeholder" />
                  )}
                </div>
              </div>
            </>
          ) : (
            /* --- IN-PLACE CALLING SCREEN VIEW --- */
            <div className="phone-incall-view" aria-live="polite">
              {/* Caller Information */}
              <div className="phone-incall-header">
                <div
                  className={`phone-incall-avatar-wrap ${callState === "ringing" ? "is-ringing" : ""}`}
                >
                  <div className="phone-incall-avatar">
                    <WorkspaceIcon
                      name={matchedContact ? matchedContact.icon : "phone"}
                      size={36}
                    />
                  </div>
                  {callState === "ringing" && (
                    <span className="phone-avatar-ripple" />
                  )}
                </div>

                <h4 className="phone-incall-title">{activeCallerTitle}</h4>
                <div className="phone-incall-number">{activeCallerNumber}</div>

                <div className="phone-incall-status-wrap">
                  {callState === "ringing" && (
                    <span className="phone-incall-status is-ringing">
                      <span className="phone-pulse-dot" />
                      {t("কল সংযোগ হচ্ছে...", "Calling...")}
                    </span>
                  )}
                  {callState === "connected" && (
                    <span className="phone-incall-status is-connected">
                      <span className="phone-live-dot" />
                      {formatDuration(callSeconds)}
                    </span>
                  )}
                  {callState === "ended" && (
                    <span className="phone-incall-status is-ended">
                      {t("কল সমাপ্ত", "Call Ended")}
                    </span>
                  )}
                </div>
              </div>

              {/* In-Call In-Screen Keypad Drawer (if toggled) */}
              {showKeypad ? (
                <div className="phone-incall-keypad">
                  <div className="phone-incall-mini-keys">
                    {dialKeys.map(({ digit }) => (
                      <button
                        key={digit}
                        type="button"
                        className="phone-mini-key"
                        onClick={() => handleDigit(digit)}
                      >
                        {digit}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="phone-hide-keypad-btn"
                    onClick={() => setShowKeypad(false)}
                  >
                    {t("কী-প্যাড লুকান", "Hide Keypad")}
                  </button>
                </div>
              ) : (
                /* In-call controls (Mute, Keypad, Speaker) */
                <div className="phone-incall-controls">
                  <button
                    type="button"
                    className={`phone-incall-tool-btn ${isMuted ? "is-active" : ""}`}
                    onClick={() => setIsMuted((m) => !m)}
                    title={isMuted ? t("আনমিউট", "Unmute") : t("মিউট", "Mute")}
                  >
                    <span className="phone-tool-icon">
                      <WorkspaceIcon name="mic" size={22} />
                    </span>
                    <span className="phone-tool-label">
                      {isMuted ? t("মিউটেড", "Muted") : t("মিউট", "Mute")}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`phone-incall-tool-btn ${showKeypad ? "is-active" : ""}`}
                    onClick={() => setShowKeypad(true)}
                    title={t("কী-প্যাড", "Keypad")}
                  >
                    <span className="phone-tool-icon">
                      <span className="phone-keypad-icon-grid">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </span>
                    </span>
                    <span className="phone-tool-label">
                      {t("কী-প্যাড", "Keypad")}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`phone-incall-tool-btn ${isSpeaker ? "is-active" : ""}`}
                    onClick={() => setIsSpeaker((s) => !s)}
                    title={
                      isSpeaker
                        ? t("স্পিকার বন্ধ", "Speaker Off")
                        : t("স্পিকার অন", "Speaker")
                    }
                  >
                    <span className="phone-tool-icon">
                      <WorkspaceIcon name="volume" size={22} />
                    </span>
                    <span className="phone-tool-label">
                      {isSpeaker
                        ? t("স্পিকার অন", "Speaker On")
                        : t("স্পিকার", "Speaker")}
                    </span>
                  </button>
                </div>
              )}

              {/* Red Hang Up Button */}
              <div className="phone-incall-bottom-actions">
                <button
                  type="button"
                  className="phone-end-call-btn"
                  onClick={handleEndCall}
                  disabled={callState === "ended" || callState === "ringing"}
                  title={t("কল শেষ করুন", "End Call")}
                  aria-label={t("কল শেষ করুন", "End Call")}
                >
                  <WorkspaceIcon name="phoneOff" size={30} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Side Panel for Quick Call Numbers */}
      <aside className="phone-side-panel">
        <div className="phone-side-panel-header">
          <h3 className="phone-side-panel-title">
            {t("জরুরি নম্বরসমূহ", "Quick Call Numbers")}
          </h3>
        </div>

        <div className="phone-side-panel-list">
          {quickNumbers.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`phone-side-panel-item ${item.id === "ai" ? "is-ai-item" : ""}`}
              onClick={() => {
                setNumber(item.number);
                if (callState !== "idle") {
                  handleEndCall();
                }
              }}
              title={`${item.label}: ${item.number}`}
            >
              <span className="phone-side-panel-icon">
                <WorkspaceIcon name={item.icon} size={17} />
              </span>
              <div className="phone-side-panel-details">
                <span className="phone-side-panel-name">{item.label}</span>
                <span className="phone-side-panel-number">{item.number}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
