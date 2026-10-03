"use client";

import type { Difficulty, Domain } from "@/lib/api";
import { DIFFICULTY_LEVEL, DOMAINS } from "@/lib/domains";

export function DomainBadge({ domain, compact = false }: { domain: Domain; compact?: boolean }) {
  const d = DOMAINS[domain];
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        borderRadius: "var(--r-inline)",
        background: d.fill,
        color: "var(--on-channel)",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        flex: "none",
      }}
    >
      {compact ? d.channel : `${d.channel} ${d.label}`}
    </span>
  );
}

const BAR_HEIGHTS = [6, 10, 14];

export function DifficultySignal({ difficulty, label = true }: { difficulty: Difficulty; label?: boolean }) {
  const level = DIFFICULTY_LEVEL[difficulty] ?? 1;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }} aria-label={`Difficulty: ${difficulty}`}>
      <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 14 }} aria-hidden>
        {BAR_HEIGHTS.map((h, i) => (
          <span
            key={h}
            className={i < level ? "bc-bar bc-bar-on" : "bc-bar"}
            style={{ width: 4, height: h, borderRadius: 1 }}
          />
        ))}
      </span>
      {label && (
        <span className="mono" style={{ fontSize: 11, color: "var(--fg-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {difficulty}
        </span>
      )}
    </span>
  );
}

export function ShortcutChip({ keys }: { keys: string[] }) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }} aria-hidden>
      {keys.map((k) => (
        <kbd
          key={k}
          className="mono"
          style={{
            fontSize: 10,
            lineHeight: "14px",
            padding: "1px 5px",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-inline)",
            color: "inherit",
            opacity: 0.8,
            fontFamily: "var(--f-mono)",
            background: "transparent",
          }}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

/** Flat trace plus a single edge: the "nothing here yet" mark. */
export function FlatTrace({ width = 220, color = "var(--fg-faint)" }: { width?: number; color?: string }) {
  return (
    <svg width={width} height={24} viewBox={`0 0 ${width} 24`} aria-hidden>
      <path d={`M0 18H${width * 0.42}V6H${width * 0.58}V18H${width}`} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
