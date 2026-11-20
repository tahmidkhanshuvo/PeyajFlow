"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  simCallStart,
  simCallTurn,
  simInbox,
  simPriceAlert,
  simSendSms,
  simTestOffer,
  simTranscribe,
  simUssd,
  type SimMessage,
  type SimReply,
} from "../../app/[locale]/workspace/simulator-actions";
import type { Locale } from "../../lib/copy";
import { errorText, local } from "../../lib/workspace-copy";

const USSD_CODE = "*7392#";
const HOTLINE = "7392";
const KEYS: [string, string][] = [
  ["1", "⌴"],
  ["2", "abc"],
  ["3", "def"],
  ["4", "ghi"],
  ["5", "jkl"],
  ["6", "mno"],
  ["7", "pqrs"],
  ["8", "tuv"],
  ["9", "wxyz"],
  ["*", "+"],
  ["0", "␣"],
  ["#", "⇧"],
];
const BANGLA = (text: string) =>
  text.replace(/[0-9]/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);

type Line = { who: "pf" | "you"; text: string };
type Screen =
  | { kind: "home" }
  | { kind: "menu"; at: number }
  | { kind: "inbox"; at: number }
  | { kind: "message"; id: string }
  | { kind: "compose"; text: string }
  | { kind: "dial"; digits: string }
  | { kind: "ussd"; path: string[]; text: string; input: string; end: boolean }
  | { kind: "call"; lines: Line[]; keyed: string; awaiting: string | null };

type Recognition = {
  lang: string;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

export function BasicPhone({
  locale,
  initial,
  canTestOffer,
  transcription,
}: {
  locale: Locale;
  initial: SimMessage[];
  canTestOffer: boolean;
  transcription: boolean;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const [messages, setMessages] = useState(initial);
  // The server returns the latest messages only, so unread counts use the
  // time of the last message read, not the length of the list.
  const [seenAt, setSeenAt] = useState(initial.at(-1)?.created_at ?? "");
  const markRead = (list: SimMessage[]) =>
    setSeenAt(list.at(-1)?.created_at ?? "");
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [typed, setTyped] = useState("");
  const [listening, setListening] = useState(false);
  const [consented, setConsented] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  const incoming = messages.filter((m) => m.direction === "in");
  const unread = messages.filter(
    (m) =>
      m.direction === "in" &&
      Date.parse(m.created_at) > Date.parse(seenAt || "0"),
  ).length;

  useEffect(() => {
    // The clock starts after mounting so the server and browser agree.
    const first = setTimeout(() => setNow(new Date()), 0);
    const clock = setInterval(() => setNow(new Date()), 30_000);
    // New SMS can arrive from actions taken elsewhere, such as a buyer's offer.
    const poll = setInterval(async () => {
      const result = await simInbox();
      if (result.data) setMessages(result.data);
    }, 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(clock);
      clearInterval(poll);
      window.speechSynthesis?.cancel();
      recognition.current?.abort();
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => /^bn(?:-|$)/i.test(item.lang));
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "bn-BD";
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }, []);

  function fail(code?: string) {
    setNotice(errorText(locale, code ?? "service_unavailable"));
  }

  async function run<T>(task: () => Promise<{ data?: T; error?: string }>) {
    setBusy(true);
    setNotice("");
    const result = await task();
    setBusy(false);
    if (result.error) fail(result.error);
    return result.data;
  }

  async function sendSms(text: string) {
    const thread = await run(() => simSendSms(text));
    if (!thread) return;
    setMessages(thread);
    markRead(thread);
    const reply = thread[thread.length - 1];
    setScreen({ kind: "message", id: reply.id });
  }

  async function startUssd() {
    const reply = await run(() => simUssd(""));
    if (reply)
      setScreen({
        kind: "ussd",
        path: [],
        text: reply.text,
        input: "",
        end: reply.end,
      });
  }

  async function sendUssd(path: string[], input: string) {
    const next = [...path, input];
    const reply = await run(() => simUssd(next.join("*")));
    if (reply)
      setScreen({
        kind: "ussd",
        path: next,
        text: reply.text,
        input: "",
        end: reply.end,
      });
  }

  async function startCall() {
    const reply = await run(() => simCallStart());
    if (!reply) return;
    setScreen({
      kind: "call",
      lines: [{ who: "pf", text: reply.text }],
      keyed: "",
      awaiting: null,
    });
    speak(reply.text);
  }

  async function callTurn(text: string, lines: Line[]) {
    const said: Line[] = [...lines, { who: "you", text }];
    setScreen({ kind: "call", lines: said, keyed: "", awaiting: null });
    const reply: SimReply | undefined = await run(() => simCallTurn(text));
    if (!reply) return;
    setScreen({
      kind: "call",
      lines: [...said, { who: "pf" as const, text: reply.text }].slice(-8),
      keyed: "",
      awaiting: reply.awaiting,
    });
    speak(reply.text);
  }

  function hangUp() {
    window.speechSynthesis?.cancel();
    recognition.current?.abort();
    setScreen({ kind: "home" });
  }

  // ----------------------------------------------------------- keys
  function press(key: string) {
    if (busy) return;
    switch (screen.kind) {
      case "home":
        if (/[0-9*#]/.test(key)) setScreen({ kind: "dial", digits: key });
        break;
      case "compose":
        if (/[0-9*#]/.test(key))
          setScreen({ ...screen, text: `${screen.text}${key}`.slice(0, 160) });
        break;
      case "dial":
        if (/[0-9*#]/.test(key))
          setScreen({
            ...screen,
            digits: `${screen.digits}${key}`.slice(0, 16),
          });
        break;
      case "ussd":
        if (!screen.end && /[0-9*#]/.test(key))
          setScreen({ ...screen, input: `${screen.input}${key}`.slice(0, 8) });
        break;
      case "call":
        if (!/[0-9*#]/.test(key)) break;
        if (screen.awaiting) {
          setScreen({ ...screen, keyed: `${screen.keyed}${key}`.slice(0, 6) });
        } else if (/[0-9]/.test(key)) {
          void callTurn(key, screen.lines);
        }
        break;
    }
  }

  function leftSoft() {
    if (busy) return;
    switch (screen.kind) {
      case "home":
        markRead(messages);
        setScreen(unread ? { kind: "inbox", at: 0 } : { kind: "menu", at: 0 });
        break;
      case "menu":
        openMenu(screen.at);
        break;
      case "inbox":
        if (incoming.length) {
          const list = [...messages].reverse();
          setScreen({ kind: "message", id: list[screen.at]?.id ?? list[0].id });
        }
        break;
      case "message":
        setScreen({ kind: "compose", text: "" });
        break;
      case "compose":
        if (screen.text.trim()) void sendSms(screen.text);
        break;
      case "dial":
        void dial(screen.digits);
        break;
      case "ussd":
        if (screen.end) setScreen({ kind: "home" });
        else if (screen.input) void sendUssd(screen.path, screen.input);
        break;
      case "call":
        if (screen.awaiting && screen.keyed)
          void callTurn(screen.keyed, screen.lines);
        break;
    }
  }

  function rightSoft() {
    if (busy) return;
    switch (screen.kind) {
      case "compose":
        if (screen.text)
          setScreen({ ...screen, text: screen.text.slice(0, -1) });
        else setScreen({ kind: "inbox", at: 0 });
        break;
      case "dial":
        if (screen.digits.length > 1)
          setScreen({ ...screen, digits: screen.digits.slice(0, -1) });
        else setScreen({ kind: "home" });
        break;
      case "ussd":
        if (screen.input)
          setScreen({ ...screen, input: screen.input.slice(0, -1) });
        else setScreen({ kind: "home" });
        break;
      case "call":
        if (screen.keyed)
          setScreen({ ...screen, keyed: screen.keyed.slice(0, -1) });
        break;
      case "message":
        setScreen({ kind: "inbox", at: 0 });
        break;
      default:
        setScreen({ kind: "home" });
    }
  }

  function move(step: number) {
    if (screen.kind === "menu")
      setScreen({
        ...screen,
        at: (screen.at + step + MENU.length) % MENU.length,
      });
    if (screen.kind === "inbox" && messages.length)
      setScreen({
        ...screen,
        at: Math.min(Math.max(screen.at + step, 0), messages.length - 1),
      });
  }

  async function dial(digits: string) {
    if (digits === USSD_CODE) return startUssd();
    if (digits === HOTLINE) return startCall();
    setNotice(
      t(
        `এই সিমুলেটরে শুধু ${USSD_CODE} (মেনু) বা ${HOTLINE} (কল) ডায়াল করা যায়।`,
        `This simulator dials only ${USSD_CODE} (menu) or ${HOTLINE} (call).`,
      ),
    );
  }

  const MENU = [
    t("বার্তা", "Messages"),
    t("নতুন বার্তা", "New message"),
    t(`মেনু ${USSD_CODE}`, `Menu ${USSD_CODE}`),
    t(`পেঁয়াজফ্লোতে কল (${HOTLINE})`, `Call PeyajFlow (${HOTLINE})`),
  ];
  function openMenu(at: number) {
    if (at === 0) setScreen({ kind: "inbox", at: 0 });
    if (at === 1) setScreen({ kind: "compose", text: "" });
    if (at === 2) void startUssd();
    if (at === 3) void startCall();
  }

  // ------------------------------------------------------- speech input
  async function listen() {
    if (screen.kind !== "call" || busy) return;
    if (recognition.current) return recognition.current.abort();
    if (recorder.current) return recorder.current.stop();
    const browser = window as Window & {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Native = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (Native) {
      const engine = new Native();
      engine.lang = "bn-BD";
      engine.onresult = (event) => {
        const text = event.results[0]?.[0]?.transcript.trim();
        if (text) setTyped(text.slice(0, 200));
      };
      engine.onerror = () => setNotice(errorText(locale, "voice_repeat"));
      engine.onend = () => {
        recognition.current = null;
        setListening(false);
      };
      recognition.current = engine;
      setListening(true);
      engine.start();
      return;
    }
    if (!transcription) {
      setNotice(
        t(
          "এই ব্রাউজারে কথা চেনা যায় না। লিখে পাঠান।",
          "Speech is unavailable here. Type instead.",
        ),
      );
      return;
    }
    if (!consented) {
      setNotice(
        t(
          "কথা লেখায় রূপান্তরের আগে নিচের সম্মতি দিন।",
          "Give consent below before speaking.",
        ),
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      media.ondataavailable = (event) => chunks.push(event.data);
      media.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        recorder.current = null;
        setListening(false);
        const blob = new Blob(chunks, {
          type: media.mimeType.split(";")[0] || "audio/webm",
        });
        const audio = await blobToBase64(blob);
        const text = await run(() => simTranscribe(audio, blob.type));
        if (text) setTyped(text);
      };
      recorder.current = media;
      setListening(true);
      media.start();
      setTimeout(() => media.state === "recording" && media.stop(), 12_000);
    } catch {
      setNotice(t("মাইক্রোফোন চালু হয়নি।", "The microphone could not start."));
    }
  }

  // ------------------------------------------------------------- views
  const time = now
    ? now.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })
    : "";
  const date = now
    ? now.toLocaleDateString("bn-BD", {
        weekday: "short",
        day: "numeric",
        month: "long",
      })
    : "";
  const soft = labels(screen, t, unread > 0, incoming.length > 0);
  const view = render();

  function render() {
    switch (screen.kind) {
      case "home":
        return (
          <div className="sim-idle">
            <div className="sim-clock">{time}</div>
            <div className="sim-date">{date}</div>
            {unread > 0 && (
              <div className="sim-toast">
                <b>{BANGLA(String(unread))}টি নতুন বার্তা</b>
                <span>PeyajFlow</span>
              </div>
            )}
          </div>
        );
      case "menu":
        return (
          <Body title={t("মেনু", "Menu")}>
            <ol className="sim-list">
              {MENU.map((item, index) => (
                <li key={item} className={index === screen.at ? "on" : ""}>
                  <button type="button" onClick={() => openMenu(index)}>
                    {BANGLA(String(index + 1))} {item}
                  </button>
                </li>
              ))}
            </ol>
          </Body>
        );
      case "inbox": {
        const list = [...messages].reverse();
        return (
          <Body
            title={t("বার্তা", "Messages")}
            right={BANGLA(String(list.length))}
          >
            {!list.length && <p>{t("কোনো বার্তা নেই।", "No messages.")}</p>}
            <ol className="sim-list">
              {list.slice(0, 30).map((message, index) => (
                <li
                  key={message.id}
                  className={index === screen.at ? "on" : ""}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setScreen({ kind: "message", id: message.id })
                    }
                  >
                    <small>
                      {message.direction === "in"
                        ? "PeyajFlow"
                        : t("আপনি", "You")}
                    </small>
                    {message.body.slice(0, 38)}
                  </button>
                </li>
              ))}
            </ol>
          </Body>
        );
      }
      case "message": {
        const message = messages.find((item) => item.id === screen.id);
        return (
          <Body
            title={
              message?.direction === "out" ? t("পাঠানো", "Sent") : "PeyajFlow"
            }
            right={message ? stamp(message.created_at) : ""}
          >
            <p className="sim-text">{message?.body}</p>
          </Body>
        );
      }
      case "compose":
        return (
          <Body title={t("উত্তর: PeyajFlow", "To: PeyajFlow")}>
            <p className="sim-typed">
              {screen.text}
              <span className="sim-caret" />
            </p>
          </Body>
        );
      case "dial":
        return (
          <Body title={t("নম্বর ডায়াল", "Dial")}>
            <p className="sim-dial">{screen.digits}</p>
          </Body>
        );
      case "ussd":
        return (
          <Body title="USSD">
            <p className="sim-text sim-pre">{screen.text}</p>
            {!screen.end && (
              <p className="sim-input">
                {screen.input}
                <span className="sim-caret" />
              </p>
            )}
          </Body>
        );
      case "call":
        return (
          <Body title={t("কলে আছেন", "On call")} right={HOTLINE}>
            <div className="sim-call">
              <span className="sim-call-icon" aria-hidden="true">
                ☎
              </span>
              <b>PeyajFlow</b>
              {screen.awaiting && (
                <p className="sim-input">
                  {"•".repeat(screen.keyed.length)}
                  <span className="sim-caret" />
                </p>
              )}
            </div>
          </Body>
        );
    }
  }

  return (
    <div className="sim-basic">
      {screen.kind === "call" && (
        <ol className="sim-captions" aria-live="polite">
          {screen.lines.slice(-4).map((line, index) => (
            <li key={index} className={line.who}>
              <small>
                {line.who === "pf"
                  ? t("কলে শোনা যাচ্ছে", "Heard on the call")
                  : t("আপনি", "You")}
              </small>
              {line.text}
            </li>
          ))}
        </ol>
      )}
      <div className="sim-device">
        <div className="sim-speaker" />
        <div className={`sim-screen ${screen.kind === "home" ? "idle" : ""}`}>
          <div className="sim-status">
            <span>GP</span>
            <span>{time}</span>
            <span>▮▮▮</span>
          </div>
          {view}
          <div className="sim-soft">
            <button
              type="button"
              onClick={leftSoft}
              disabled={busy}
              aria-label={
                soft[0] ? undefined : t("বাম সফট কী", "Left soft key")
              }
            >
              {busy ? "…" : soft[0]}
            </button>
            <span />
            <button
              type="button"
              onClick={rightSoft}
              disabled={busy}
              aria-label={
                soft[1] ? undefined : t("ডান সফট কী", "Right soft key")
              }
            >
              {soft[1]}
            </button>
          </div>
        </div>
        <div className="sim-controls">
          <button
            type="button"
            className="sim-call-key"
            aria-label={t("কল", "Call")}
            onClick={() =>
              screen.kind === "dial" ? void dial(screen.digits) : leftSoft()
            }
          >
            ☎
          </button>
          <div className="sim-pad">
            <button
              type="button"
              aria-label={t("উপরে", "Up")}
              onClick={() => move(-1)}
            >
              ▲
            </button>
            <button
              type="button"
              aria-label="OK"
              className="sim-ok"
              onClick={leftSoft}
            >
              OK
            </button>
            <button
              type="button"
              aria-label={t("নিচে", "Down")}
              onClick={() => move(1)}
            >
              ▼
            </button>
          </div>
          <button
            type="button"
            className="sim-end-key"
            aria-label={t("কল শেষ", "End call")}
            onClick={hangUp}
          >
            ✕
          </button>
        </div>
        <div className="sim-keypad">
          {KEYS.map(([key, letters]) => (
            <button type="button" key={key} onClick={() => press(key)}>
              <span>{key}</span>
              <small aria-hidden="true">{letters}</small>
            </button>
          ))}
        </div>
      </div>

      <section className="sim-helpers">
        {notice && (
          <p className="form-error" role="alert">
            {notice}
          </p>
        )}
        {(screen.kind === "compose" || screen.kind === "call") && (
          <form
            className="work-form"
            onSubmit={(event) => {
              event.preventDefault();
              const text = typed.trim();
              if (!text || busy) return;
              setTyped("");
              if (screen.kind === "compose") void sendSms(text);
              else void callTurn(text, screen.lines);
            }}
          >
            <label>
              {screen.kind === "call"
                ? t(
                    "যা বলবেন (শোনা লেখা বদলাতে পারেন)",
                    "What you say (edit what was heard)",
                  )
                : t("বার্তা লিখুন", "Type a message")}
              <input
                value={typed}
                maxLength={200}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={
                  screen.kind === "call" ? "অফার গ্রহণ ২০০ কেজি" : "1"
                }
              />
            </label>
            <div className="work-row">
              {screen.kind === "call" && (
                <button
                  type="button"
                  className="pilot-secondary"
                  onClick={listen}
                  disabled={busy}
                >
                  {listening
                    ? t("শোনা বন্ধ করুন", "Stop")
                    : t("কথা বলুন", "Speak")}
                </button>
              )}
              <button
                type="submit"
                className="refresh"
                disabled={busy || !typed.trim()}
              >
                {t("পাঠান", "Send")}
              </button>
            </div>
            {screen.kind === "call" && transcription && (
              <label className="sim-consent">
                <input
                  type="checkbox"
                  checked={consented}
                  onChange={(event) => setConsented(event.target.checked)}
                />
                {t(
                  "এই ব্রাউজারে কথা চেনার সুবিধা না থাকলে, আমার কথা লেখায় রূপান্তরের জন্য Google Gemini-তে পাঠানো যাবে। অডিও সংরক্ষণ করা হয় না।",
                  "If this browser cannot recognise speech, my voice may be sent to Google Gemini for transcription. Audio is not stored.",
                )}
              </label>
            )}
          </form>
        )}
        <div className="work-row">
          {canTestOffer && (
            <button
              type="button"
              className="pilot-secondary"
              disabled={busy}
              onClick={async () => {
                const thread = await run(() => simTestOffer());
                if (thread) setMessages(thread);
              }}
            >
              {t("পরীক্ষার অফার পাঠান", "Send a test offer")}
            </button>
          )}
          <button
            type="button"
            className="pilot-secondary"
            disabled={busy}
            onClick={async () => {
              const thread = await run(() => simPriceAlert());
              if (thread) setMessages(thread);
            }}
          >
            {t("সাপ্তাহিক দর SMS", "Weekly price SMS")}
          </button>
        </div>
        <p className="sim-help">
          {t(
            `এসএমএস-এ অফারের উত্তর ১ বা ২, দর জানতে “দর”। মেনুর জন্য ${USSD_CODE}, কলের জন্য ${HOTLINE} ডায়াল করুন। প্রতিটি পরিবর্তন পিন বা কোড দিয়ে নিশ্চিত করতে হয়।`,
            `Reply 1 or 2 to an offer SMS, or send “দর” for prices. Dial ${USSD_CODE} for the menu or ${HOTLINE} to call. Every change needs your PIN or the code.`,
          )}
        </p>
      </section>
    </div>
  );
}

function Body({
  title,
  right,
  children,
}: {
  title: string;
  right?: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="sim-header">
        <span>{title}</span>
        <span>{right}</span>
      </div>
      <div className="sim-body">{children}</div>
    </>
  );
}

function labels(
  screen: Screen,
  t: (bn: string, en: string) => string,
  unread: boolean,
  hasMessages: boolean,
): [string, string] {
  switch (screen.kind) {
    case "home":
      return [unread ? t("পড়ুন", "Read") : t("মেনু", "Menu"), ""];
    case "menu":
      return [t("বেছে নিন", "Select"), t("পেছনে", "Back")];
    case "inbox":
      return [hasMessages ? t("খুলুন", "Open") : "", t("পেছনে", "Back")];
    case "message":
      return [t("উত্তর", "Reply"), t("পেছনে", "Back")];
    case "compose":
      return [t("পাঠান", "Send"), t("মুছুন", "Delete")];
    case "dial":
      return [t("কল", "Call"), t("মুছুন", "Delete")];
    case "ussd":
      return screen.end
        ? [t("ঠিক আছে", "OK"), ""]
        : [t("পাঠান", "Send"), t("বাতিল", "Cancel")];
    case "call":
      return [
        screen.awaiting ? t("নিশ্চিত", "Confirm") : "",
        t("মুছুন", "Delete"),
      ];
  }
}

function stamp(value: string) {
  return new Date(value).toLocaleTimeString("bn-BD", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
