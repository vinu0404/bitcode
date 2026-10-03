"use client";

import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Waveform, WaveSignal } from "@/lib/api";
import { useToast } from "./Toasts";

const NAME_COL = 140;
const ROW_H = 32;
const RULER_H = 26;
const PAD = 6; // vertical inset of a trace inside its row
const SLANT = 3; // bus hexagon edge

type Radix = "hex" | "dec" | "bin";

export interface Mismatch {
  at: number; // ns, when the failing check ran
}

export interface WaveFocus {
  t: number;
  nonce: number; // bump to re-trigger the flash at the same time
}

function fmtTime(ns: number): string {
  const r = Math.round(ns * 1000) / 1000;
  return `${Number.isInteger(r) ? r : r.toFixed(3).replace(/0+$/, "")}ns`;
}

function valueAt(sig: WaveSignal, t: number): string {
  let v = "x";
  for (const [ct, cv] of sig.changes) {
    if (ct > t) break;
    v = cv;
  }
  return v;
}

function formatValue(v: string, width: number, radix: Radix): string {
  if (width === 1) return v.toUpperCase() === "X" || v.toUpperCase() === "Z" ? v.toUpperCase() : v;
  if (/[xX]/.test(v)) return "X";
  if (/[zZ]/.test(v)) return "Z";
  const n = BigInt(`0b${v || "0"}`);
  if (radix === "bin") return v.padStart(width, "0");
  if (radix === "dec") return n.toString(10);
  return n.toString(16).toUpperCase().padStart(Math.ceil(width / 4), "0");
}

function niceStep(rangeNs: number, px: number): number {
  const target = (rangeNs / Math.max(px, 1)) * 90; // about one tick per 90px
  const pow = Math.pow(10, Math.floor(Math.log10(target || 1)));
  for (const m of [1, 2, 5, 10]) if (m * pow >= target) return m * pow;
  return 10 * pow;
}

function signalColor(sig: WaveSignal): string {
  if (sig.kind === "clock") return "var(--wave-clock)";
  if (sig.kind === "output") return "var(--wave-output)";
  return "var(--wave-input)";
}

export default function WaveformViewer({
  waveform,
  mismatches = [],
  focus,
  note,
}: {
  waveform: Waveform;
  mismatches?: Mismatch[];
  focus?: WaveFocus | null;
  note?: string;
}) {
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const end = Math.max(waveform.end_time, 1);
  const [view, setView] = useState<[number, number]>([0, end]);
  const [hover, setHover] = useState<number | null>(null);
  const [markers, setMarkers] = useState<number[]>([]);
  const [radix, setRadix] = useState<Radix>("hex");
  const [flash, setFlash] = useState<{ t: number; nonce: number } | null>(null);
  const drag = useRef<{ x: number; view: [number, number]; moved: boolean } | null>(null);
  const hasBus = waveform.signals.some((s) => s.width > 1);
  const revealKey = useMemo(() => Math.random(), [waveform]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(200, el.clientWidth - NAME_COL)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A new waveform resets the view and markers.
  useEffect(() => {
    setView([0, end]);
    setMarkers([]);
  }, [waveform, end]);

  useEffect(() => {
    if (!focus) return;
    const span = view[1] - view[0];
    const half = span / 2;
    let a = focus.t - half;
    let b = focus.t + half;
    if (a < 0) [a, b] = [0, span];
    if (b > end) [a, b] = [Math.max(0, end - span), end];
    setView([a, b]);
    setFlash({ t: focus.t, nonce: focus.nonce });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  const [t0, t1] = view;
  const x = (t: number) => ((t - t0) / (t1 - t0)) * width;
  const tAt = (px: number) => t0 + (px / width) * (t1 - t0);

  function zoom(factor: number, centre = (t0 + t1) / 2) {
    const span = Math.min(end, Math.max(0.5, (t1 - t0) * factor));
    let a = centre - (centre - t0) * (span / (t1 - t0));
    a = Math.max(0, Math.min(a, end - span));
    setView([a, a + span]);
  }

  function onWheel(e: React.WheelEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.metaKey || e.ctrlKey) {
      zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, tAt(e.clientX - rect.left));
    } else {
      const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0) * ((t1 - t0) / width);
      if (!d) return;
      const span = t1 - t0;
      const a = Math.max(0, Math.min(t0 + d, end - span));
      setView([a, a + span]);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, view, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHover(Math.max(t0, Math.min(t1, tAt(e.clientX - rect.left))));
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.moved = true;
    if (!d.moved) return;
    const span = d.view[1] - d.view[0];
    const a = Math.max(0, Math.min(d.view[0] - (dx / width) * span, end - span));
    setView([a, a + span]);
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const t = tAt(e.clientX - rect.left);
      setMarkers((m) => (m.length >= 2 ? [m[1], t] : [...m, t]));
    }
  }

  function copyTable() {
    const times = Array.from(new Set(waveform.signals.flatMap((s) => s.changes.map(([t]) => t)))).sort((a, b) => a - b);
    const head = ["time_ns", ...waveform.signals.map((s) => s.name)].join("\t");
    const rows = times.map((t) => [String(t), ...waveform.signals.map((s) => formatValue(valueAt(s, t), s.width, radix))].join("\t"));
    navigator.clipboard
      .writeText([head, ...rows].join("\n"))
      .then(() => toast({ kind: "success", title: "Copied", body: `${rows.length} rows, tab separated. Paste into a sheet.` }))
      .catch(() => toast({ kind: "error", title: "Could not copy", body: "The browser blocked clipboard access for this page." }));
  }

  const ticks = useMemo(() => {
    const step = niceStep(t1 - t0, width);
    const out: number[] = [];
    for (let t = Math.ceil(t0 / step) * step; t <= t1 + 1e-9; t += step) out.push(t);
    return out;
  }, [t0, t1, width]);

  // A failed check's band runs from when an output last changed up to the
  // check itself: the stretch where the wrong value was on the wire.
  const bands = useMemo(() => {
    const outs = waveform.signals.filter((s) => s.kind === "output");
    return mismatches.map((m) => {
      let from = 0;
      for (const s of outs) for (const [t] of s.changes) if (t <= m.at && t > from) from = t;
      return { from, to: m.at };
    });
  }, [mismatches, waveform.signals]);

  const height = RULER_H + waveform.signals.length * ROW_H;
  const cursorT = hover ?? markers[markers.length - 1] ?? null;

  return (
    <div ref={wrapRef} className="no-grain" style={{ display: "flex", flexDirection: "column", minWidth: 0, height: "100%", background: "var(--bg-sunken)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          padding: "0 12px",
          borderBottom: "1px solid var(--border)",
          flex: "none",
        }}
      >
        <ToolButton label="Zoom out" onClick={() => zoom(1.5)}>
          -
        </ToolButton>
        <ToolButton label="Zoom in" onClick={() => zoom(1 / 1.5)}>
          +
        </ToolButton>
        <ToolButton label="Fit to view" onClick={() => setView([0, end])} wide>
          Fit
        </ToolButton>
        {hasBus && (
          <div style={{ display: "flex", border: "1px solid var(--border-strong)", borderRadius: "var(--r-inline)", overflow: "hidden", marginLeft: 4 }}>
            {(["hex", "dec", "bin"] as Radix[]).map((r) => (
              <button
                key={r}
                onClick={() => setRadix(r)}
                aria-pressed={radix === r}
                className="mono"
                style={{
                  height: 24,
                  padding: "0 8px",
                  border: 0,
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  background: radix === r ? "var(--fg)" : "transparent",
                  color: radix === r ? "var(--bg)" : "var(--fg-muted)",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        )}
        <span className="mono tnum" style={{ marginLeft: 8, fontSize: 11, color: "var(--fg-muted)" }}>
          {cursorT !== null ? `T+${fmtTime(cursorT)}` : `0 to ${fmtTime(end)}`}
          {markers.length === 2 && <span style={{ color: "var(--ch3-text)", marginLeft: 12 }}>{`Δ ${fmtTime(Math.abs(markers[1] - markers[0]))}`}</span>}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {markers.length > 0 && (
            <ToolButton label="Clear markers" onClick={() => setMarkers([])} wide>
              Clear
            </ToolButton>
          )}
          <ToolButton label="Copy as table" onClick={copyTable} wide>
            Copy as table
          </ToolButton>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: 0, overflow: "auto", flex: 1 }}>
        {/* names, with the value under the cursor beside each */}
        <div style={{ width: NAME_COL, flex: "none", borderRight: "1px solid var(--border)" }}>
          <div style={{ height: RULER_H, borderBottom: "1px solid var(--border)" }} />
          {waveform.signals.map((s) => (
            <div
              key={s.name}
              className="mono"
              style={{ height: ROW_H, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "0 10px", fontSize: 12, borderBottom: "1px solid var(--border)" }}
            >
              <span style={{ color: signalColor(s), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.name}
                {s.width > 1 && <span style={{ color: "var(--fg-faint)" }}>{`[${s.width - 1}:0]`}</span>}
              </span>
              {cursorT !== null && (
                <span className="tnum" style={{ color: "var(--fg)", fontSize: 11 }}>
                  {formatValue(valueAt(s, cursorT), s.width, radix)}
                </span>
              )}
            </div>
          ))}
        </div>

        <div
          style={{ position: "relative", flex: 1, minWidth: 0, cursor: "crosshair", touchAction: "none" }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHover(null)}
        >
          <svg width={width} height={height} style={{ display: "block" }} role="img" aria-label="Simulation waveform">
            <defs>
              <pattern id="wf-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" style={{ fill: "color-mix(in srgb, var(--warn) 12%, transparent)" }} />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--warn)" strokeWidth="1.5" />
              </pattern>
              {/* First draw sweeps in left to right once, then stays static. The
                  rect is keyed by the waveform, so only a new result replays it. */}
              <clipPath id="wf-reveal">
                <rect
                  key={revealKey}
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  style={{ transformOrigin: "0 0", animation: "bc-reveal 600ms cubic-bezier(0.65,0,0.35,1) both" }}
                />
              </clipPath>
            </defs>

            {/* ruler */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={RULER_H - 6} y2={height} stroke="var(--border)" />
                <text x={x(t) + 4} y={RULER_H - 9} fontSize={11} fill="var(--fg-faint)" style={{ fontFamily: "var(--f-mono)" }}>
                  {fmtTime(t)}
                </text>
              </g>
            ))}
            <line x1={0} x2={width} y1={RULER_H - 0.5} y2={RULER_H - 0.5} stroke="var(--border)" />

            {/* mismatch bands */}
            {bands.map((b, i) => {
              const bx = x(b.from);
              const bw = Math.max(2, x(b.to) - bx);
              return (
                <g key={i}>
                  <rect x={bx} y={RULER_H} width={bw} height={height - RULER_H} style={{ fill: "color-mix(in srgb, var(--fail) 18%, transparent)" }} />
                  <line x1={bx} x2={bx} y1={RULER_H} y2={height} stroke="var(--fail)" />
                  <line x1={bx + bw} x2={bx + bw} y1={RULER_H} y2={height} stroke="var(--fail)" />
                </g>
              );
            })}

            <g clipPath="url(#wf-reveal)">
              {waveform.signals.map((s, row) => (
                <Trace key={s.name} sig={s} top={RULER_H + row * ROW_H} x={x} t0={t0} t1={t1} end={end} radix={radix} />
              ))}
            </g>

            {/* row hairlines */}
            {waveform.signals.map((s, row) => (
              <line key={s.name} x1={0} x2={width} y1={RULER_H + (row + 1) * ROW_H - 0.5} y2={RULER_H + (row + 1) * ROW_H - 0.5} stroke="var(--border)" />
            ))}

            {markers.map((m, i) => (
              <line key={i} x1={x(m)} x2={x(m)} y1={0} y2={height} stroke="var(--ch3)" strokeWidth={1.5} />
            ))}

            {flash && (
              <motion.rect
                key={flash.nonce}
                x={x(flash.t) - 3}
                y={0}
                width={6}
                height={height}
                fill="var(--ch3)"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.8, 0, 0.8, 0] }}
                transition={{ duration: 0.6, times: [0, 0.25, 0.5, 0.75, 1] }}
              />
            )}

            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={height} stroke="var(--fg-muted)" strokeDasharray="2 3" />}
          </svg>
        </div>
      </div>
      {note && (
        <div className="mono" style={{ flex: "none", padding: "6px 12px", fontSize: 11, color: "var(--fg-faint)", borderTop: "1px solid var(--border)" }}>
          {note}
        </div>
      )}
    </div>
  );
}

function ToolButton({ label, onClick, children, wide }: { label: string; onClick: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="mono"
      style={{
        height: 24,
        minWidth: 24,
        padding: wide ? "0 8px" : 0,
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-inline)",
        background: "transparent",
        color: "var(--fg-muted)",
        fontSize: 12,
      }}
    >
      {children}
    </button>
  );
}

function Trace({
  sig,
  top,
  x,
  t0,
  t1,
  end,
  radix,
}: {
  sig: WaveSignal;
  top: number;
  x: (t: number) => number;
  t0: number;
  t1: number;
  end: number;
  radix: Radix;
}) {
  const color = signalColor(sig);
  const hi = top + PAD;
  const lo = top + ROW_H - PAD;
  const mid = top + ROW_H / 2;

  // Segments [start, stop, value], clipped to the view.
  const segs: Array<[number, number, string]> = [];
  const ch = sig.changes.length ? sig.changes : [[0, "x"] as [number, string]];
  for (let i = 0; i < ch.length; i++) {
    const a = ch[i][0];
    const b = i + 1 < ch.length ? ch[i + 1][0] : end;
    if (b < t0 || a > t1 || b <= a) continue;
    segs.push([Math.max(a, t0), Math.min(b, t1), ch[i][1]]);
  }

  if (sig.width === 1) {
    const parts: React.ReactNode[] = [];
    let d = "";
    let prevY: number | null = null;
    segs.forEach(([a, b, v], i) => {
      const xa = x(a);
      const xb = x(b);
      const lv = v.toLowerCase();
      if (lv === "x") {
        parts.push(<rect key={`x${i}`} x={xa} y={hi} width={Math.max(1, xb - xa)} height={lo - hi} fill="url(#wf-hatch)" />);
        prevY = null;
        return;
      }
      if (lv === "z") {
        parts.push(<line key={`z${i}`} x1={xa} x2={xb} y1={mid} y2={mid} stroke="var(--fg-muted)" strokeDasharray="4 3" />);
        prevY = null;
        return;
      }
      const y = lv === "1" ? hi : lo;
      d += prevY === null ? `M${xa},${y}` : `L${xa},${prevY}L${xa},${y}`;
      d += `L${xb},${y}`;
      prevY = y;
    });
    return (
      <g>
        {parts}
        <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="miter" />
      </g>
    );
  }

  return (
    <g>
      {segs.map(([a, b, v], i) => {
        const xa = x(a);
        const xb = x(b);
        const w = xb - xa;
        const s = Math.min(SLANT, w / 2);
        const lv = v.toLowerCase();
        if (/z/.test(lv) && !/x/.test(lv)) {
          return <line key={i} x1={xa} x2={xb} y1={mid} y2={mid} stroke="var(--fg-muted)" strokeDasharray="4 3" />;
        }
        const pts = `${xa},${mid} ${xa + s},${hi} ${xb - s},${hi} ${xb},${mid} ${xb - s},${lo} ${xa + s},${lo}`;
        const label = formatValue(v, sig.width, radix);
        const fits = w > label.length * 7 + 10;
        const isX = /x/.test(lv);
        return (
          <g key={i}>
            <polygon points={pts} fill={isX ? "url(#wf-hatch)" : "none"} stroke={isX ? "var(--warn)" : color} strokeWidth={1.2} />
            {fits && (
              <text x={xa + w / 2} y={mid + 4} textAnchor="middle" fontSize={11} fill="var(--fg)" style={{ fontFamily: "var(--f-mono)" }}>
                {label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
