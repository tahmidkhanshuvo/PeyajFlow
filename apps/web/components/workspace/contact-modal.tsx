"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../lib/copy";
import { local } from "../../lib/workspace-copy";
import { WorkspaceIcon } from "./icon";

export function ContactModal({
  locale,
  base = "",
}: {
  locale: Locale;
  base?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const t = (bn: string, en: string) => local(locale, bn, en);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Lock body scroll when dialog is active
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const copyText = (text: string, key: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const contactItems = [
    {
      key: "phone",
      icon: "phone",
      title: t("হটলাইন", "Phone Hotline"),
      value: "+880 1711-234567",
      sub: t("সকাল ৮:০০ – রাত ১০:০০", "8:00 AM – 10:00 PM"),
      href: "tel:+8801711234567",
      copyable: "+8801711234567",
    },
    {
      key: "whatsapp",
      icon: "whatsapp",
      title: t("হোয়াটসঅ্যাপ", "WhatsApp"),
      value: "+880 1711-234567",
      sub: t("তাত্ক্ষণিক চ্যাট", "Instant Messaging"),
      href: "https://wa.me/8801711234567",
      target: "_blank",
      copyable: "+8801711234567",
    },
    {
      key: "email",
      icon: "mail",
      title: t("ইমেইল", "Email"),
      value: "support@peyajflow.com",
      sub: t("দাপ্তরিক জিজ্ঞাসা", "Official Inquiries"),
      href: "mailto:support@peyajflow.com",
      copyable: "support@peyajflow.com",
    },
    {
      key: "location",
      icon: "pin",
      title: t("আঞ্চলিক কেন্দ্র", "Regional Hubs"),
      value: t("পাবনা ও ঢাকা", "Pabna & Dhaka"),
      sub: t("মাঠ ও মোকাম ডেস্ক", "Field & wholesale desks"),
    },
  ];

  return (
    <>
      <button
        type="button"
        className="dash-ghost-btn"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <WorkspaceIcon name="phone" />
        <span>{t("যোগাযোগ করুন", "Contact Us")}</span>
      </button>

      {open &&
        createPortal(
          <div
            className="contact-modal-backdrop"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
          >
            <div
              className="contact-modal-dialog minimal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Minimal Clean Header */}
              <div className="contact-minimal-header">
                <h2 id="contact-modal-title" className="contact-minimal-title">
                  {t("যোগাযোগ ও সহায়তা", "Contact & Support")}
                </h2>
                <button
                  type="button"
                  className="contact-modal-close"
                  onClick={() => setOpen(false)}
                  aria-label={t("বন্ধ করুন", "Close")}
                >
                  <WorkspaceIcon name="close" size={18} />
                </button>
              </div>

              {/* Clean Minimal List (No boxes) */}
              <div className="contact-minimal-list">
                {contactItems.map((item) => (
                  <div key={item.key} className="contact-minimal-row">
                    <div className={`contact-minimal-icon is-${item.key}`}>
                      <WorkspaceIcon name={item.icon} size={18} />
                    </div>

                    <div className="contact-minimal-info">
                      <span className="contact-minimal-label">
                        {item.title}
                      </span>
                      {item.href ? (
                        <a
                          href={item.href}
                          target={item.target}
                          rel={item.target ? "noopener noreferrer" : undefined}
                          className="contact-minimal-value-link"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <span className="contact-minimal-value">
                          {item.value}
                        </span>
                      )}
                      {item.sub && (
                        <span className="contact-minimal-sub">{item.sub}</span>
                      )}
                    </div>

                    {item.copyable && (
                      <button
                        type="button"
                        className="contact-minimal-copy-btn"
                        onClick={() => copyText(item.copyable!, item.key)}
                        title={
                          copiedKey === item.key
                            ? t("কপি হয়েছে", "Copied")
                            : t("কপি করুন", "Copy")
                        }
                        aria-label={
                          copiedKey === item.key
                            ? t("কপি হয়েছে", "Copied")
                            : t("কপি করুন", "Copy")
                        }
                      >
                        <WorkspaceIcon
                          name={copiedKey === item.key ? "check" : "copy"}
                          size={15}
                        />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
