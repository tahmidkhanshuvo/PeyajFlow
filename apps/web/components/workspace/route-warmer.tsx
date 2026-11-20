"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export function RouteWarmer({ base }: { base: string; paths?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only pre-warm on direct user intent (hover, touch, keyboard focus)
    // This gives instant response without overloading compilation threads
    const handlePointerOver = (e: Event) => {
      const raw = e.target;
      if (!raw || typeof (raw as Element).closest !== "function") return;
      const target = (raw as Element).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (href && href.startsWith(base) && href !== pathname) {
        try {
          router.prefetch(href);
        } catch {
          // Ignore prefetch errors
        }
      }
    };

    // Instant click visual progress indicator
    const handleClick = (e: MouseEvent) => {
      const raw = e.target;
      if (!raw || typeof (raw as Element).closest !== "function") return;
      const target = (raw as Element).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (
        href &&
        href.startsWith(base) &&
        href !== pathname &&
        !target.hasAttribute("download") &&
        target.getAttribute("target") !== "_blank"
      ) {
        showProgress();
      }
    };

    document.addEventListener("pointerenter", handlePointerOver, { capture: true, passive: true });
    document.addEventListener("touchstart", handlePointerOver, { passive: true });
    document.addEventListener("focusin", handlePointerOver, { passive: true });
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("pointerenter", handlePointerOver, true);
      document.removeEventListener("touchstart", handlePointerOver);
      document.removeEventListener("focusin", handlePointerOver);
      document.removeEventListener("click", handleClick, true);
    };
  }, [base, pathname, router]);

  // Hide progress indicator once new route renders
  useEffect(() => {
    hideProgress();
  }, [pathname]);

  return null;
}

let progressEl: HTMLDivElement | null = null;
let progressTimeout: NodeJS.Timeout | null = null;

function showProgress() {
  if (typeof document === "undefined") return;
  if (!progressEl) {
    progressEl = document.createElement("div");
    progressEl.className = "workspace-route-progress";
    progressEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(progressEl);
  }
  progressEl.classList.remove("is-hiding");
  progressEl.classList.add("is-active");

  if (progressTimeout) clearTimeout(progressTimeout);
  progressTimeout = setTimeout(hideProgress, 2500);
}

function hideProgress() {
  if (progressTimeout) clearTimeout(progressTimeout);
  if (progressEl) {
    progressEl.classList.add("is-hiding");
    setTimeout(() => {
      if (progressEl && progressEl.classList.contains("is-hiding")) {
        progressEl.classList.remove("is-active", "is-hiding");
      }
    }, 150);
  }
}
