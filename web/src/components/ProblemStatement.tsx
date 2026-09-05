"use client";

import ReactMarkdown from "react-markdown";
import type { ProblemDetail } from "@/lib/api";
import Badge from "@/components/ui/Badge";

const DIFFICULTY_TONE: Record<string, "pass" | "warn" | "fail"> = { easy: "pass", medium: "warn", hard: "fail" };

export default function ProblemStatement({ problem }: { problem: ProblemDetail }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{problem.title}</h1>
        <Badge tone={DIFFICULTY_TONE[problem.difficulty] ?? "neutral"}>{problem.difficulty}</Badge>
        <Badge tone="neutral" dot={false}>
          {problem.kind}
        </Badge>
        {problem.topics.map((t) => (
          <span
            key={t.id}
            className="mono"
            style={{ fontSize: 10.5, color: "var(--text-faint)", background: "var(--surface-2)", padding: "3px 10px", borderRadius: 999 }}
          >
            {t.name}
          </span>
        ))}
      </div>

      <div className="prose" style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--text)" }}>
        <ReactMarkdown
          components={{
            code: (props) => (
              <code
                className="mono"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "1px 6px", borderRadius: 4, fontSize: "0.9em" }}
                {...props}
              />
            ),
          }}
        >
          {problem.statement_md}
        </ReactMarkdown>
      </div>

      {problem.sample_tests.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 10 }}>
            Expected behavior
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <table className="mono" style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%" }}>
              <tbody>
                {problem.sample_tests.map((s, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "var(--surface)" : "transparent" }}>
                    <td style={{ padding: "9px 14px", color: "var(--text-dim)", borderBottom: i === problem.sample_tests.length - 1 ? "none" : "1px solid var(--border)" }}>
                      {s.input}
                    </td>
                    <td style={{ padding: "9px 14px", color: "var(--pass)", borderBottom: i === problem.sample_tests.length - 1 ? "none" : "1px solid var(--border)" }}>
                      {s.expected}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
