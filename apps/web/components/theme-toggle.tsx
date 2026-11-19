"use client";

import { useEffect, useState } from "react";
import { WorkspaceIcon } from "./workspace/icon";

function getResolvedTheme(): "light" | "dark" {
  try {
    const saved = localStorage.getItem("pf-theme");
    if (saved === "dark" || saved === "light") return saved;
    const match = document.cookie.match(/(?:^|;\s*)pf-theme=(dark|light)/);
    if (match) return match[1] as "light" | "dark";
    if (
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark"
    ) {
      return "dark";
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch {}
  return "light";
}

export function ThemeToggle({
  labels = { light: "Light", dark: "Dark" },
}: {
  labels?: { light: string; dark: string };
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(getResolvedTheme());

    const handleSync = () => {
      setTheme(getResolvedTheme());
    };
    window.addEventListener("themechange", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("themechange", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const toggle = (next: "light" | "dark") => {
    setTheme(next);
    try {
      localStorage.setItem("pf-theme", next);
      document.cookie = `pf-theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}

    const root = document.documentElement;
    if (next === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      root.setAttribute("data-theme", "light");
    }
    window.dispatchEvent(new Event("themechange"));
  };

  if (!mounted) {
    return (
      <div className="theme-toggle-seg" aria-hidden="true">
        <span className="theme-toggle-btn active">
          <WorkspaceIcon name="sun" />
        </span>
      </div>
    );
  }

  return (
    <div
      className="theme-toggle-seg"
      role="group"
      aria-label="Theme mode switcher"
    >
      <button
        type="button"
        className={`theme-toggle-btn ${theme === "light" ? "active" : ""}`}
        onClick={() => toggle("light")}
        title={labels.light}
        aria-label={labels.light}
        aria-pressed={theme === "light"}
      >
        <WorkspaceIcon name="sun" />
      </button>
      <button
        type="button"
        className={`theme-toggle-btn ${theme === "dark" ? "active" : ""}`}
        onClick={() => toggle("dark")}
        title={labels.dark}
        aria-label={labels.dark}
        aria-pressed={theme === "dark"}
      >
        <WorkspaceIcon name="moon" />
      </button>
    </div>
  );
}
