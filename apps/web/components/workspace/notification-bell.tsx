"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  markAlertRead,
  markAllAlertsRead,
} from "../../app/[locale]/workspace/operations-actions";
import type { Locale } from "../../lib/copy";
import { local } from "../../lib/workspace-copy";
import { numberLabel, timeLabel } from "../../lib/workspace-values";
import { WorkspaceIcon } from "./icon";

export type NotificationItem = {
  id: string;
  kind: string;
  resource_type: string;
  resource_id: string;
  created_at: string;
  read_at: string | null;
};

export type NotificationBellProps = {
  locale: Locale;
  base: string;
  initialUnread: number;
  initialItems: NotificationItem[];
};

const titles: Record<string, [string, string]> = {
  "offer.sent": ["নতুন অফার এসেছে", "New offer received"],
  "offer.countered": ["পাল্টা অফার এসেছে", "Counteroffer received"],
  "offer.rejected": ["অফার প্রত্যাখ্যাত", "Offer declined"],
  "offer.withdrawn": ["অফার প্রত্যাহার করা হয়েছে", "Offer withdrawn"],
  "order.confirmed": ["অর্ডার নিশ্চিত হয়েছে", "Order confirmed"],
  "order.dispatched": ["অর্ডার পাঠানো হয়েছে", "Order dispatched"],
  "order.delivered": ["অর্ডার গ্রহণ করা হয়েছে", "Order received"],
  "order.cancelled": ["অর্ডার বাতিল হয়েছে", "Order cancelled"],
  "order.expired": ["সংরক্ষণের মেয়াদ শেষ", "Reservation expired"],
  "order.disputed": ["অর্ডারে বিরোধ জানানো হয়েছে", "Order disputed"],
  "order.dispute_resolved": [
    "অর্ডারের বিরোধ নিষ্পত্তি হয়েছে",
    "Order dispute resolved",
  ],
  "payment.reported": ["অর্থপ্রদানের তথ্য জমা হয়েছে", "Payment reported"],
  "payment.verified": ["অর্থপ্রদান যাচাই হয়েছে", "Payment verified"],
  "payment.rejected": [
    "অর্থপ্রদানের তথ্য প্রত্যাখ্যাত হয়েছে",
    "Payment report rejected",
  ],
  "logistics.requested": [
    "পরিবহনের দর চাওয়া হয়েছে",
    "Transport quotes requested",
  ],
  "logistics.quote_recorded": ["পরিবহনের নতুন দর", "New transport quote"],
  "logistics.booked": [
    "পরিবহনের দর বেছে নেওয়া হয়েছে",
    "Transport quote booked",
  ],
  "logistics.cancelled": ["পরিবহন অনুরোধ বাতিল", "Transport request cancelled"],
};

function playChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

function formatNotificationTime(locale: Locale, isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = new Intl.DateTimeFormat(
      locale === "bn" ? "bn-BD" : "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: "Asia/Dhaka",
      },
    ).format(date);

    if (isToday) {
      return locale === "bn" ? `আজ ${timeStr}` : `Today ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return locale === "bn" ? `গতকাল ${timeStr}` : `Yesterday ${timeStr}`;
    }

    return timeLabel(locale, isoString);
  } catch {
    return timeLabel(locale, isoString);
  }
}

function getAvatarGlyph(kind: string): string {
  if (kind.startsWith("offer")) return "🤝";
  if (kind.startsWith("order")) return "📦";
  if (kind.startsWith("payment")) return "৳";
  if (kind.startsWith("logistics")) return "🚚";
  return "🔔";
}

export function NotificationBell({
  locale,
  base,
  initialUnread,
  initialItems,
}: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const [previousItems, setPreviousItems] = useState(initialItems);
  const [previousUnread, setPreviousUnread] = useState(initialUnread);
  if (initialItems !== previousItems || initialUnread !== previousUnread) {
    setPreviousItems(initialItems);
    setPreviousUnread(initialUnread);
    setItems(initialItems);
    setUnread(initialUnread);
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = localStorage.getItem("pf-sound-notifications");
        if (stored !== null) setSoundEnabled(stored === "true");
      } catch {
        // Keep the default if browser storage is unavailable.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Handle outside click & Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    try {
      localStorage.setItem("pf-sound-notifications", String(enabled));
    } catch {
      // Ignore
    }
    if (enabled) {
      playChime();
    }
  };

  const handleMarkAllRead = () => {
    if (unread === 0) return;
    setUnread(0);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        read_at: item.read_at || new Date().toISOString(),
      })),
    );
    startTransition(async () => {
      await markAllAlertsRead(locale);
      router.refresh();
    });
  };

  const handleItemClick = (item: NotificationItem, href: string) => {
    if (!item.read_at) {
      setUnread((prev) => Math.max(0, prev - 1));
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i,
        ),
      );
      startTransition(async () => {
        await markAlertRead(locale, item.id);
      });
    }
    setIsOpen(false);
    router.push(href);
  };

  const t = (bn: string, en: string) => local(locale, bn, en);

  const displayCount =
    unread > 99
      ? locale === "bn"
        ? "৯৯+"
        : "99+"
      : numberLabel(locale, unread);

  return (
    <div className="work-notif-container" ref={containerRef}>
      {/* Top Bar Notification Bell Button */}
      <button
        type="button"
        className={`work-icon-btn work-notif-btn ${unread > 0 ? "has-unread" : ""} ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={t(
          `বিজ্ঞপ্তি (${unread} অপঠিত)`,
          `Notifications (${unread} unread)`,
        )}
        aria-label={t(
          `বিজ্ঞপ্তি (${unread} অপঠিত)`,
          `Notifications (${unread} unread)`,
        )}
      >
        <WorkspaceIcon name="alerts" />
        {unread > 0 && (
          <span className="work-notif-badge" aria-hidden="true">
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown Popup Screen */}
      {isOpen && (
        <div
          className="work-notif-popup glass-1"
          role="dialog"
          aria-label={t("বিজ্ঞপ্তিসমূহ", "Notifications")}
        >
          {/* Header Row 1: Title & Mark All Read */}
          <div className="work-notif-header">
            <h3 className="work-notif-title">
              {t("বিজ্ঞপ্তি", "Notifications")}
            </h3>
            <button
              type="button"
              className="work-notif-mark-all"
              onClick={handleMarkAllRead}
              disabled={unread === 0}
            >
              {t("সবগুলো পঠিত চিহ্নিত করুন", "Mark all as read")}
            </button>
          </div>

          {/* Header Row 2: Unread Count Subtitle & Sound Toggle */}
          <div className="work-notif-meta-strip">
            <span className="work-notif-subtitle">
              {unread > 0
                ? t(
                    `আপনার ${numberLabel(locale, unread)}টি অপঠিত বার্তা রয়েছে`,
                    `You have ${unread} unread ${unread === 1 ? "message" : "messages"}`,
                  )
                : t("কোনো অপঠিত বার্তা নেই", "No unread messages")}
            </span>
            <label className="work-notif-sound-toggle">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => handleSoundToggle(e.target.checked)}
              />
              <span>{t("শব্দ সংকেত", "Sound")}</span>
            </label>
          </div>

          <div className="work-notif-divider" aria-hidden="true" />

          {/* Notification Items List */}
          <div className="work-notif-list">
            {items.length === 0 ? (
              <div className="work-notif-empty">
                <span className="work-notif-empty-icon" aria-hidden="true">
                  🔔
                </span>
                <p>{t("কোনো নতুন বিজ্ঞপ্তি নেই", "No notifications yet")}</p>
              </div>
            ) : (
              items.slice(0, 6).map((item) => {
                const isUnread = !item.read_at;
                const titleText = t(
                  ...(titles[item.kind] ?? [item.kind, item.kind]),
                );
                const timeText = formatNotificationTime(
                  locale,
                  item.created_at,
                );
                const href =
                  item.resource_type === "offer"
                    ? `${base}/offers/${item.resource_id}`
                    : `${base}/orders/${item.resource_id}${item.resource_type === "logistics" ? "/logistics" : ""}`;

                return (
                  <div
                    key={item.id}
                    className={`work-notif-item ${isUnread ? "unread" : "read"}`}
                    onClick={() => handleItemClick(item, href)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleItemClick(item, href);
                      }
                    }}
                  >
                    <div
                      className={`work-notif-avatar ${isUnread ? "unread" : ""}`}
                      aria-hidden="true"
                    >
                      {getAvatarGlyph(item.kind)}
                    </div>
                    <div className="work-notif-item-body">
                      <p className="work-notif-item-text">{titleText}</p>
                      <span className="work-notif-item-time">{timeText}</span>
                    </div>
                    {isUnread && (
                      <span
                        className="work-notif-item-dot"
                        aria-label={t("অপঠিত", "Unread")}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: See More -> Takes user to the alerts page */}
          <div className="work-notif-footer">
            <Link
              href={`${base}/alerts`}
              prefetch={true}
              onClick={() => setIsOpen(false)}
              className="work-notif-see-more"
            >
              {t("আরও দেখুন", "See more")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
