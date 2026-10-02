"use client";

import { motion } from "framer-motion";

export type StatusKind = "pass" | "fail" | "warn" | "running" | "pending" | "skipped";

export const STATUS_META: Record<StatusKind, { color: string; text: string; word: string }> = {
  pass: { color: "var(--pass)", text: "var(--pass)", word: "PASS" },
  fail: { color: "var(--fail)", text: "var(--fail-text)", word: "FAIL" },
  warn: { color: "var(--warn)", text: "var(--warn)", word: "TIME" },
  running: { color: "var(--running)", text: "var(--running)", word: "RUNNING" },
  pending: { color: "var(--fg-faint)", text: "var(--fg-faint)", word: "QUEUED" },
  skipped: { color: "var(--fg-muted)", text: "var(--fg-muted)", word: "SKIPPED" },
};

export function StatusIcon({ kind, size = 16, pop = false }: { kind: StatusKind; size?: number; pop?: boolean }) {
  const c = STATUS_META[kind].color;
  const s = size;
  let glyph: React.ReactNode;
  switch (kind) {
    case "pass":
      glyph = (
        <>
          <circle cx="8" cy="8" r="7" fill="none" stroke={c} strokeWidth="1.5" />
          <path d="M4.8 8.2l2.2 2.2 4.2-4.6" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
      break;
    case "fail":
      glyph = (
        <>
          <circle cx="8" cy="8" r="7" fill="none" stroke={c} strokeWidth="1.5" />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
      break;
    case "warn":
      glyph = (
        <>
          <path d="M8 1.8l6.6 11.7H1.4z" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 6.2v3.4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="11.6" r="0.9" fill={c} />
        </>
      );
      break;
    case "running":
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden style={{ animation: "bc-spin 0.9s linear infinite", flex: "none" }}>
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" />
          <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "pending":
      glyph = <circle cx="8" cy="8" r="6.5" fill="none" stroke={c} strokeWidth="1.5" />;
      break;
    case "skipped":
      glyph = <path d="M4 8h8" stroke={c} strokeWidth="1.6" strokeLinecap="round" />;
      break;
  }
  const svg = (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden style={{ flex: "none", display: "block" }}>
      {glyph}
    </svg>
  );
  if (!pop) return svg;
  return (
    <motion.span
      key={kind}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      style={{ display: "inline-flex", flex: "none" }}
    >
      {svg}
    </motion.span>
  );
}

/** Icon plus word, always together: status is never colour alone. */
export function StatusTag({ kind, word, pop, size = 14 }: { kind: StatusKind; word?: string; pop?: boolean; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: STATUS_META[kind].text }}>
      <StatusIcon kind={kind} size={size} pop={pop} />
      <span className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em" }}>
        {word ?? STATUS_META[kind].word}
      </span>
    </span>
  );
}

export function testStatusKind(status: string | undefined, timedOut = false): StatusKind {
  if (status === "PASS") return "pass";
  if (status === "FAIL") return "fail";
  if (status === "UNCERTAIN") return timedOut ? "warn" : "skipped";
  return "pending";
}

export function verdictKind(word: string): StatusKind {
  if (word === "ACCEPTED" || word === "PASSED") return "pass";
  if (word === "TIME LIMIT") return "warn";
  return "fail";
}
