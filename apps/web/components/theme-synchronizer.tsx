"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ThemeSynchronizer() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      let theme = localStorage.getItem("pf-theme");
      if (!theme) {
        const match = document.cookie.match(/(?:^|;\s*)pf-theme=(dark|light)/);
        if (match) theme = match[1];
      }
      if (!theme) {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        theme = prefersDark ? "dark" : "light";
      }

      const root = document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
        root.setAttribute("data-theme", "dark");
      } else {
        root.classList.add("light");
        root.classList.remove("dark");
        root.setAttribute("data-theme", "light");
      }

      // Keep cookie aligned for seamless SSR between locale transitions
      document.cookie = `pf-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  }, [pathname]);

  return null;
}
