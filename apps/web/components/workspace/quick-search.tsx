"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceIcon } from "./icon";

export interface SearchItem {
  id?: string;
  name: string;
  href: string;
  icon: string;
  category: string;
  detail?: string;
  keywords?: string;
  badge?: string;
}

export function QuickSearch({
  items,
  placeholder = "Search... (Ctrl+K)",
  locale = "en",
}: {
  items: SearchItem[];
  placeholder?: string;
  locale?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isBn = locale === "bn";

  const [previousOpen, setPreviousOpen] = useState(open);
  if (open !== previousOpen) {
    setPreviousOpen(open);
    if (!open) {
      setQuery("");
      setActiveCategory("all");
      setSelectedIndex(0);
    }
  }

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  // Available distinct categories for quick-filter tabs
  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((item) => cats.add(item.category));
    return Array.from(cats);
  }, [items]);

  // Multi-field keyword and token matching
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const tokens = normalized ? normalized.split(/\s+/).filter(Boolean) : [];

    let list = items;

    // Filter by category tab if selected
    if (activeCategory !== "all") {
      list = list.filter((item) => item.category === activeCategory);
    }

    if (!tokens.length) {
      return list;
    }

    return list.filter((item) => {
      const corpus = [
        item.name,
        item.category,
        item.detail ?? "",
        item.keywords ?? "",
        item.badge ?? "",
      ]
        .join(" ")
        .toLowerCase();

      // Every typed word/token must match
      return tokens.every((token) => corpus.includes(token));
    });
  }, [items, query, activeCategory]);

  // Keep active item in view on keyboard scroll
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`,
    );
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Keyboard navigation within the dialog
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filtered.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[selectedIndex];
      if (target) {
        setOpen(false);
        router.push(target.href);
      }
    }
  };

  return (
    <>
      <button
        type="button"
        className="quick-search-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open search dialog (Ctrl+K)"
      >
        <WorkspaceIcon name="search" />
        <span className="quick-search-placeholder">{placeholder}</span>
        <kbd className="quick-search-kbd">⌘K</kbd>
      </button>

      {open && (
        <div
          className="quick-search-backdrop"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="quick-search-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="quick-search-input-wrap">
              <span className="quick-search-input-icon">
                <WorkspaceIcon name="search" />
              </span>
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                className="quick-search-input"
                placeholder={
                  isBn
                    ? "ক্রেতা, বিক্রেতা, অর্ডার নং (#ID), জাত বা পৃষ্ঠা অনুসন্ধান করুন..."
                    : "Search by buyer, seller, order #ID, variety, stock lot, or destination..."
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleInputKeyDown}
              />
              {query && (
                <button
                  type="button"
                  className="quick-search-clear"
                  onClick={() => {
                    setQuery("");
                    setSelectedIndex(0);
                  }}
                  title={isBn ? "মুছুন" : "Clear"}
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                className="quick-search-close"
                onClick={() => setOpen(false)}
                aria-label={isBn ? "বন্ধ করুন" : "Close search"}
              >
                <WorkspaceIcon name="close" />
              </button>
            </div>

            {/* Category Filter Pills Bar */}
            {categories.length > 1 && (
              <div className="quick-search-pills" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === "all"}
                  className={`quick-search-pill ${activeCategory === "all" ? "active" : ""}`}
                  onClick={() => {
                    setActiveCategory("all");
                    setSelectedIndex(0);
                  }}
                >
                  {isBn ? "সব" : "All"} ({items.length})
                </button>
                {categories.map((cat) => {
                  const count = items.filter(
                    (it) => it.category === cat,
                  ).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={activeCategory === cat}
                      className={`quick-search-pill ${activeCategory === cat ? "active" : ""}`}
                      onClick={() => {
                        setActiveCategory(cat);
                        setSelectedIndex(0);
                      }}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Results List */}
            <div ref={listRef} className="quick-search-results">
              {filtered.length > 0 ? (
                filtered.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <Link
                      key={item.id ?? `${item.href}-${idx}`}
                      href={item.href}
                      data-index={idx}
                      className={`quick-search-item ${isSelected ? "selected" : ""}`}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => setOpen(false)}
                    >
                      <span className="quick-search-item-icon">
                        <WorkspaceIcon name={item.icon} />
                      </span>
                      <div className="quick-search-item-text">
                        <div className="quick-search-item-header">
                          <strong className="quick-search-item-title">
                            {item.name}
                          </strong>
                          {item.badge && (
                            <span className="quick-search-item-badge">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.detail && (
                          <span className="quick-search-item-detail">
                            {item.detail}
                          </span>
                        )}
                      </div>
                      <span className="quick-search-item-cat">
                        {item.category}
                      </span>
                      <span
                        className="quick-search-item-arrow"
                        aria-hidden="true"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14m-6-6 6 6-6 6" />
                        </svg>
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="quick-search-empty">
                  <span className="quick-search-empty-icon">🔍</span>
                  <p>
                    {isBn
                      ? `"${query}" এর জন্য কোনো ফলাফল পাওয়া যায়নি।`
                      : `No matching items found for "${query}".`}
                  </p>
                  <small>
                    {isBn
                      ? "ক্রেতার নাম (যেমন: Nadia), অর্ডার নং (#ID), জাত (Taherpuri) অথবা জেলা (Pabna, Dhaka) দিয়ে অনুসন্ধান করুন।"
                      : "Try searching by buyer name (e.g. Nadia), order #ID, variety (Taherpuri), or district (Pabna, Dhaka)."}
                  </small>
                </div>
              )}
            </div>

            {/* Modal Footer with Keyboard Shortcuts & Status */}
            <div className="quick-search-footer">
              <span className="quick-search-count">
                {isBn
                  ? `${filtered.length} টি ফলাফল পাওয়া গেছে`
                  : `${filtered.length} items`}
              </span>
              <div className="quick-search-shortcuts">
                <span className="quick-search-key-hint">
                  <kbd>↑</kbd> <kbd>↓</kbd> {isBn ? "নেভিগেট" : "navigate"}
                </span>
                <span className="quick-search-key-hint">
                  <kbd>↵</kbd> {isBn ? "নির্বাচন" : "open"}
                </span>
                <span className="quick-search-key-hint">
                  <kbd>Esc</kbd> {isBn ? "বন্ধ" : "close"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
