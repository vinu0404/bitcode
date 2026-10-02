"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ConsoleLine, GradeResponse, TestStatus, Waveform } from "@/lib/api";
import { pad2 } from "@/lib/domains";
import Tabs from "@/components/bc/Tabs";
import { EmptyState, TraceLoader } from "@/components/bc/States";
import { STATUS_META, StatusTag, testStatusKind, verdictKind, type StatusKind } from "@/components/bc/Status";
import WaveformViewer, { type WaveFocus } from "@/components/bc/WaveformViewer";
import Button, { PlayIcon } from "@/components/ui/Button";

export type ResultsTab = "tests" | "console" | "waveform";

export interface TestRow {
  number: number;
  id: string;
  visible: boolean;
  name: string | null;
  status: TestStatus | "QUEUED";
  exp: string | null;
  got: string | null;
  at_ns: number | null;
}

export interface ResultsModel {
  kind: "run" | "submit" | null;
  phase: "idle" | "running" | "done" | "error";
  error?: { kind: "error" | "warn"; title: string; body: string; retryable: boolean };
  verdictWord?: string;
  timedOut?: boolean;
  rows: TestRow[];
  durationMs?: number;
  console: ConsoleLine[];
  note?: string;
  ai?: GradeResponse["ai_feedback"];
  seq: number; // bumps on every new result, to replay the reveal
}

const STAGGER_MS = 60;

function rowKind(r: TestRow, revealed: boolean, phase: ResultsModel["phase"], timedOut?: boolean): StatusKind {
  if (phase === "running") return "running";
  if (r.status === "QUEUED") return "pending";
  if (!revealed) return "running";
  return testStatusKind(r.status, timedOut);
}

/** Per-letter rise, 26ms apart. */
function VerdictWord({ word, seq }: { word: string; seq: number }) {
  const kind = verdictKind(word);
  return (
    <span
      key={`${word}-${seq}`}
      className="display"
      aria-label={word}
      style={{ display: "inline-flex", fontSize: 22, color: STATUS_META[kind].text, overflow: "hidden", lineHeight: 1, paddingTop: 2 }}
    >
      {word.split("").map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ y: "110%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: i * 0.026, duration: 0.7 - Math.min(i * 0.026, 0.4), ease: [0.16, 1, 0.3, 1] }}
          style={{ display: "inline-block", whiteSpace: "pre" }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

export default function ResultsPane({
  model,
  tab,
  onTab,
  waveform,
  mismatches,
  waveNote,
  waveFocus,
  onShowInWaveform,
  onRevealLine,
  mod,
  collapsed,
  onToggleCollapsed,
  fileName,
  onRun,
  onRetry,
  channel,
}: {
  model: ResultsModel;
  tab: ResultsTab;
  onTab: (t: ResultsTab) => void;
  waveform: Waveform | null;
  mismatches: { at: number }[];
  waveNote?: string;
  waveFocus: WaveFocus | null;
  onShowInWaveform: (t: number) => void;
  onRevealLine: (line: number) => void;
  mod: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  fileName: string;
  onRun: () => void;
  onRetry: () => void;
  channel: string;
}) {
  // Rows resolve top-down, STAGGER_MS apart, after each new result.
  const [revealed, setRevealed] = useState(model.rows.length);
  useEffect(() => {
    if (model.phase !== "done") {
      setRevealed(0);
      return;
    }
    setRevealed(0);
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setRevealed(n);
      if (n >= model.rows.length) window.clearInterval(id);
    }, STAGGER_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.seq, model.phase]);

  const done = model.phase === "done";
  const resolved = model.rows.filter((r) => r.status !== "QUEUED");
  const passed = resolved.filter((r) => r.status === "PASS").length;
  const consoleErrors = model.console.filter((c) => c.level === "error").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "var(--bg)" }}>
      <Tabs<ResultsTab>
        items={[
          { id: "tests", label: "Tests", count: model.rows.length, shortcut: `${mod}1` },
          { id: "console", label: "Console", count: model.console.length || undefined, shortcut: `${mod}2` },
          { id: "waveform", label: "Waveform", shortcut: `${mod}3` },
        ]}
        active={tab}
        onChange={(t) => {
          if (collapsed) onToggleCollapsed();
          onTab(t);
        }}
        trailing={
          <>
            {done && model.verdictWord && <VerdictWord word={model.verdictWord} seq={model.seq} />}
            {done && model.rows.length > 0 && (
              <span className="mono tnum" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                {pad2(passed)} / {pad2(model.rows.length)}
                {model.durationMs !== undefined && <span style={{ color: "var(--fg-faint)", marginLeft: 10 }}>{model.durationMs}ms</span>}
              </span>
            )}
            {model.phase === "running" && <StatusTag kind="running" />}
            <button
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Show results" : "Hide results"}
              title={`${collapsed ? "Show" : "Hide"} results (${mod}J)`}
              style={{ width: 28, height: 28, border: 0, background: "transparent", color: "var(--fg-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>
                <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </>
        }
      />
      {!collapsed && (
        <div style={{ flex: 1, minHeight: 0, overflow: tab === "waveform" ? "hidden" : "auto" }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ height: tab === "waveform" ? "100%" : undefined }}>
              {tab === "tests" && (
                <TestsTab model={model} revealed={revealed} passed={passed} onShowInWaveform={waveform ? onShowInWaveform : undefined} onRetry={onRetry} mod={mod} />
              )}
              {tab === "console" && (
                <ConsoleTab lines={model.console} running={model.phase === "running"} onRevealLine={onRevealLine} errors={consoleErrors} fileName={fileName} onRun={onRun} mod={mod} channel={channel} />
              )}
              {tab === "waveform" &&
                (waveform ? (
                  <WaveformViewer waveform={waveform} mismatches={mismatches} focus={waveFocus} note={waveNote} />
                ) : model.phase === "running" ? (
                  <TraceLoader label="Simulating" />
                ) : (
                  <EmptyState
                    channel={channel}
                    title="No waveform yet"
                    body="Run the visible tests to see every port over time, with the failing stretch marked in red."
                    action={
                      <Button variant="secondary" size="sm" icon={<PlayIcon />} shortcut={[mod, "⏎"]} onClick={onRun}>
                        Run
                      </Button>
                    }
                  />
                ))}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TestsTab({
  model,
  revealed,
  passed,
  onShowInWaveform,
  onRetry,
  mod,
}: {
  model: ResultsModel;
  revealed: number;
  passed: number;
  onShowInWaveform?: (t: number) => void;
  onRetry: () => void;
  mod: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setOpen(null), [model.seq]);

  if (model.phase === "error") {
    const e = model.error;
    return (
      <EmptyState
        tone={e?.kind === "warn" ? "neutral" : "error"}
        channel={e?.kind === "warn" ? "var(--warn)" : undefined}
        title={e?.title ?? "Something went wrong"}
        body={e?.body}
        action={
          e?.retryable ? (
            <Button variant="secondary" size="sm" onClick={onRetry} shortcut={model.kind === "submit" ? [mod, "⇧", "⏎"] : [mod, "⏎"]}>
              {model.kind === "submit" ? "Submit again" : "Run again"}
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (!model.rows.length) {
    return <EmptyState title="No tests to show" />;
  }
  const done = model.phase === "done";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px 12px", borderBottom: "1px solid var(--border)" }}>
        <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.06em" }}>
          {done ? `${pad2(passed)} / ${pad2(model.rows.length)} PASSED` : model.phase === "running" ? "RUNNING" : `${pad2(model.rows.length)} QUEUED`}
        </span>
        <div style={{ flex: 1, display: "flex", gap: 2, height: 6 }} aria-hidden>
          {model.rows.map((r, i) => {
            const k = rowKind(r, i < revealed, model.phase, model.timedOut);
            const fill = k === "pass" ? "var(--pass)" : k === "fail" ? "var(--fail)" : k === "warn" ? "var(--warn)" : k === "skipped" ? "var(--fg-faint)" : null;
            return (
              <span key={r.id} style={{ flex: 1, borderRadius: 1, background: "var(--border)", overflow: "hidden" }}>
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: fill ? "100%" : "0%",
                    background: fill ?? "transparent",
                    transition: "width 200ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                />
              </span>
            );
          })}
        </div>
        {done && model.durationMs !== undefined && (
          <span className="mono tnum" style={{ fontSize: 12, color: "var(--fg-faint)" }}>
            {model.durationMs}ms
          </span>
        )}
      </div>

      {model.rows.map((r, i) => {
        const isRevealed = i < revealed;
        const kind = rowKind(r, isRevealed, model.phase, model.timedOut);
        const expandable = r.visible && r.status === "FAIL" && r.exp !== null && isRevealed;
        const isOpen = open === r.id && expandable;
        return (
          <div
            key={`${model.seq}-${r.id}`}
            style={{
              borderBottom: "1px solid var(--border)",
              animation: kind === "fail" && isRevealed ? "bc-shake 360ms cubic-bezier(0.16,1,0.3,1)" : undefined,
            }}
          >
            <button
              onClick={() => expandable && setOpen(isOpen ? null : r.id)}
              aria-expanded={expandable ? isOpen : undefined}
              disabled={!expandable}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "92px 72px minmax(0, 1fr) auto 14px",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                border: 0,
                background: "transparent",
                textAlign: "left",
                cursor: expandable ? "pointer" : "default",
                opacity: 1,
              }}
            >
              <StatusTag kind={kind} pop={isRevealed && done} word={kind === "warn" ? "TIME" : undefined} />
              <span className="mono tnum" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                TEST {pad2(r.number)}
              </span>
              <span style={{ fontSize: 14, color: r.visible ? "var(--fg)" : "var(--fg-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.visible ? r.name : "Hidden test"}
              </span>
              <span className="mono tnum" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                {r.at_ns !== null && isRevealed ? `T+${r.at_ns}ns` : ""}
              </span>
              <span aria-hidden style={{ color: "var(--fg-faint)", visibility: expandable ? "visible" : "hidden", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 200ms" }}>
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M3 1.5L7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: "hidden" }}>
                  <Diff exp={r.exp ?? ""} got={r.got ?? ""} />
                  {onShowInWaveform && r.at_ns !== null && (
                    <div style={{ padding: "0 16px 14px 120px" }}>
                      <button
                        onClick={() => onShowInWaveform(r.at_ns as number)}
                        style={{ border: 0, background: "transparent", padding: 0, color: "var(--ch3-text)", fontSize: 13, fontWeight: 600 }}
                      >
                        Show in waveform
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {model.note && <p style={{ padding: "12px 16px", fontSize: 13, color: "var(--fg-muted)" }}>{model.note}</p>}

      {model.ai && model.ai.generated && (
        <section style={{ margin: "8px 16px 20px", padding: "14px 16px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
          <h3 className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "var(--fg-faint)", marginBottom: 8 }}>
            FEEDBACK
          </h3>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>{model.ai.summary}</p>
          {model.ai.hint && <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 8, color: "var(--fg-muted)" }}>{model.ai.hint}</p>}
          <p style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 10 }}>Written by AI from the simulator results. The verdict itself comes from the simulator.</p>
        </section>
      )}
    </div>
  );
}

/** EXPECTED and GOT side by side, the first differing character underlined. */
function Diff({ exp, got }: { exp: string; got: string }) {
  let i = 0;
  while (i < exp.length && i < got.length && exp[i] === got[i]) i++;
  const cell: React.CSSProperties = { padding: "10px 12px", minWidth: 0 };
  const lab: React.CSSProperties = { fontFamily: "var(--f-mono)", fontSize: 10.5, letterSpacing: "0.16em", color: "var(--fg-faint)", marginBottom: 4 };
  return (
    <div style={{ margin: "0 16px 12px 120px", display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
      <div style={{ ...cell, borderRight: "1px solid var(--border)" }}>
        <div style={lab}>EXPECTED</div>
        <div className="mono" style={{ fontSize: 13, wordBreak: "break-all" }}>
          {exp}
        </div>
      </div>
      <div style={cell}>
        <div style={lab}>GOT</div>
        <div className="mono" style={{ fontSize: 13, wordBreak: "break-all" }}>
          {got.slice(0, i)}
          <span style={{ textDecoration: "underline", textDecorationColor: "var(--fail)", textDecorationThickness: 2, textUnderlineOffset: 3, color: "var(--fail-text)" }}>
            {got.slice(i, i + 1) || " "}
          </span>
          {got.slice(i + 1)}
        </div>
      </div>
    </div>
  );
}

function ConsoleTab({
  lines,
  running,
  onRevealLine,
  errors,
  fileName,
  onRun,
  mod,
  channel,
}: {
  lines: ConsoleLine[];
  running: boolean;
  onRevealLine: (line: number) => void;
  errors: number;
  fileName: string;
  onRun: () => void;
  mod: string;
  channel: string;
}) {
  if (running) return <TraceLoader label="Compiling and simulating" />;
  if (!lines.length) return <EmptyState
        channel={channel}
        title="Console is empty"
        body="Messages about your code appear here after a Run: errors with the line they point at, and each check as it passes."
        action={
          <Button variant="secondary" size="sm" icon={<PlayIcon />} shortcut={[mod, "⏎"]} onClick={onRun}>
            Run
          </Button>
        }
      />;
  return (
    <div className="no-grain mono" role="log" aria-label={`Console, ${errors} errors`} style={{ fontSize: 13, lineHeight: 1.6, padding: "8px 0", background: "var(--bg-sunken)", minHeight: "100%" }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "64px 36px minmax(0, 1fr)",
            gap: 10,
            padding: "2px 14px",
            borderLeft: `2px solid ${l.level === "error" ? "var(--fail)" : "transparent"}`,
          }}
        >
          <span className="tnum" style={{ color: "var(--fg-faint)" }}>
            [{l.time}]
          </span>
          <span style={{ color: "var(--fg-muted)", fontWeight: 600 }}>{l.source}</span>
          <span style={{ color: l.level === "error" ? "var(--fail-text)" : l.level === "warn" ? "var(--warn)" : "var(--fg)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {l.line !== null && (
              <button
                onClick={() => onRevealLine(l.line as number)}
                style={{ border: 0, padding: 0, marginRight: 8, background: "transparent", color: "var(--ch3-text)", textDecoration: "underline", textUnderlineOffset: 2, font: "inherit" }}
              >
                {fileName}:{l.line}
              </button>
            )}
            {l.line !== null ? l.text.replace(/^Line \d+:\s*/, "") : l.text}
          </span>
        </div>
      ))}
    </div>
  );
}
