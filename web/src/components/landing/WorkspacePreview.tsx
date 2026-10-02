"use client";

import { useEffect, useRef, useState } from "react";
import { DifficultySignal, DomainBadge } from "@/components/bc/Marks";

/* A look at the workspace for first-time visitors: a problem, code typing
   into the editor, Submit, and the verdict. It shows what using Bitcode
   feels like and nothing about how answers are checked. It plays once when
   scrolled into view and then holds the finished frame; reduced motion and
   hidden pages get the finished frame straight away. */

const CODE = [
  "module counter4 (",
  "  input  logic       clk,",
  "  input  logic       reset,",
  "  output logic [3:0] count",
  ");",
  "  always_ff @(posedge clk)",
  "    if (reset) count <= 4'd0;",
  "    else       count <= count + 4'd1;",
  "endmodule",
];
const TOTAL = CODE.join("\n").length;
const TYPE_MS = 2600;

type Phase = "idle" | "typing" | "pressed" | "checking" | "done";

export default function WorkspacePreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [chars, setChars] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const finish = () => {
      setChars(TOTAL);
      setPhase("done");
    };
    if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    const timers: number[] = [];
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setPhase("typing");
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / TYPE_MS);
          setChars(Math.round(t * TOTAL));
          if (t < 1) raf = requestAnimationFrame(step);
          else {
            timers.push(window.setTimeout(() => setPhase("pressed"), 350));
            timers.push(window.setTimeout(() => setPhase("checking"), 600));
            timers.push(window.setTimeout(() => setPhase("done"), 1500));
          }
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    // A tab hidden mid-play would freeze it: jump to the end instead.
    const onHide = () => document.hidden && (cancelAnimationFrame(raf), finish());
    document.addEventListener("visibilitychange", onHide);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  let budget = chars;
  const lines = CODE.map((l) => {
    const take = Math.max(0, Math.min(l.length, budget));
    budget -= l.length + 1;
    return l.slice(0, take);
  });
  const cursorLine = Math.max(0, lines.findLastIndex((l) => l.length > 0));
  const done = phase === "done";

  return (
    <div
      ref={ref}
      className="no-grain"
      aria-label="Preview of the Bitcode workspace"
      role="img"
      style={{
        position: "relative",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        background: "var(--bg)",
        boxShadow: "var(--shadow-float)",
        fontSize: 13,
      }}
    >
      {/* domain strip and top bar, like the real workspace */}
      <div style={{ height: 3, background: "var(--ch1)", position: "relative", overflow: "hidden" }}>
        {done && <span style={{ position: "absolute", inset: 0, width: "40%", background: "linear-gradient(90deg, transparent, #fff, transparent)", animation: "bc-pulse-strip 900ms cubic-bezier(0.65,0,0.35,1) forwards" }} />}
      </div>
      <div style={{ height: 46, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", borderBottom: "1px solid var(--border)" }}>
        <span className="mono" style={{ color: "var(--fg-muted)" }}>
          0004
        </span>
        <span style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Build a 4-bit counter with synchronous reset</span>
        <span className="bc-preview-hide">
          <DomainBadge domain="vlsi" />
        </span>
        <span className="bc-preview-hide">
          <DifficultySignal difficulty="medium" />
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <span style={{ height: 30, padding: "0 12px", display: "inline-flex", alignItems: "center", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", fontWeight: 600 }}>Run</span>
          <span
            style={{
              height: 30,
              padding: "0 14px",
              display: "inline-flex",
              alignItems: "center",
              borderRadius: "var(--r-sm)",
              background: "var(--action)",
              color: "#fff",
              fontWeight: 600,
              transform: phase === "pressed" ? "scale(0.94)" : "none",
              boxShadow: phase === "pressed" ? "0 0 0 4px color-mix(in srgb, var(--action) 30%, transparent)" : "none",
              transition: "transform 150ms, box-shadow 200ms",
            }}
          >
            Submit
          </span>
        </span>
      </div>

      <div className="bc-preview-body" style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", minHeight: 340 }}>
        {/* problem pane */}
        <div className="bc-preview-hide" style={{ padding: "18px 18px", borderRight: "1px solid var(--border)", lineHeight: 1.6, color: "var(--fg)" }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--fg-faint)", marginBottom: 10 }}>
            PROBLEM
          </div>
          <p style={{ fontSize: 13.5 }}>
            On every rising edge of <code className="bc-inline">clk</code>, if <code className="bc-inline">reset</code> is 1 the 4-bit <code className="bc-inline">count</code> becomes 0. Otherwise it counts up, wrapping from 15 to 0.
          </p>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "var(--fg-faint)", margin: "18px 0 8px" }}>
            PORTS
          </div>
          {[
            ["clk", "input", "1"],
            ["reset", "input", "1"],
            ["count", "output", "[3:0]"],
          ].map(([n, d, w]) => (
            <div key={n} className="mono" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>{n}</span>
              <span style={{ color: "var(--ch3-text)" }}>{d}</span>
              <span style={{ color: "var(--fg-muted)" }}>{w}</span>
            </div>
          ))}
        </div>

        {/* editor and result */}
        <div style={{ display: "flex", flexDirection: "column", background: "var(--bg-sunken)", minWidth: 0 }}>
          <div className="mono" style={{ height: 32, display: "flex", alignItems: "center", padding: "0 14px", fontSize: 11.5, color: "var(--fg-muted)", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
            counter4.sv
          </div>
          <pre className="mono" style={{ margin: 0, padding: "12px 0", flex: 1, fontSize: 12.5, lineHeight: "21px", overflow: "hidden" }}>
            {lines.map((l, i) => (
              <div key={i} style={{ display: "flex", padding: "0 14px" }}>
                <span style={{ width: 26, color: "var(--fg-faint)", flex: "none" }}>{i + 1}</span>
                <span style={{ whiteSpace: "pre" }}>
                  <Colour text={l} />
                  {phase === "typing" && i === cursorLine && <span style={{ display: "inline-block", width: 2, height: 15, verticalAlign: "-3px", background: "var(--fg)" }} />}
                </span>
              </div>
            ))}
          </pre>
          <div style={{ height: 64, display: "flex", alignItems: "center", gap: 14, padding: "0 16px", borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
            {phase === "checking" && (
              <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--running)", fontSize: 12, letterSpacing: "0.1em" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" style={{ animation: "bc-spin 0.9s linear infinite" }} aria-hidden>
                  <circle cx="8" cy="8" r="6.5" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" />
                  <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                CHECKING
              </span>
            )}
            {done && (
              <span className="display" style={{ display: "inline-flex", overflow: "hidden", fontSize: 30, color: "var(--pass)", lineHeight: 1 }}>
                {"ACCEPTED".split("").map((c, i) => (
                  <span key={i} style={{ display: "inline-block", animation: `bc-rise 600ms cubic-bezier(0.16,1,0.3,1) ${i * 30}ms both` }}>
                    {c}
                  </span>
                ))}
              </span>
            )}
            {(phase === "idle" || phase === "typing" || phase === "pressed") && (
              <span className="mono" style={{ fontSize: 12, color: "var(--fg-faint)", letterSpacing: "0.1em" }}>
                READY
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Editor colours for the preview's few tokens. */
function Colour({ text }: { text: string }) {
  const re = /\b(module|endmodule|always_ff|posedge|if|else)\b|\b(input|output)\b|\b(logic)\b|(\d+'d\d+|\[\d:\d\])/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const [tok, kw, dir, ty] = m;
    const style: React.CSSProperties = kw ? { color: "#D690FF" } : dir ? { color: "#7AA5FF", fontWeight: 600 } : ty ? { color: "#7AA5FF" } : { color: "#FFB347" };
    out.push(
      <span key={m.index} style={style}>
        {tok}
      </span>,
    );
    last = m.index! + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
