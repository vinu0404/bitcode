"use client";

import type { ReactNode } from "react";
import { StatusIcon, type StatusKind } from "@/components/bc/Status";

type Tone = "pass" | "fail" | "warn" | "accent" | "neutral";

const TONE: Record<Tone, { fg: string; icon?: StatusKind }> = {
  pass: { fg: "var(--pass)", icon: "pass" },
  fail: { fg: "var(--fail-text)", icon: "fail" },
  warn: { fg: "var(--warn)", icon: "warn" },
  accent: { fg: "var(--ch3-text)" },
  neutral: { fg: "var(--fg-muted)" },
};

/** Outlined mono label. Status tones carry their icon, so the meaning never
 * rests on colour alone. */
export default function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 22,
        padding: "0 8px",
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        borderRadius: "var(--r-inline)",
        color: t.fg,
        border: "1px solid var(--border-strong)",
        whiteSpace: "nowrap",
      }}
    >
      {t.icon && <StatusIcon kind={t.icon} size={12} />}
      {children}
    </span>
  );
}
