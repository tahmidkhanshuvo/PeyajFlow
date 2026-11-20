"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import type { Locale } from "../../lib/copy";
import type { Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import { WorkspaceIcon } from "./icon";

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
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
  const recognitionRef = useRef<any>(null);

  const t = (bn: string, en: string) => local(locale, bn, en);

  const initialBotMessage: ChatMessage = {
    id: "init-1",
    sender: "bot",
    text: t(
      "সালাম/নমস্কার! আমি পেঁয়াজফ্লো এআই সহকারী। পেঁয়াজের মোকাম দর, মজুত বা কেনাবেচা সম্পর্কে যেকোনো প্রশ্ন নিচে লিখে জানান, অথবা মাইক্রোফোন আইকনে চাপ দিয়ে মুখে বলুন।",
      "Hello! I am your PeyajFlow AI Assistant. Ask me anything about onion market rates, stock weights, or trading offers. You can type below or tap the microphone icon to speak.",
    ),
    time: "এখন",
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
      prompt: t("পেঁয়াজ পরিবহনের ব্যবস্থা কীভাবে করব?", "How to arrange onion transport and delivery?"),
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

    const browser = typeof window !== "undefined" ? (window as any) : null;
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
        setSpeechHint(
          t("শুনছি... এখন বাংলায় বলুন", "Listening... Speak now"),
        );
      };

      recognition.onresult = (event: any) => {
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

  const generateBotReply = (userQuery: string): string => {
    const q = userQuery.toLowerCase();

    if (
      q.includes("দর") ||
      q.includes("রেট") ||
      q.includes("দাম") ||
      q.includes("price") ||
      q.includes("rate")
    ) {
      return t(
        "আজকের পাবনা মোকামে তাহেরপুরী পেঁয়াজ ৩৮.৪০ ৳/কেজি এবং কাওরান বাজার পাইকারি মোকামে ৪৭.৮০ ৳/কেজি দরে লেনদেন হচ্ছে। বিস্তারিত দেখতে 'বাজারদর' পৃষ্ঠায় যান।",
        "Today's Pabna farmgate benchmark is 38.40 ৳/kg and Karwan Bazar wholesale is 47.80 ৳/kg. Navigate to Market Prices for historical trend charts.",
      );
    }

    if (
      q.includes("মজুত") ||
      q.includes("স্টক") ||
      q.includes("stock") ||
      q.includes("কেজি") ||
      q.includes("shed")
    ) {
      return t(
        "আপনার সুজানগর মাচায় বর্তমানে ২,২২০ কেজি আনরিজার্ভড তাহেরপুরী পেঁয়াজ সংরক্ষিত রয়েছে। নতুন অফার পাঠাতে 'আমার মজুত' পৃষ্ঠায় যান।",
        "You currently have 2,220 kg of unreserved Taherpuri onion stored in your Sujanagar shed. Visit 'My Stock' to create new sale offers.",
      );
    }

<<<<<<< Updated upstream
    if (
      q.includes("কল") ||
      q.includes("ভয়েস") ||
      q.includes("কথা") ||
      q.includes("voice") ||
      q.includes("call") ||
      q.includes("phone")
    ) {
=======
    if (q.includes("পরিবহন") || q.includes("ট্রাক") || q.includes("ডেলিভারি") || q.includes("logistics") || q.includes("delivery") || q.includes("truck")) {
>>>>>>> Stashed changes
      return t(
        "পেঁয়াজ সরবরাহে পরিবহন বুক করতে 'অর্ডার' সেকশন থেকে লজিস্টিক কোটেশন দেখুন এবং ট্রাক নির্বাচন করুন।",
        "To arrange transport for your onion dispatch, check the 'Orders' section to review logistics quotes and assign trucks.",
      );
    }

    if (q.includes("ভয়েস") || q.includes("মাইক") || q.includes("কথা") || q.includes("voice") || q.includes("mic") || q.includes("speak")) {
      return t(
        "বার্তা বারের মাইক্রোফোন আইকনে চাপ দিয়ে মুখে বলুন—আপনার কণ্ঠস্বর স্বয়ংক্রিয়ভাবে টেক্সটে রূপান্তরিত হবে।",
        "Tap the microphone icon next to the message bar below to convert your speech into text directly.",
      );
    }

    if (
      q.includes("সহায়তা") ||
      q.includes("সাহায্য") ||
      q.includes("help") ||
      q.includes("support") ||
      q.includes("হটলাইন")
    ) {
      return t(
        "আমাদের সাপোর্ট হটলাইন: +880 1711-234567 (সকাল ৮:০০ - রাত ১০:০০)। জরুরি পরিদর্শনে ফিল্ড এজেন্টের সাথে যোগাযোগ করুন।",
        "PeyajFlow Support Hotline: +880 1711-234567 (Daily 8:00 AM - 10:00 PM). For urgent crop inspection, contact your regional field agent.",
      );
    }

    return t(
      "ধন্যবাদ! আপনার বার্তাটি নথিভুক্ত করা হয়েছে। যেকোনো প্রশ্ন লিখে জানান বা মাইক্রোফোন চেপে সরাসরি মুখে বলুন।",
      "Thank you! Your inquiry has been noted. Feel free to type your question or tap the microphone icon to speak.",
    );
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text) return;

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

    setTimeout(() => {
      const replyText = generateBotReply(text);
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: "bot",
        text: replyText,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 600);
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
          aria-label="PeyajFlow Assistant Chat"
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
<<<<<<< Updated upstream
                  {t(
                    "সক্রিয় · বাংলায় সাহায্য প্রস্তুত",
                    "Always online · Voice ready",
                  )}
=======
                  {t("সক্রিয় · বাংলায় সাহায্য প্রস্তুত", "Always online · Speech-to-text ready")}
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
                {chip.action === "call" && (
                  <WorkspaceIcon
                    name="mic"
                    size={12}
                    className="chatbot-chip-icon"
                  />
                )}
=======
>>>>>>> Stashed changes
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
                  : t("কথা বলে লিখুন (স্পিচ-টু-টেক্সট)", "Speak to type (Speech-to-Text)")
              }
              aria-label={
                isListening
                  ? t("রেকর্ডিং বন্ধ করুন", "Stop listening")
                  : t("কথা বলে লিখুন", "Speak to type")
              }
            >
              <WorkspaceIcon name="mic" size={20} />
              <span className={`chatbot-mic-ring ${isListening ? "pulse-active" : ""}`} />
            </button>

            {/* Message Writing Input */}
            <input
              ref={inputRef}
              type="text"
              className="chatbot-text-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
<<<<<<< Updated upstream
              placeholder={t(
                "বার্তা লিখুন বা প্রশ্ন করুন...",
                "Type a message or question...",
              )}
=======
              placeholder={
                isListening
                  ? t("শুনছি... এখন কথা বলুন...", "Listening... Speak now...")
                  : t("বার্তা লিখুন বা প্রশ্ন করুন...", "Type a message or question...")
              }
>>>>>>> Stashed changes
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
