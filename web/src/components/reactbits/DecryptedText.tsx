"use client";

// Adapted from React Bits DecryptedText (see LICENSE.md in this folder).
// Trimmed to the one mode Bitcode uses: decrypt left to right once, when
// scrolled into view. Screen readers get the real text from the start, and
// reduced motion shows it with no scramble at all.

import { useEffect, useRef, useState } from "react";

const GLYPHS = "01XZ#/\\<>=_";

export default function DecryptedText({ text, speed = 28, className, style }: { text: string; speed?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [revealed, setRevealed] = useState(text.length);
  const [scramble, setScramble] = useState(text);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setRevealed(0);
    const el = ref.current;
    if (!el) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        let n = 0;
        timer = window.setInterval(() => {
          n += 1;
          setRevealed(n);
          setScramble(
            text
              .split("")
              .map((ch, i) => (i < n || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
              .join(""),
          );
          if (n >= text.length) window.clearInterval(timer);
        }, speed);
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearInterval(timer);
    };
  }, [text, speed]);

  const shown = revealed >= text.length ? text : scramble;
  return (
    <span ref={ref} className={className} style={{ whiteSpace: "pre-wrap", ...style }}>
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>{text}</span>
      <span aria-hidden>
        {shown.split("").map((ch, i) => (
          <span key={i} style={{ color: i < revealed ? undefined : "var(--fg-faint)" }}>
            {ch}
          </span>
        ))}
      </span>
    </span>
  );
}
