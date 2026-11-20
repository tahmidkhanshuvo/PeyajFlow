"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../lib/copy";
import { local } from "../../lib/workspace-copy";
import { WorkspaceIcon } from "./icon";

type Recognition = {
  lang: string;
  maxAlternatives: number;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

export function SpeechInput({
  locale,
  disabled,
  onTranscript,
}: {
  locale: Locale;
  disabled: boolean;
  // Alternatives in the browser's order of confidence, best first.
  onTranscript: (alternatives: string[]) => void;
}) {
  const engine = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const t = (bn: string, en: string) => local(locale, bn, en);

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

  function listen() {
    if (engine.current) {
      engine.current.abort();
      return;
    }
    const browser = window as Window & {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const BrowserRecognition =
      browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!BrowserRecognition) {
      setStatus(
        t(
          "এই ব্রাউজারে লেখা ব্যবহার করুন।",
          "Voice input is unavailable in this browser. You can type the command.",
        ),
      );
      return;
    }
    const recognition = new BrowserRecognition();
    recognition.lang = "bn-BD";
    recognition.maxAlternatives = 3;
    recognition.onresult = (event) => {
      const alternatives = Array.from(event.results[0] ?? [])
        .map((item) => item.transcript.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 3);
      if (alternatives.length) {
        onTranscript(alternatives);
        setStatus(
          t(
            "পাঠানোর আগে লেখাটি যাচাই করুন।",
            "Review the transcript before sending.",
          ),
        );
      }
    };
    recognition.onerror = (event) => {
      setStatus(
        event.error === "aborted"
          ? ""
          : t(
              "বাংলা বক্তব্য বোঝা যায়নি। আবার বলুন বা লিখুন।",
              "The browser could not transcribe your speech. Try speaking again or type the command.",
            ),
      );
    };
    recognition.onend = () => {
      engine.current = null;
      setListening(false);
    };
    try {
      recognition.start();
      engine.current = recognition;
      setStatus("");
      setListening(true);
    } catch {
      setStatus(t("মাইক্রোফোন চালু হয়নি।", "The microphone could not start."));
    }
  }

  return (
    <div className="work-form">
      <button
        className="pilot-secondary"
        type="button"
        disabled={disabled}
        onClick={listen}
        style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
      >
        <WorkspaceIcon name="mic" size={16} />
        <span>
          {listening
            ? t("শোনা বন্ধ করুন", "Stop listening")
            : t("বাংলায় বলুন", "Speak Bangla")}
        </span>
      </button>
      <small>
        {t(
          "আপনার ব্রাউজারের কথার সেবা অডিও প্রক্রিয়া করতে পারে।",
          "Your browser's speech service may process the audio.",
        )}
      </small>
      <span role="status">{listening ? t("শুনছি…", "Listening…") : status}</span>
    </div>
  );
}
