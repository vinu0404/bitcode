"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { listMySubmissions, type ProblemDetail, type SubmissionListItem } from "@/lib/api";
import { DOMAINS, pad2 } from "@/lib/domains";
import Tabs from "@/components/bc/Tabs";
import Button from "@/components/ui/Button";
import { EmptyState, TraceLoader } from "@/components/bc/States";
import { StatusTag, verdictKind } from "@/components/bc/Status";

export type StatementTab = "problem" | "hints" | "submissions";

const label: React.CSSProperties = {
  fontFamily: "var(--f-mono)",
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--fg-faint)",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ ...label, marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function StatementPane({
  problem,
  tab,
  onTab,
  onOpenSubmission,
  onSubmit,
  mod,
}: {
  problem: ProblemDetail;
  tab: StatementTab;
  onTab: (t: StatementTab) => void;
  onOpenSubmission: (s: SubmissionListItem) => void;
  onSubmit: () => void;
  mod: string;
}) {
  const subs = useQuery({ queryKey: ["my-submissions", problem.slug], queryFn: () => listMySubmissions(problem.slug, { limit: 50 }) });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "var(--bg)" }}>
      <Tabs<StatementTab>
        items={[
          { id: "problem", label: "Problem" },
          { id: "hints", label: "Hints", count: problem.hints.length },
          { id: "submissions", label: "Submissions", count: subs.data?.total },
        ]}
        active={tab}
        onChange={onTab}
      />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ padding: tab === "submissions" ? 0 : "24px 24px 48px" }}
          >
            {tab === "problem" && <ProblemTab problem={problem} />}
            {tab === "hints" && <HintsTab hints={problem.hints} />}
            {tab === "submissions" &&
              (subs.isLoading ? (
                <TraceLoader label="Loading submissions" />
              ) : subs.isError ? (
                <EmptyState tone="error" title="Could not load submissions" body={(subs.error as Error).message} />
              ) : !subs.data?.items.length ? (
                <EmptyState
                  channel={DOMAINS[problem.domain].fill}
                  title="No submissions yet"
                  body="Each attempt lands here with its result. Click one later to load its code back into the editor."
                  action={
                    <Button variant="primary" size="sm" shortcut={[mod, "⇧", "⏎"]} onClick={onSubmit}>
                      Submit now
                    </Button>
                  }
                />
              ) : (
                <SubmissionsList items={subs.data.items} onOpen={onOpenSubmission} />
              ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProblemTab({ problem }: { problem: ProblemDetail }) {
  const ports = problem.interface.ports;
  return (
    <article style={{ maxWidth: 680 }}>
      <div className="bc-prose" style={{ fontSize: 15, lineHeight: 1.65 }}>
        <ReactMarkdown>{problem.statement_md}</ReactMarkdown>
      </div>

      <Section title="Ports">
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)" }}>
                {["Name", "Direction", "Width", "Description"].map((h) => (
                  <th key={h} style={{ ...label, textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ports.map((p) => (
                <tr key={p.name} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="mono" style={{ padding: "8px 12px", fontWeight: 600 }}>
                    {p.name}
                  </td>
                  <td className="mono" style={{ padding: "8px 12px", color: "var(--ch3-text)", fontWeight: 600 }}>
                    {p.dir}
                  </td>
                  <td className="mono tnum" style={{ padding: "8px 12px", color: "var(--fg-muted)" }}>
                    {p.width === 1 ? "1" : `[${p.width - 1}:0]`}
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--fg-muted)" }}>{p.desc || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {problem.sample_tests.length > 0 && (
        <Section title="Examples">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {problem.sample_tests.map((ex, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
                <div style={{ padding: "10px 12px", borderRight: "1px solid var(--border)" }}>
                  <div style={label}>Example {pad2(i + 1)} / Input</div>
                  <div className="mono" style={{ fontSize: 13, marginTop: 6 }}>
                    {ex.input}
                  </div>
                </div>
                <div style={{ padding: "10px 12px", background: "var(--bg-subtle)" }}>
                  <div style={label}>Expected</div>
                  <div className="mono" style={{ fontSize: 13, marginTop: 6 }}>
                    {ex.expected}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Constraints">
        <ul className="mono" style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 13, color: "var(--fg-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
          {problem.constraints.map((c) => (
            <li key={c} style={{ display: "flex", gap: 10 }}>
              <span style={{ color: "var(--fg-faint)" }} aria-hidden>
                &gt;
              </span>
              {c}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Tests">
        <p style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>
          {problem.tests.filter((t) => t.visible).length} visible tests run on Run, with a waveform. Submit runs all {problem.tests.length}; hidden tests report only a number and a status.
        </p>
      </Section>
    </article>
  );
}

function HintsTab({ hints }: { hints: string[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  if (!hints.length) return <EmptyState title="No hints for this problem" minHeight={180} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
      {hints.map((h, i) => {
        const on = open.has(i);
        return (
          <div key={i} style={{ borderBottom: i < hints.length - 1 ? "1px solid var(--border)" : 0 }}>
            <button
              onClick={() => setOpen((s) => new Set(on ? [...s].filter((x) => x !== i) : [...s, i]))}
              aria-expanded={on}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                border: 0,
                background: "transparent",
                textAlign: "left",
              }}
            >
              <span className="mono tnum" style={{ fontSize: 12, color: "var(--fg-faint)" }}>
                {pad2(i + 1)}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: on ? "var(--fg)" : "var(--fg-muted)" }}>{on ? "Hint" : "Reveal hint"}</span>
              <span style={{ marginLeft: "auto", color: "var(--fg-faint)", transform: on ? "rotate(90deg)" : "none", transition: "transform 200ms" }} aria-hidden>
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M3 1.5L7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <p style={{ padding: "0 14px 14px 46px", fontSize: 14, lineHeight: 1.6 }}>{h}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function SubmissionsList({ items, onOpen }: { items: SubmissionListItem[]; onOpen: (s: SubmissionListItem) => void }) {
  return (
    <div>
      {items.map((s) => (
        <button
          key={s.id}
          onClick={() => onOpen(s)}
          title="Open this submission in the editor"
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto auto",
            alignItems: "center",
            gap: 16,
            padding: "12px 20px",
            border: 0,
            borderBottom: "1px solid var(--border)",
            background: "transparent",
            textAlign: "left",
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <StatusTag kind={verdictKind(s.verdict_word)} word={s.verdict_word || s.verdict} />
            <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>{timeAgo(s.created_at)}</span>
          </span>
          <span className="mono tnum" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            {s.total ? `${pad2(s.passed ?? 0)} / ${pad2(s.total)}` : "--"}
          </span>
          <span className="mono tnum" style={{ fontSize: 12, color: "var(--fg-faint)", minWidth: 44, textAlign: "right" }}>
            {s.sim_ms !== null ? `${s.sim_ms}ms` : ""}
          </span>
        </button>
      ))}
    </div>
  );
}
