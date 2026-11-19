"use client";
import { useState } from "react";
export function OnionPapercut({ size = 120, style }: { size?: number; style?: React.CSSProperties }) {
  const [dismissed, setDismissed] = useState(false);
  return (
    <div
      className={`onion-papercut${dismissed ? " onion-papercut--dismissed" : ""}`}
      style={style}
      onClick={() => setDismissed(true)}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" width={size} height={size} fill="none">
        <circle cx="60" cy="60" r="55" stroke="rgba(168,42,85,.35)" strokeWidth="1.5"/>
        <circle cx="60" cy="60" r="42" stroke="rgba(168,42,85,.30)" strokeWidth="1.5"/>
        <circle cx="60" cy="60" r="30" stroke="rgba(168,42,85,.25)" strokeWidth="1.5"/>
        <circle cx="60" cy="60" r="18" stroke="rgba(168,42,85,.20)" strokeWidth="1.5"/>
        <circle cx="60" cy="60" r="8" fill="rgba(168,42,85,.15)" stroke="rgba(168,42,85,.20)" strokeWidth="1"/>
        <ellipse cx="60" cy="60" rx="55" ry="30" stroke="rgba(168,42,85,.12)" strokeWidth="1" transform="rotate(30 60 60)"/>
        <ellipse cx="60" cy="60" rx="42" ry="22" stroke="rgba(168,42,85,.10)" strokeWidth="1" transform="rotate(30 60 60)"/>
      </svg>
    </div>
  );
}
