"use client";

import { pad2 } from "@/lib/domains";

/** Numbered steps joined by hairlines. The whole sequence stays visible;
 * on narrow screens only the current step keeps its label, so nothing
 * overlaps. Steps up to `reachable` can be clicked when `onSelect` is set. */
export default function Stepper({
  steps,
  current,
  onSelect,
  reachable = current,
}: {
  steps: string[];
  current: number;
  onSelect?: (i: number) => void;
  reachable?: number;
}) {
  return (
    <ol className="bc-stepper" style={{ display: "flex", alignItems: "center", margin: "0 0 28px", padding: 0, listStyle: "none" }}>
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        const clickable = !!onSelect && i <= reachable && i !== current;
        const inner = (
          <>
            <span
              className="mono"
              style={{
                width: 26,
                height: 26,
                flex: "none",
                display: "grid",
                placeItems: "center",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                border: `1.5px solid ${state === "active" ? "var(--ch3)" : state === "done" ? "var(--fg)" : "var(--border-strong)"}`,
                background: state === "done" ? "var(--fg)" : "transparent",
                color: state === "done" ? "var(--bg)" : state === "active" ? "var(--ch3-text)" : "var(--fg-faint)",
              }}
            >
              {state === "done" ? (
                <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                pad2(i + 1)
              )}
            </span>
            <span className={state === "active" ? "bc-step-label bc-step-active" : "bc-step-label"} style={{ fontSize: 13, fontWeight: state === "active" ? 600 : 500, color: state === "pending" ? "var(--fg-faint)" : "var(--fg)", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </>
        );
        return (
          <li key={label} style={{ display: "flex", alignItems: "center", flex: i === steps.length - 1 ? "none" : 1, minWidth: 0 }} aria-current={state === "active" ? "step" : undefined}>
            {clickable ? (
              <button type="button" onClick={() => onSelect!(i)} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: 0, padding: 0, background: "transparent", flex: "none" }}>
                {inner}
              </button>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "none", opacity: !onSelect || i <= reachable ? 1 : 0.6 }}>{inner}</span>
            )}
            {i < steps.length - 1 && <span style={{ flex: 1, minWidth: 12, height: 1, margin: "0 10px", background: i < current ? "var(--fg)" : "var(--border-strong)" }} />}
          </li>
        );
      })}
    </ol>
  );
}
