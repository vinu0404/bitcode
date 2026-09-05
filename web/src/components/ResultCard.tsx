"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { GradeResponse } from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { scaleIn } from "@/components/ui/motion";

const VERDICT: Record<string, { tone: "pass" | "fail" | "warn" | "neutral"; label: string }> = {
  CORRECT: { tone: "pass", label: "Correct" },
  PARTIAL: { tone: "warn", label: "Partial" },
  INCORRECT: { tone: "fail", label: "Incorrect" },
  NEEDS_VERIFICATION: { tone: "neutral", label: "Needs verification" },
};

// Peak-End Rule: the moment a submission resolves is the "end" of this
// attempt — worth a beat of motion, not a flat text swap. A count-up
// score reads as the system actively arriving at the number, not just
// printing it.
function useCountUp(target: number, durationMs = 550) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

export default function ResultCard({ result }: { result: GradeResponse }) {
  const verdict = VERDICT[result.verdict] ?? VERDICT.NEEDS_VERIFICATION;
  const sim = result.simulation;
  const failed = sim?.tests.filter((t) => t.status !== "PASS") ?? [];
  const score = useCountUp(result.score?.total ?? 0);
  const isPerfect = result.verdict === "CORRECT";

  return (
    <motion.div variants={scaleIn} initial="hidden" animate="show">
      <Card
        style={{
          overflow: "hidden",
          boxShadow: isPerfect
            ? "0 0 0 1px color-mix(in srgb, var(--pass) 30%, transparent), 0 12px 32px -10px color-mix(in srgb, var(--pass) 25%, transparent)"
            : "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: "var(--text-faint)", textTransform: "uppercase" }}>
              Simulation Result
            </span>
            <Badge tone={verdict.tone}>{verdict.label}</Badge>
          </div>
          {result.score && (
            <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: isPerfect ? "var(--pass)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
              {score}
              <span style={{ fontSize: 15, color: "var(--text-faint)", fontWeight: 500 }}> / 100</span>
            </div>
          )}
        </div>

        {sim && (
          <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "14px 20px", flexWrap: "wrap" }}>
            {sim.tests.map((t, i) => (
              <motion.span
                key={t.id}
                initial={{ scaleY: 0.3, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                title={`${t.id}: ${t.status}`}
                style={{
                  width: 22,
                  height: 7,
                  borderRadius: 2,
                  background: t.status === "PASS" ? "var(--pass)" : t.status === "FAIL" ? "var(--fail)" : "var(--warn)",
                }}
              />
            ))}
            <span className="mono" style={{ fontSize: 11.5, color: "var(--text-dim)", marginLeft: 8 }}>
              {sim.passed} / {sim.total} behavior checks passed
            </span>
          </div>
        )}

        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", fontSize: 12.5, color: "var(--text-dim)" }}>
          {result.compile.ok ? `Compiled successfully · ${sim?.duration_ms ?? 0} ms` : "Compilation failed"}
        </div>

        {!result.compile.ok && (
          <pre
            className="mono"
            style={{ margin: 0, padding: "14px 20px", fontSize: 12, background: "var(--fail-soft)", color: "var(--fail)", whiteSpace: "pre-wrap", borderTop: "1px solid var(--border)" }}
          >
            {result.compile.errors}
          </pre>
        )}

        {failed.length > 0 && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>
              Failed categories
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[...new Set(failed.map((f) => f.category))].map((cat) => (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--fail)", fontSize: 13.5 }}>
                  <span aria-hidden="true">✗</span>
                  {failed.find((f) => f.category === cat)?.purpose}
                </div>
              ))}
            </div>
          </div>
        )}

        {result.score && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 10 }}>
              Score breakdown
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(result.score.breakdown).map(([bucket, pts]) => (
                <div key={bucket}>
                  <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ textTransform: "capitalize", color: "var(--text-dim)" }}>{bucket}</span>
                    <span style={{ color: "var(--text)" }}>{pts}</span>
                  </div>
                  <ProgressBar value={pts} tone="accent" height={5} />
                </div>
              ))}
            </div>
          </div>
        )}

        {result.ai_feedback && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", background: "var(--accent-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: "0.08em", color: "var(--accent-strong)", textTransform: "uppercase", marginBottom: 8 }}>
              <span aria-hidden="true">✨</span> AI Feedback · confidence {result.ai_feedback.confidence}
            </div>
            <p style={{ fontSize: 13.5, margin: 0, marginBottom: 8, color: "var(--text)" }}>{result.ai_feedback.summary}</p>
            <p className="mono" style={{ fontSize: 12.5, margin: 0, color: "var(--text-dim)" }}>
              Hint: {result.ai_feedback.hint}
            </p>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
