"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Locale } from "../../lib/copy";
import { local } from "../../lib/workspace-copy";
import type { Lot } from "../../lib/workspace-types";
import { numberLabel, timeLabel } from "../../lib/workspace-values";
import { LocationIcon } from "./location-icon";

export function kg(locale: Locale, value: string) {
  return `${numberLabel(locale, value)} ${local(locale, "কেজি", "kg")}`;
}

export function StockActionModal({
  locale,
  label,
  icon,
  className = "",
  children,
}: {
  locale: Locale;
  label: string;
  icon?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const t = (bn: string, en: string) => local(locale, bn, en);

  return (
    <>
      <button
        type="button"
        className={`stock-action-pill-btn ${className}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {icon && (
          <span className="stock-action-pill-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{label}</span>
      </button>

      {mounted && open &&
        createPortal(
          <div
            className="stock-modal-backdrop"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              className="stock-modal-dialog register-dialog"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="stock-modal-header">
                <h2 className="stock-modal-title">{label}</h2>
                <button
                  type="button"
                  className="stock-modal-close"
                  onClick={() => setOpen(false)}
                  aria-label={t("বন্ধ করুন", "Close")}
                >
                  ✕
                </button>
              </div>
              <div className="stock-modal-body">{children}</div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function UploadPhotoModal({
  locale,
  lotId,
  action,
}: {
  locale: Locale;
  lotId: string;
  action: (state: unknown, form: FormData) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    setFileCount(arr.length);
    setFileNames(arr.map((f) => f.name));
    if (inputRef.current) {
      const dataTransfer = new DataTransfer();
      arr.forEach((file) => dataTransfer.items.add(file));
      inputRef.current.files = dataTransfer.files;
    }
  };

  const t = (bn: string, en: string) => local(locale, bn, en);

  return (
    <>
      <button
        type="button"
        className="stock-action-pill-btn btn-upload-photo"
        onClick={() => {
          setOpen(true);
          setFileCount(0);
          setFileNames([]);
        }}
      >
        <span className="stock-action-pill-icon" aria-hidden="true">+</span>
        <span>{t("ছবি আপলোড", "Upload photo")}</span>
      </button>

      {mounted && open &&
        createPortal(
          <div
            className="stock-modal-backdrop"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              className="stock-modal-dialog upload-photo-dialog"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <form
                ref={formRef}
                action={async (formData) => {
                  setIsUploading(true);
                  try {
                    await action({}, formData);
                    setOpen(false);
                  } finally {
                    setIsUploading(false);
                  }
                }}
              >
                <input type="hidden" name="consent" value="true" />
                <input
                  type="hidden"
                  name="observed_on"
                  value={new Date().toISOString().split("T")[0]}
                />
                <input type="hidden" name="curing" value="unknown" />
                <input type="hidden" name="ventilation" value="unknown" />
                <input type="hidden" name="moisture" value="unknown" />
                <input type="hidden" name="odor" value="unknown" />
                <input type="hidden" name="visible_flags" value="no_obvious_defect" />
                <input
                  type="file"
                  ref={inputRef}
                  name="images"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => handleFiles(e.target.files)}
                />

                {/* Dropzone Matching User Uploaded Sample Image */}
                <div
                  className={`upload-dropzone-box ${isDragging ? "is-dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files);
                  }}
                  onClick={() => inputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      inputRef.current?.click();
                    }
                  }}
                >
                  {/* Stacked Cards Document Icon */}
                  <div className="upload-dropzone-icon-stack" aria-hidden="true">
                    <div className="upload-icon-card-back-left" />
                    <div className="upload-icon-card-back-right" />
                    <div className="upload-icon-card-front">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                  </div>

                  <h3 className="upload-dropzone-title">
                    {t("ছবি আপলোড করুন", "Upload files")}
                  </h3>
                  <p className="upload-dropzone-sub">
                    {t(
                      "ড্র্যাগ অ্যান্ড ড্রপ করুন অথবা ক্লিক করে ব্রাউজ করুন।",
                      "Drag & drop or click to browse.",
                    )}
                  </p>
                  <p className="upload-dropzone-format">
                    JPG, JPEG, PNG, or WEBP · {t("১ থেকে ৪টি ছবি", "1 to 4 photos, up to 3MB each")}
                  </p>

                  {fileCount > 0 && (
                    <div className="upload-selected-files-chip">
                      ✓ {fileCount} {t("টি ছবি নির্বাচিত", "photos selected")} ({fileNames.slice(0, 2).join(", ")}{fileNames.length > 2 ? "..." : ""})
                    </div>
                  )}
                </div>

                {/* Modal Footer matching sample */}
                <div className="upload-modal-footer">
                  <button
                    type="button"
                    className="upload-modal-cancel"
                    onClick={() => setOpen(false)}
                    disabled={isUploading}
                  >
                    {t("বাতিল", "Cancel")}
                  </button>
                  <button
                    type="submit"
                    className="upload-modal-submit"
                    disabled={fileCount < 1 || isUploading}
                  >
                    {isUploading
                      ? t("আপলোড হচ্ছে...", "Uploading...")
                      : t("ছবি আপলোড করুন", "Upload files")}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function RegisterLotModal({
  locale,
  label,
  children,
}: {
  locale: Locale;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="stock-register-bar">
      <StockActionModal locale={locale} label={label} icon="+">
        {children}
      </StockActionModal>
    </div>
  );
}

export function StockRowItem({
  locale,
  lot,
  base,
}: {
  locale: Locale;
  lot: Lot;
  base: string;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const isVerified = Boolean(lot.verified_kg);

  return (
    <Link
      href={`${base}/stock/${lot.id}`}
      className="stock-snackbar-row"
      aria-label={`${lot.label} - ${t("মজুত বিবরণ দেখুন", "View lot details")}`}
    >
      {/* Left: Name, Verification Badge, Location & Stored Date */}
      <div className="stock-row-primary">
        <div className="stock-row-header-wrap">
          <h3 className="stock-row-name">{lot.label}</h3>
          <span
            className={`trade-status-pill ${isVerified ? "verified" : "pending"}`}
          >
            <span className="trade-status-dot" aria-hidden="true" />
            {isVerified ? t("যাচাইকৃত", "Verified") : t("স্বঘোষিত", "Self-reported")}
          </span>
        </div>

        <div className="stock-row-meta-strip">
          <span className="stock-row-location">
            <LocationIcon size={13} />
            <span>{lot.district}</span>
          </span>
          {lot.stored_on && (
            <>
              <span className="stock-row-dot">•</span>
              <span className="stock-row-stored">
                <span className="stock-row-muted">{t("সংরক্ষিত", "Stored")}:</span>{" "}
                {timeLabel(locale, lot.stored_on)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Available Balance & Action Button */}
      <div className="stock-row-secondary">
        <div className="stock-row-balance-group">
          <span className="stock-row-balance-label">
            {t("খালি মজুত", "Available balance")}
          </span>
          <strong className="stock-row-balance-val">
            {kg(locale, lot.sellable_kg)}
          </strong>
        </div>

        <div className="stock-row-action-pill">
          <span>{t("মজুত বিবরণ", "Lot details")}</span>
          <span className="stock-row-arrow" aria-hidden="true">
            <svg
              width="13"
              height="13"
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
        </div>
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────
   SUPPLY OFFER POP-UP MODAL (Make an offer button & dialog)
   ───────────────────────────────────────────────────────────── */
export function SupplyOfferModal({
  locale,
  lotLabel,
  lotMeta,
  children,
}: {
  locale: Locale;
  lotLabel: string;
  lotMeta?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const t = (bn: string, en: string) => local(locale, bn, en);

  return (
    <>
      <button
        type="button"
        className="supply-card-offer-btn"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="supply-card-offer-icon" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span>{t("অফার লিখুন", "Make an offer")}</span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            className="stock-modal-backdrop"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              className="stock-modal-dialog supply-offer-dialog"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="stock-modal-header">
                <div className="supply-modal-title-group">
                  <h2 className="stock-modal-title">
                    {t("অফার লিখুন", "Make an offer")}
                  </h2>
                  <p className="supply-modal-subtitle">
                    {lotLabel}
                    {lotMeta ? ` · ${lotMeta}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="stock-modal-close"
                  onClick={() => setOpen(false)}
                  aria-label={t("বন্ধ করুন", "Close")}
                >
                  ✕
                </button>
              </div>
              <div className="stock-modal-body">{children}</div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

