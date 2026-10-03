"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DifficultySignal, DomainBadge } from "@/components/bc/Marks";

/* A look at the workspace for first-time visitors, acted out by a cursor:
   the code types in, the cursor clicks Run (the quick check), then Submit
   (the real one), and the verdict lands. A rail under the window names each
   step as it happens. It shows how the product is used, never how answers
   are checked.

   It plays once when scrolled into view and holds the last frame; Replay
   runs it again on request. Reduced motion and hidden pages get the
   finished frame straight away. */

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
const TYPE_MS = 2400;

type Phase =
  | "idle"
  | "typing"
  | "toRun" // cursor travels to Run
  | "clickRun"
  | "running"
  | "ran"
  | "toSubmit"
  | "clickSubmit"
  | "checking"
  | "done";

// Milliseconds after typing finishes.
const SCRIPT: Array<[number, Phase]> = [
  [250, "toRun"],
  [1000, "clickRun"],
  [1200, "running"],
  [2100, "ran"],
  [3100, "toSubmit"],
  [3850, "clickSubmit"],
  [4050, "checking"],
  [5000, "done"],
];

const ORDER: Phase[] = ["idle", "typing", "toRun", "clickRun", "running", "ran", "toSubmit", "clickSubmit", "checking", "done"];
const at = (p: Phase, q: Phase) => ORDER.indexOf(p) >= ORDER.indexOf(q);

export default function WorkspacePreview() {
  const rootRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<HTMLSpanElement>(null);
  const submitRef = useRef<HTMLSpanElement>(null);
  const [chars, setChars] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [ripple, setRipple] = useState(0);
  const timers = useRef<number[]>([]);
  const raf = useRef(0);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelAnimationFrame(raf.current);
  };

  const finish = useCallback(() => {
    clear();
    setChars(TOTAL);
    setPhase("done");
  }, []);

  const play = useCallback(() => {
    clear();
    setChars(0);
    setPhase("typing");
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TYPE_MS);
      setChars(Math.round(t * TOTAL));
      if (t < 1) raf.current = requestAnimationFrame(step);
      else for (const [ms, p] of SCRIPT) timers.current.push(window.setTimeout(() => setPhase(p), ms));
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  // Start once, the first time the window is properly in view.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        play();
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    // A tab hidden mid-play would freeze it: jump to the end instead.
    const onHide = () => document.hidden && finish();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      io.disconnect();
      clear();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [play, finish]);

  // Where the cursor should be for the current phase, in px from the root.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const place = () => {
      const r = root.getBoundingClientRect();
      const centre = (el: HTMLElement | null) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.left - r.left + b.width * 0.55, y: b.top - r.top + b.height * 0.6 };
      };
      if (phase === "idle" || phase === "typing") setCursor({ x: r.width * 0.72, y: r.height * 0.7 });
      else if (at(phase, "toSubmit")) setCursor(centre(submitRef.current));
      else if (at(phase, "toRun")) setCursor(centre(runRef.current));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [phase]);

  useEffect(() => {
    if (phase === "clickRun" || phase === "clickSubmit") setRipple((n) => n + 1);
  }, [phase]);

  let budget = chars;
  const lines = CODE.map((l) => {
    const take = Math.max(0, Math.min(l.length, budget));
    budget -= l.length + 1;
    return l.slice(0, take);
  });
  const cursorLine = Math.max(0, lines.findLastIndex((l) => l.length > 0));
  const done = phase === "done";
  const pressing = phase === "clickRun" || phase === "clickSubmit";
  const step = at(phase, "toSubmit") ? 3 : at(phase, "toRun") ? 2 : 1;
  const showCursor = phase !== "idle" && !done;

  return (
    <div>
      <div
        ref={rootRef}
        className="no-grain"
        aria-label="Preview: write the code, press Run to check it, then Submit for the verdict"
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
        <div style={{ height: 50, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", borderBottom: "1px solid var(--border)" }}>
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
            <FakeButton refEl={runRef} kind="secondary" busy={phase === "running"} busyLabel="Running" pressed={phase === "clickRun"} glow={phase === "toRun" || phase === "clickRun"}>
              <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                <path d="M3 1.8v8.4L10 6z" fill="currentColor" />
              </svg>
              Run
            </FakeButton>
            <FakeButton refEl={submitRef} kind="primary" busy={phase === "checking"} busyLabel="Grading" pressed={phase === "clickSubmit"} glow={phase === "toSubmit" || phase === "clickSubmit"}>
              Submit
            </FakeButton>
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

          {/* editor and result strip */}
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
              <ResultStrip phase={phase} />
            </div>
          </div>
        </div>

        {/* the cursor acting it out */}
        {cursor && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${cursor.x}px, ${cursor.y}px)`,
              transition: "transform 720ms cubic-bezier(0.65,0,0.35,1), opacity 300ms",
              opacity: showCursor ? 1 : 0,
              pointerEvents: "none",
              zIndex: 5,
            }}
          >
            {ripple > 0 && (pressing || phase === "running" || phase === "checking") && (
              <span
                key={ripple}
                style={{
                  position: "absolute",
                  left: -16,
                  top: -16,
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  border: "2px solid var(--ch3)",
                  animation: "bc-click-ripple 600ms cubic-bezier(0.16,1,0.3,1) forwards",
                }}
              />
            )}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              style={{ display: "block", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))", transform: pressing ? "scale(0.82)" : "scale(1)", transformOrigin: "4px 3px", transition: "transform 140ms" }}
            >
              <path d="M4 3l15 8.2-6.6 1.6 3.7 7-2.9 1.5-3.7-7L4 19z" fill="#F2EFE8" stroke="#0B0E1A" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* what is happening, in three words */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        {[
          ["01", "Write your module"],
          ["02", "Run to check it"],
          ["03", "Submit for the verdict"],
        ].map(([n, text], i) => {
          const on = step === i + 1 && phase !== "idle" && !done;
          const past = step > i + 1 || done;
          return (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                className="mono"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 32,
                  padding: "0 12px",
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: `1px solid ${on ? "var(--ch3)" : past ? "color-mix(in srgb, var(--pass) 50%, transparent)" : "var(--border)"}`,
                  background: on ? "color-mix(in srgb, var(--ch3) 14%, transparent)" : "transparent",
                  color: on ? "var(--fg)" : past ? "var(--pass)" : "var(--fg-faint)",
                  transition: "all 300ms",
                }}
              >
                {n}
                <span style={{ fontFamily: "var(--f-sans)", fontWeight: 600 }}>{text}</span>
              </span>
              {i < 2 && <span aria-hidden style={{ width: 18, height: 1, background: past ? "var(--pass)" : "var(--border-strong)" }} />}
            </div>
          );
        })}
        {done && (
          <button
            onClick={play}
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", border: "1px solid var(--border-strong)", borderRadius: 999, background: "transparent", color: "var(--fg-muted)", fontSize: 13, fontWeight: 600 }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
              <path d="M2.5 7a4.5 4.5 0 1 0 1.4-3.3M2.5 2v2.5H5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Replay
          </button>
        )}
      </div>
    </div>
  );
}

function FakeButton({
  refEl,
  kind,
  busy,
  busyLabel,
  pressed,
  glow,
  children,
}: {
  refEl: React.RefObject<HTMLSpanElement | null>;
  kind: "primary" | "secondary";
  busy: boolean;
  busyLabel: string;
  pressed: boolean;
  glow: boolean;
  children: React.ReactNode;
}) {
  const primary = kind === "primary";
  return (
    <span
      ref={refEl}
      style={{
        position: "relative",
        height: 32,
        padding: "0 14px",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        borderRadius: "var(--r-sm)",
        border: primary ? "1px solid transparent" : "1px solid var(--border-strong)",
        background: primary ? "var(--action)" : "transparent",
        color: primary ? "#fff" : "var(--fg)",
        fontWeight: 600,
        transform: pressed ? "scale(0.94)" : "none",
        boxShadow: glow ? `0 0 0 4px color-mix(in srgb, ${primary ? "var(--action)" : "var(--fg)"} ${primary ? 30 : 14}%, transparent)` : "none",
        transition: "transform 140ms, box-shadow 250ms",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, visibility: busy ? "hidden" : "visible" }}>{children}</span>
      {busy && (
        <span style={{ position: "absolute", inset: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5 }}>
          <Spinner /> {busyLabel}
        </span>
      )}
    </span>
  );
}

function Spinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" style={{ animation: "bc-spin 0.9s linear infinite" }} aria-hidden>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.6" />
      <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ResultStrip({ phase }: { phase: Phase }) {
  const tag = (color: string, text: string, icon?: React.ReactNode) => (
    <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 8, color, fontSize: 12, letterSpacing: "0.1em", fontWeight: 600 }}>
      {icon}
      {text}
    </span>
  );
  if (phase === "running") return tag("var(--running)", "RUNNING", <Spinner />);
  if (phase === "ran" || phase === "toSubmit" || phase === "clickSubmit")
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
        {tag(
          "var(--pass)",
          "PASS",
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4.8 8.2l2.2 2.2 4.2-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>,
        )}
        <span style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>Run passed. Ready to submit.</span>
      </span>
    );
  if (phase === "checking") return tag("var(--running)", "CHECKING", <Spinner />);
  if (phase === "done")
    return (
      <span className="display" style={{ display: "inline-flex", overflow: "hidden", fontSize: 30, color: "var(--pass)", lineHeight: 1 }}>
        {"ACCEPTED".split("").map((c, i) => (
          <span key={i} style={{ display: "inline-block", animation: `bc-rise 600ms cubic-bezier(0.16,1,0.3,1) ${i * 30}ms both` }}>
            {c}
          </span>
        ))}
      </span>
    );
  return tag("var(--fg-faint)", phase === "typing" ? "WRITING" : "READY");
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
