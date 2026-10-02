"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./AppHeader";

/** Full-page error and 404: a dead trace across a graticule, one big word,
 * one sentence, and the ways out. */
export default function ErrorScreen({
  code,
  word,
  body,
  actions,
  detail,
}: {
  code: string;
  word: string;
  body: string;
  actions: ReactNode;
  detail?: string;
}) {
  return (
    <main className="graticule" style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", padding: "24px clamp(16px, 4vw, 48px)", overflow: "hidden" }}>
      <Link href="/" aria-label="Bitcode home" style={{ alignSelf: "flex-start" }}>
        <Wordmark size={30} />
      </Link>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, maxWidth: 900 }}>
        <p className="mono" style={{ fontSize: 12, letterSpacing: "0.2em", color: "var(--fg-faint)" }}>
          {code}
        </p>
        <h1 className="display" style={{ fontSize: "clamp(64px, 13vw, 200px)", lineHeight: 0.86 }}>
          {word}
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.5, color: "var(--fg-muted)", maxWidth: 520 }}>{body}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>{actions}</div>
        {detail && (
          <p className="mono" style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 12 }}>
            {detail}
          </p>
        )}
      </div>
      {/* the trace: a clean signal that drops dead halfway */}
      <svg viewBox="0 0 1200 80" preserveAspectRatio="none" aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: "14vh", width: "100%", height: 80 }}>
        <path d="M0 60H90V20H180V60H270V20H360V60H450V20H520L540 60H1200" fill="none" stroke="var(--fail)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pathLength={1} className="bc-trace-draw" />
      </svg>
    </main>
  );
}
