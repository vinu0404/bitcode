"use client";

import type { ReactNode } from "react";
import { FlatTrace } from "./Marks";

/** The empty and error trace: a flat line that steps once, drawn left to
 * right one time with a probe dot riding it. It settles and stays still;
 * nothing inside the app loops. */
function DrawnTrace({ color }: { color: string }) {
  const d = "M0 30H120V10H170V30H300";
  return (
    <svg width={300} height={40} viewBox="0 0 300 40" aria-hidden style={{ overflow: "visible", maxWidth: "100%" }}>
      <path d="M0 30H300" stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="2 4" fill="none" />
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} pathLength={1} className="bc-trace-draw" />
      <circle r={3.5} fill={color} className="bc-trace-probe" style={{ offsetPath: `path("${d}")` }} />
    </svg>
  );
}

/** Empty and error states: a graticule that fades out from the centre, the
 * drawn trace in the context's channel colour, one line of copy and at most
 * one action. Never an illustration. */
export function EmptyState({
  title,
  body,
  action,
  tone = "neutral",
  channel,
  extra,
  minHeight = 240,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: "neutral" | "error";
  /** CSS colour for the trace, usually a channel or status colour. */
  channel?: string;
  /** Context-specific content between the copy and the action. */
  extra?: ReactNode;
  minHeight?: number;
}) {
  const color = tone === "error" ? "var(--fail)" : channel ?? "var(--ch3)";
  return (
    <div
      style={{
        position: "relative",
        minHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 32,
        textAlign: "center",
        borderRadius: "inherit",
        overflow: "hidden",
      }}
    >
      <div
        className="graticule"
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          WebkitMaskImage: "radial-gradient(closest-side, #000 30%, transparent 100%)",
          maskImage: "radial-gradient(closest-side, #000 30%, transparent 100%)",
        }}
      />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <DrawnTrace color={color} />
        <div style={{ fontWeight: 600, fontSize: 17, color: tone === "error" ? "var(--fail-text)" : "var(--fg)" }}>{title}</div>
        {body && <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--fg-muted)", maxWidth: 420 }}>{body}</div>}
        {extra}
        {action && <div style={{ marginTop: 4 }}>{action}</div>}
      </div>
    </div>
  );
}

/** Loading: a trace sweeping across a graticule, instead of a spinner. */
export function TraceLoader({ label = "Loading", minHeight = 220 }: { label?: string; minHeight?: number }) {
  return (
    <div
      className="graticule"
      role="status"
      aria-live="polite"
      style={{ minHeight, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, borderRadius: "inherit" }}
    >
      <div style={{ position: "relative", width: 220, height: 24, overflow: "hidden" }}>
        <FlatTrace color="var(--border-strong)" />
        <div style={{ position: "absolute", inset: 0, animation: "bc-sweep 1.4s cubic-bezier(0.65,0,0.35,1) infinite" }}>
          <FlatTrace color="var(--ch3)" />
        </div>
      </div>
      <span className="mono" style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--fg-faint)", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}
