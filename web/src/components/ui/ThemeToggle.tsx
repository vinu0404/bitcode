"use client";

import { setTheme, useTheme } from "@/lib/theme";

export default function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "ink" ? "paper" : "ink";
  const label = theme === "ink" ? "Switch to paper theme" : "Switch to ink theme";
  return (
    <button
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      style={{
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--r-inline)",
        border: "1px solid transparent",
        background: "transparent",
        color: "var(--fg-muted)",
        flex: "none",
      }}
    >
      {/* half-filled disc: which half is filled says which theme is on */}
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d={theme === "ink" ? "M8 1.5a6.5 6.5 0 0 0 0 13z" : "M8 1.5a6.5 6.5 0 0 1 0 13z"} fill="currentColor" />
      </svg>
    </button>
  );
}
