"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "../lib/copy";

export type AuthMode = "signin" | "signout";

export function triggerAuthTransition(mode: AuthMode = "signin") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pf-auth-start", { detail: { mode } }));
  }
}

export function dismissAuthTransition() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pf-auth-end"));
  }
}

export function AuthCompleted({ target }: { target: "signed" | "guest" }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pf-auth-complete", { detail: { target } }),
      );
    }
  }, [target]);
  return null;
}

export function AuthTransitionOverlay({ locale }: { locale: Locale }) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [fading, setFading] = useState(false);
  const pathname = usePathname();
  const currentPathRef = useRef(pathname);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // If the path leaves the initial pathname during transition (e.g. homepage -> workspace)
    if (active && pathname !== currentPathRef.current) {
      currentPathRef.current = pathname;
      setFading(true);
      const timer = setTimeout(() => {
        setActive(false);
        setFading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
    currentPathRef.current = pathname;
  }, [pathname, active]);

  useEffect(() => {
    function handleStart(event: Event) {
      const customEvent = event as CustomEvent<{ mode?: AuthMode }>;
      const targetMode = customEvent.detail?.mode ?? "signin";
      setMode(targetMode);
      setFading(false);
      setActive(true);

      // Safety timeout: auto-dismiss after 5s in case of unexpected network stall
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setFading(true);
        setTimeout(() => {
          setActive(false);
          setFading(false);
        }, 300);
      }, 5000);
    }

    function handleEnd() {
      if (timerRef.current) clearTimeout(timerRef.current);
      setFading(true);
      setTimeout(() => {
        setActive(false);
        setFading(false);
      }, 300);
    }

    function handleComplete(event: Event) {
      const customEvent = event as CustomEvent<{ target?: "signed" | "guest" }>;
      const target = customEvent.detail?.target;
      if (
        (mode === "signin" && target === "signed") ||
        (mode === "signout" && target === "guest") ||
        target === "signed" ||
        target === "guest"
      ) {
        if (timerRef.current) clearTimeout(timerRef.current);
        // Small graceful pause so the animation looks smooth before fading
        setTimeout(() => {
          setFading(true);
          setTimeout(() => {
            setActive(false);
            setFading(false);
          }, 300);
        }, 350);
      }
    }

    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement | null)?.closest("[data-auth-trigger]");
      if (!target) return;
      const triggerMode = (target.getAttribute("data-auth-trigger") as AuthMode) || "signin";
      handleStart(new CustomEvent("pf-auth-start", { detail: { mode: triggerMode } }));
    }

    function handleSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      const triggerMode = form.getAttribute("data-auth-trigger") as AuthMode | null;
      if (triggerMode) {
        handleStart(new CustomEvent("pf-auth-start", { detail: { mode: triggerMode } }));
      }
    }

    window.addEventListener("pf-auth-start", handleStart);
    window.addEventListener("pf-auth-end", handleEnd);
    window.addEventListener("pf-auth-complete", handleComplete);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      window.removeEventListener("pf-auth-start", handleStart);
      window.removeEventListener("pf-auth-end", handleEnd);
      window.removeEventListener("pf-auth-complete", handleComplete);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mode]);

  if (!active) return null;

  const isBn = locale === "bn";
  const title =
    mode === "signin"
      ? isBn
        ? "ওয়ার্কস্পেসে প্রবেশ করা হচ্ছে…"
        : "Signing into workspace…"
      : isBn
        ? "সাইন আউট করা হচ্ছে…"
        : "Signing out…";

  const subtitle =
    mode === "signin"
      ? isBn
        ? "পাবনা থেকে ঢাকা পেঁয়াজ সরবরাহ শৃঙ্খলা"
        : "PeyajFlow · National Onion Supply Network"
      : isBn
        ? "ওয়ার্কস্পেস সেশন সমাপ্ত হচ্ছে"
        : "Ending your secure workspace session";

  return (
    <aside
      className={`pf-auth-overlay ${fading ? "pf-auth-overlay-fadeout" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="pf-auth-modal">
        {/* Animated Peyaj (Onion) Visual */}
        <div className="pf-onion-stage" aria-hidden="true">
          <svg
            className="pf-onion-svg"
            viewBox="0 0 160 160"
            width="130"
            height="130"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="pfOnionSkinGrad"
                x1="26"
                y1="32"
                x2="134"
                y2="131"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#FB7185" />
                <stop offset="45%" stopColor="#E11D48" />
                <stop offset="100%" stopColor="#881337" />
              </linearGradient>

              <linearGradient
                id="pfOnionInnerGrad"
                x1="42"
                y1="40"
                x2="118"
                y2="125"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#FDA4AF" />
                <stop offset="55%" stopColor="#F43F5E" />
                <stop offset="100%" stopColor="#9F1239" />
              </linearGradient>

              <linearGradient
                id="pfOnionCoreGrad"
                x1="80"
                y1="64"
                x2="80"
                y2="113"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="45%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#BE123C" />
              </linearGradient>

              <linearGradient
                id="pfSproutGrad"
                x1="80"
                y1="12"
                x2="80"
                y2="36"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="50%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>

            {/* Ambient radiating ripples */}
            <circle className="pf-onion-ripple pf-onion-ripple-1" cx="80" cy="85" r="50" />
            <circle className="pf-onion-ripple pf-onion-ripple-2" cx="80" cy="85" r="65" />

            {/* Onion Bulb with floating breath */}
            <g className="pf-onion-body">
              {/* Root threads at base */}
              <g
                className="pf-onion-roots"
                stroke="#F59E0B"
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0.85"
              >
                <path d="M 72 130 C 70 137 65 143 61 147" />
                <path d="M 80 131 C 80 139 81 145 82 150" />
                <path d="M 88 130 C 90 137 95 143 99 147" />
              </g>

              {/* Outer Layer: Bulb Tunic */}
              <path
                className="pf-onion-layer pf-layer-1"
                d="M 80 32 C 67 48 26 64 26 91 C 26 115 50 131 80 131 C 110 131 134 115 134 91 C 134 64 93 48 80 32 Z"
                fill="url(#pfOnionSkinGrad)"
                fillOpacity="0.25"
                stroke="url(#pfOnionSkinGrad)"
                strokeWidth="3.2"
                strokeLinejoin="round"
              />

              {/* Mid Layer: Outer petal rings */}
              <path
                className="pf-onion-layer pf-layer-2"
                d="M 80 40 C 70 54 42 69 42 93 C 42 112 59 125 80 125 C 101 125 118 112 118 93 C 118 69 90 54 80 40 Z"
                fill="url(#pfOnionInnerGrad)"
                fillOpacity="0.32"
                stroke="url(#pfOnionInnerGrad)"
                strokeWidth="2.6"
                strokeLinejoin="round"
              />

              {/* Inner Layer */}
              <path
                className="pf-onion-layer pf-layer-3"
                d="M 80 50 C 73 62 55 75 55 95 C 55 109 66 119 80 119 C 94 119 105 109 105 95 C 105 75 87 62 80 50 Z"
                fill="url(#pfOnionInnerGrad)"
                fillOpacity="0.45"
                stroke="#FDA4AF"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />

              {/* Core Heart */}
              <path
                className="pf-onion-layer pf-layer-core"
                d="M 80 64 C 75 73 67 82 67 97 C 67 106 73 113 80 113 C 87 113 93 106 93 97 C 93 82 85 73 80 64 Z"
                fill="url(#pfOnionCoreGrad)"
                stroke="#FDE68A"
                strokeWidth="2"
                strokeLinejoin="round"
              />

              {/* Core vertical stem vein */}
              <line
                x1="80"
                y1="64"
                x2="80"
                y2="113"
                stroke="#FEF08A"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.95"
              />

              {/* Top shoots / fresh leaves */}
              <g className="pf-onion-sprout">
                <path
                  d="M 80 34 C 76 24 69 18 64 15 C 67 23 74 30 80 36"
                  fill="url(#pfSproutGrad)"
                  stroke="#10B981"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M 80 34 C 84 24 91 18 96 15 C 93 23 86 30 80 36"
                  fill="url(#pfSproutGrad)"
                  stroke="#10B981"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path d="M 79 32 L 80 14 L 81 32 Z" fill="#34D399" />
              </g>
            </g>
          </svg>
        </div>

        {/* Text and status */}
        <div className="pf-auth-status-text">
          <h3 className="pf-auth-title">{title}</h3>
          <p className="pf-auth-subtitle">{subtitle}</p>
        </div>

        {/* Indeterminate luminous progress strip */}
        <div className="pf-auth-progress-track">
          <div className="pf-auth-progress-bar" />
        </div>
      </div>
    </aside>
  );
}
