"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { Wordmark } from "@/components/bc/AppHeader";

// The Bitronics site. Set NEXT_PUBLIC_BITRONICS_URL once it is live; the
// local default points at the Bitronics site's dev server.
const BITRONICS_URL = process.env.NEXT_PUBLIC_BITRONICS_URL || "http://localhost:3010";

// Channel colours, cycled across the letters.
const LETTER_COLOURS = ["var(--ch1)", "var(--ch2)", "var(--ch3)", "var(--ch4)"];

/** Scales the giant wordmark so its letters span the footer exactly, at any
 * width: measure at a reference size, then set the size that fits. */
function useFitWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const fit = () => {
      el.style.fontSize = "100px";
      const natural = el.scrollWidth;
      const avail = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) - parseFloat(getComputedStyle(box).paddingRight);
      if (natural > 0) el.style.fontSize = `${Math.min(420, (100 * avail) / natural)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, []);
  return ref;
}

export default function SiteFooter() {
  const year = new Date().getFullYear();
  const giant = useFitWidth<HTMLSpanElement>();
  return (
    <footer className="graticule" style={{ position: "relative", borderTop: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 32, padding: "48px clamp(16px, 4vw, 48px) 32px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
          <Link href="/" aria-label="Bitcode home" style={{ alignSelf: "flex-start" }}>
            <Wordmark size={30} />
          </Link>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--fg-muted)" }}>
            Bitcode is where you practise hardware design: real problems, written in your browser, with a verdict in seconds.
          </p>
          <p style={{ fontSize: 14, color: "var(--fg)" }}>
            Made by the{" "}
            <a href={BITRONICS_URL} target="_blank" rel="noopener" className="bc-footer-link">
              Bitronics
            </a>{" "}
            team.
          </p>
        </div>
        <nav aria-label="Footer" style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "var(--fg-faint)" }}>
              BITCODE
            </span>
            <Link href="/bitcode" className="bc-footer-link">
              Problems
            </Link>
            <Link href="/bitcode/progress" className="bc-footer-link">
              Progress
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "var(--fg-faint)" }}>
              ACCOUNT
            </span>
            <Link href="/login" className="bc-footer-link">
              Log in
            </Link>
            <Link href="/register" className="bc-footer-link">
              Create account
            </Link>
          </div>
        </nav>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", padding: "0 clamp(16px, 4vw, 48px) 12px", fontSize: 12, color: "var(--fg-faint)" }}>
        <span>© {year} Bitronics</span>
      </div>

      {/* the giant wordmark, cropped by the bottom edge */}
      <a href={BITRONICS_URL} target="_blank" rel="noopener" aria-label="Visit Bitronics" className="bc-giant" style={{ display: "block", padding: "0 clamp(8px, 2vw, 24px)" }}>
        <span ref={giant} aria-hidden className="display" style={{ display: "inline-flex", whiteSpace: "nowrap", fontSize: "15vw", lineHeight: 0.8, marginBottom: "-0.12em", letterSpacing: "-0.02em" }}>
          {"BITRONICS".split("").map((c, i) => (
            <span key={i} className="bc-giant-letter" style={{ ["--c" as string]: LETTER_COLOURS[i % LETTER_COLOURS.length] }}>
              {c}
            </span>
          ))}
        </span>
      </a>
    </footer>
  );
}
