"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import type { Locale } from "../../lib/copy";
import type { Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import { WorkspaceIcon } from "./icon";
import type { Recognition } from "./speech-input";
import { featureAction } from "../../app/[locale]/workspace/feature-actions";

type ChatRecognition = Recognition & {
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  stop: () => void;
};

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
  sources?: { id: string; title: string; source_url: string }[];
}

export function ChatbotWidget({
  locale,
}: {
  locale: Locale;
  base?: string;
  actor?: Profile;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechHint, setSpeechHint] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<ChatRecognition | null>(null);

  const t = (bn: string, en: string) => local(locale, bn, en);

  const initialBotMessage: ChatMessage = {
    id: "init-1",
    sender: "bot",
    text: t(
      "সালাম/নমস্কার! আমি পেঁয়াজফ্লো এআই সহকারী। পেঁয়াজের মোকাম দর, মজুত বা কেনাবেচা সম্পর্কে যেকোনো প্রশ্ন নিচে লিখে জানান, অথবা মাইক্রোফোন আইকনে চাপ দিয়ে মুখে বলুন।",
      "Hello! I am your PeyajFlow AI Assistant. Ask me anything about onion market rates, stock weights, or trading offers. You can type below or tap the microphone icon to speak.",
    ),
    time: t("এখন", "Now"),
  };

  const [messages, setMessages] = useState<ChatMessage[]>([initialBotMessage]);

  const quickChips = [
    {
      label: t("আজকের মোকাম দর", "Today's market rates"),
      prompt: t(
        "আজকের পেঁয়াজের মোকাম দর কত?",
        "What are today's onion market prices?",
      ),
    },
    {
      label: t("আমার মজুত পেঁয়াজ", "My onion stock"),
      prompt: t(
        "আমার মাচায় কত কেজি পেঁয়াজ আছে?",
        "How much onion stock is in my storage?",
      ),
    },
    {
      label: t("কাওরান বাজার রেট", "Karwan Bazar price"),
      prompt: t(
        "কাওরান বাজারে পাইকারি দর কত?",
        "Wholesale rate in Karwan Bazar?",
      ),
    },
    {
      label: t("পরিবহন সহায়তা", "Logistics & Transport"),
      prompt: t(
        "পেঁয়াজ পরিবহনের ব্যবস্থা কীভাবে করব?",
        "How to arrange onion transport and delivery?",
      ),
    },
  ];

  // Auto-scroll messages to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, isTyping]);

  // Clean up speech recognition engine on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Speech-to-Text Recognition Toggle (In-place dictation into the input box)
  const toggleSpeechToText = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      setSpeechHint("");
      return;
    }

    const browser =
      typeof window !== "undefined"
        ? (window as Window & {
            SpeechRecognition?: new () => ChatRecognition;
            webkitSpeechRecognition?: new () => ChatRecognition;
          })
        : null;
    const BrowserRecognition =
      browser?.SpeechRecognition || browser?.webkitSpeechRecognition;

    if (!BrowserRecognition) {
      setSpeechHint(
        t(
          "ব্রাউজারে ভয়েস সমর্থিত নয়, অনুগ্রহ করে টাইপ করুন।",
          "Speech recognition unavailable in this browser. Please type.",
        ),
      );
      setTimeout(() => setSpeechHint(""), 4000);
      return;
    }

    try {
      const recognition = new BrowserRecognition();
      recognition.lang = locale === "bn" ? "bn-BD" : "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechHint(t("শুনছি... এখন বাংলায় বলুন", "Listening... Speak now"));
      };

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0]?.transcript || "";
        }
        if (transcript.trim()) {
          setInputText(transcript.trim());
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setSpeechHint("");
      };

      recognition.onend = () => {
        setIsListening(false);
        setSpeechHint("");
        inputRef.current?.focus();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechHint("");
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isTyping || text.length > 500) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      setSpeechHint("");
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: "user",
      text,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    try {
      const form = new FormData();
      form.set("question", text);
      const response = await featureAction(locale, "chat", form);
      const answer = response.data as
        { answer: string; citations?: ChatMessage["sources"] } | undefined;
      const replyText =
        response.error ??
        answer?.answer ??
        t(
          "উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।",
          "No answer was available. Please try again.",
        );
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: "bot",
        text: replyText,
        sources: answer?.citations,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  return (
    <>
      {/* ─── 1. FLOATING CHATBOT ICON (Right Bottom Corner) ─── */}
      <div className="chatbot-floating-wrapper">
        <button
          type="button"
          className={`chatbot-trigger-btn ${isOpen ? "is-open" : ""}`}
          onClick={() => setIsOpen((prev) => !prev)}
          title={
            isOpen
              ? t("চ্যাটবট বন্ধ করুন", "Close Chatbot")
              : t("পেঁয়াজফ্লো সহকারী", "Open PeyajFlow Assistant")
          }
          aria-label={t("সহকারী চ্যাটবট", "Assistant Chatbot")}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <WorkspaceIcon name="close" size={24} />
          ) : (
            <>
              <WorkspaceIcon name="chat" size={26} />
              <span className="chatbot-pulse-dot" />
            </>
          )}
        </button>
      </div>

      {/* ─── 2. POPUP MESSAGE WINDOW ─── */}
      {isOpen && (
        <div
          className="chatbot-window-popover"
          role="dialog"
          aria-label={t("পেঁয়াজফ্লো সহকারী চ্যাট", "PeyajFlow Assistant Chat")}
        >
          {/* Header */}
          <div className="chatbot-window-header">
            <div className="chatbot-header-profile">
              <div className="chatbot-avatar-wrap">
                <span className="chatbot-avatar-icon">
                  <WorkspaceIcon name="bot" size={20} />
                </span>
                <span className="chatbot-online-badge" />
              </div>
              <div className="chatbot-header-text">
                <h3 className="chatbot-title">
                  {t("পেঁয়াজফ্লো এআই সহকারী", "PeyajFlow AI Assistant")}
                </h3>
                <span className="chatbot-subtitle">
                  {t("উৎসসহ সহায়িকা · শুধু পড়া", "Sourced help · Read-only chat")}
                </span>
              </div>
            </div>

            <div className="chatbot-header-actions">
              <button
                type="button"
                className="chatbot-close-btn"
                onClick={() => setIsOpen(false)}
                title={t("বন্ধ করুন", "Close")}
                aria-label={t("বন্ধ করুন", "Close")}
              >
                <WorkspaceIcon name="close" size={18} />
              </button>
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="chatbot-chips-tray">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="chatbot-chip-btn"
                onClick={() => handleSendMessage(chip.prompt)}
              >
                <span>{chip.label}</span>
              </button>
            ))}
          </div>

          {/* Messages Thread */}
          <div className="chatbot-messages-scroll">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chatbot-bubble-row ${msg.sender === "user" ? "is-user" : "is-bot"}`}
              >
                {msg.sender === "bot" && (
                  <div className="chatbot-bot-avatar-tiny" aria-hidden="true">
                    <WorkspaceIcon name="bot" size={14} />
                  </div>
                )}
                <div className="chatbot-bubble-content">
                  <p className="chatbot-bubble-text">{msg.text}</p>
                  {msg.sources?.map((source) => (
                    <a
                      key={source.id}
                      className="work-link"
                      href={`/${locale}/workspace/help?source=${encodeURIComponent(source.id.split(":")[0])}`}
                    >
                      {source.title}
                    </a>
                  ))}
                  <span className="chatbot-bubble-time">{msg.time}</span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="chatbot-bubble-row is-bot">
                <div className="chatbot-bot-avatar-tiny" aria-hidden="true">
                  <WorkspaceIcon name="bot" size={14} />
                </div>
                <div className="chatbot-bubble-content is-typing">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Speech Hint if listening or unsupported */}
          {speechHint && (
            <div className="chatbot-speech-hint-bar" role="status">
              <span className="chatbot-speech-dot" />
              <span>{speechHint}</span>
            </div>
          )}

          {/* ─── 3. MESSAGE WRITING BAR & MICROPHONE (SPEECH-TO-TEXT) ─── */}
          <form className="chatbot-input-bar" onSubmit={onSubmit}>
            {/* Microphone Icon for Speech-to-Text */}
            <button
              type="button"
              className={`chatbot-mic-btn ${isListening ? "is-listening" : ""}`}
              onClick={toggleSpeechToText}
              title={
                isListening
                  ? t("রেকর্ডিং বন্ধ করুন", "Stop listening")
                  : t(
                      "কথা বলে লিখুন (স্পিচ-টু-টেক্সট)",
                      "Speak to type (Speech-to-Text)",
                    )
              }
              aria-label={
                isListening
                  ? t("রেকর্ডিং বন্ধ করুন", "Stop listening")
                  : t("কথা বলে লিখুন", "Speak to type")
              }
            >
              <WorkspaceIcon name="mic" size={20} />
              <span
                className={`chatbot-mic-ring ${isListening ? "pulse-active" : ""}`}
              />
            </button>

            {/* Message Writing Input */}
            <input
              ref={inputRef}
              type="text"
              className="chatbot-text-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isListening
                  ? t("শুনছি... এখন কথা বলুন...", "Listening... Speak now...")
                  : t(
                      "বার্তা লিখুন বা প্রশ্ন করুন...",
                      "Type a message or question...",
                    )
              }
              aria-label={t("বার্তা লিখুন", "Type message")}
            />

            {/* Send Button */}
            <button
              type="submit"
              className="chatbot-send-btn"
              disabled={!inputText.trim()}
              title={t("পাঠান", "Send")}
              aria-label={t("পাঠান", "Send")}
            >
              <WorkspaceIcon name="send" size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
