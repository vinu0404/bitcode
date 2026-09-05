"use client";

import type { ReactNode } from "react";

type Tone = "pass" | "fail" | "warn" | "accent" | "neutral" | "signal";

// Every border derives from its own semantic token via color-mix — not a
// literal rgba copied from one theme's hex. That literal-copy mistake is
// exactly what left every Badge border silently wrong in light mode for
// this whole session: the color read fine by itself (still a plausible
// green/red/amber), so it never LOOKED broken, it just quietly ignored
// the theme.
const MIX = (v: string) => `color-mix(in srgb, ${v} 38%, transparent)`;
const TONE: Record<Tone, { fg: string; bg: string; border: string }> = {
  pass: { fg: "var(--pass)", bg: "var(--pass-soft)", border: MIX("var(--pass)") },
  fail: { fg: "var(--fail)", bg: "var(--fail-soft)", border: MIX("var(--fail)") },
  warn: { fg: "var(--warn)", bg: "var(--warn-soft)", border: MIX("var(--warn)") },
  accent: { fg: "var(--accent-strong)", bg: "var(--accent-soft)", border: "var(--accent-border)" },
  signal: { fg: "var(--signal)", bg: "var(--signal-soft)", border: MIX("var(--signal)") },
  neutral: { fg: "var(--text-dim)", bg: "var(--surface-2)", border: "var(--border)" },
};

// A dot + label, never color alone — a colorblind reader (or a screen
// reader stripping color) still gets the text. The dot also gives Von
// Restorff punch: verdict badges read as distinct shapes, not just hue.
export default function Badge({ tone = "neutral", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  const t = TONE[tone];
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: 999,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.border}`,
        lineHeight: 1.6,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.fg, flex: "none" }} />}
      {children}
    </span>
  );
}
