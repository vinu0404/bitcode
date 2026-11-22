"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import AppHeader from "@/components/bc/AppHeader";
import CommandPalette from "@/components/bc/CommandPalette";
import { DifficultySignal } from "@/components/bc/Marks";
import { EmptyState, TraceLoader } from "@/components/bc/States";
import DecryptedText from "@/components/reactbits/DecryptedText";
import Button, { ArrowIcon } from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { getMyRecent, getMyStats, type MeRecent, type MeStats } from "@/lib/api";
import { DomainBadge } from "@/components/bc/Marks";
import { StatusTag, verdictKind } from "@/components/bc/Status";
import { DOMAINS, pad2, padNumber } from "@/lib/domains";
import { useRequireAuth } from "@/lib/useRequireAuth";

const label: React.CSSProperties = {
  fontFamily: "var(--f-mono)",
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--fg-faint)",
};

const IN_OUT = [0.65, 0, 0.35, 1] as const;

export default function ProgressPage() {
  const authed = useRequireAuth();
  const stats = useQuery({ queryKey: ["stats"], queryFn: getMyStats, enabled: authed === true });
  const recent = useQuery({ queryKey: ["recent"], queryFn: () => getMyRecent(5), enabled: authed === true });

  return (
    <>
      <AppHeader />
      <CommandPalette />
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 24px 96px" }}>
        {authed === null || stats.isLoading ? (
          <>
            <h1 className="display" style={{ fontSize: "clamp(56px, 9vw, 120px)", marginBottom: 40 }}>
              Progress.
            </h1>
            <Panel>
              <TraceLoader label="Loading progress" />
            </Panel>
          </>
        ) : stats.isError || !stats.data ? (
          <>
            <h1 className="display" style={{ fontSize: "clamp(56px, 9vw, 120px)", marginBottom: 40 }}>
              Progress.
            </h1>
            <Panel>
              <EmptyState
                tone="error"
                title="Could not load your progress"
                body={(stats.error as Error)?.message}
                action={
                  <Button variant="secondary" size="sm" onClick={() => stats.refetch()}>
                    Try again
                  </Button>
                }
              />
            </Panel>
          </>
        ) : (
          <Body s={stats.data} r={recent.data} />
        )}
      </main>
    </>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <section style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", background: "var(--bg)", ...style }}>{children}</section>;
}

function PanelHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
      <h2 style={label}>{title}</h2>
      {right}
    </header>
  );
}

function Body({ s, r }: { s: MeStats; r?: MeRecent }) {
  const last14 = s.heatmap.slice(-14);
  const pct = s.total_problems ? Math.round((s.total_solved / s.total_problems) * 100) : 0;

  if (s.total_submissions === 0) {
    return (
      <>
        <h1 className="display" style={{ fontSize: "clamp(56px, 9vw, 120px)", marginBottom: 40 }}>
          Progress.
        </h1>
        <Panel>
          <EmptyState
            title="Nothing to chart yet"
            body="Submit your first design and this page fills in: the days you practised, your streak, and how far you are in each domain."
            channel="var(--pass)"
            minHeight={300}
            action={
              r?.next_up ? (
                <Link href={`/bitcode/${r.next_up.slug}`}>
                  <Button variant="primary" icon={<ArrowIcon />}>
                    Start with {padNumber(r.next_up.number)}
                  </Button>
                </Link>
              ) : (
                <Link href="/bitcode">
                  <Button variant="primary" icon={<ArrowIcon />}>
                    Pick a problem
                  </Button>
                </Link>
              )
            }
          />
        </Panel>
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* readout header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32, flexWrap: "wrap" }}>
        <h1 className="display" style={{ fontSize: "clamp(56px, 9vw, 120px)" }}>
          Progress.
        </h1>
        <div style={{ textAlign: "right", paddingBottom: 6 }}>
          <div className="mono tnum" style={{ fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 600, lineHeight: 1 }}>
            <DecryptedText text={`${pad2(s.total_solved)}/${pad2(s.total_problems)}`} />
          </div>
          <div className="mono" style={{ ...label, marginTop: 8 }}>
            Solved, {pct}% of the catalogue
          </div>
        </div>
      </div>

      <Panel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
          <Cell name="Streak" value={`${s.current_streak} ${s.current_streak === 1 ? "DAY" : "DAYS"}`} sub={`Longest ${s.longest_streak}`}>
            <PulseTrain days={last14.map((d) => d.submissions > 0)} color="var(--pass)" />
          </Cell>
          <Cell name="Submissions" value={pad2(s.total_submissions)} sub="Last 14 days">
            <Bars values={last14.map((d) => d.submissions)} />
          </Cell>
          <Cell name="Attempted" value={pad2(s.total_attempted)} sub="Submitted, not yet accepted" />
          <Cell name="Solved this week" value={pad2(s.heatmap.slice(-7).reduce((a, d) => a + d.solved, 0))} sub="Distinct problems per day, summed" />
        </div>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
        <NextUpCard next={r?.next_up ?? null} allDone={s.total_problems > 0 && s.total_solved === s.total_problems} />
        <Panel>
          <PanelHead title="Recent attempts" />
          <RecentList items={r?.recent ?? []} />
        </Panel>
      </div>

      <Panel>
        <PanelHead title="Last 26 weeks" right={<Legend />} />
        <Heatmap days={s.heatmap} />
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
        <Panel>
          <PanelHead title="By domain" right={<span style={label}>One period per problem</span>} />
          <ChannelTraces rows={s.by_domain} />
        </Panel>
        <Panel>
          <PanelHead title="By difficulty" />
          <div>
            {s.by_difficulty.map((d) => (
              <div key={d.difficulty} style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
                  <DifficultySignal difficulty={d.difficulty} />
                  <span className="mono tnum" style={{ marginLeft: "auto", fontSize: 13 }}>
                    {pad2(d.solved)} / {pad2(d.total)}
                  </span>
                </div>
                <ProgressBar value={d.solved} max={Math.max(d.total, 1)} tone="pass" />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Cell({ name, value, sub, children }: { name: string; value: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div style={{ padding: "20px 24px", borderRight: "1px solid var(--border)", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={label}>{name}</div>
      <div className="mono tnum" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1 }}>
        {value}
      </div>
      {children}
      {sub && <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{sub}</div>}
    </div>
  );
}

/** Active days as a digital signal: high on a day with a submit, low on a
 * day without. Drawn once, left to right. */
function PulseTrain({ days, color }: { days: boolean[]; color: string }) {
  const W = 200, H = 22, step = W / Math.max(days.length, 1);
  let d = "";
  days.forEach((on, i) => {
    const y = on ? 3 : H - 3;
    d += i === 0 ? `M0 ${y}` : `V${y}`;
    d += `H${(i + 1) * step}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H }} aria-label={`${days.filter(Boolean).length} active days in the last ${days.length}`}>
      <motion.path d={d} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: IN_OUT }} />
    </svg>
  );
}

function Bars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 22 }} aria-hidden>
      {values.map((v, i) => (
        <motion.span
          key={i}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: i * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ flex: 1, height: `${Math.max(8, (v / max) * 100)}%`, transformOrigin: "bottom", borderRadius: 1, background: v ? "var(--ch3)" : "var(--border)" }}
        />
      ))}
    </div>
  );
}

/** Cell fill by problems solved that day: 1, 2, 3, 4 or more. */
const LEVELS = [0, 0.22, 0.45, 0.7, 1];
function cellBg(solved: number, submitted: number): string {
  if (solved > 0) return `color-mix(in srgb, var(--pass) ${LEVELS[Math.min(solved, 4)] * 100}%, var(--bg-subtle))`;
  return submitted > 0 ? "color-mix(in srgb, var(--fg-faint) 25%, var(--bg-subtle))" : "var(--bg-subtle)";
}

function Legend() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ ...label, letterSpacing: "0.1em", marginRight: 4 }}>Less</span>
      {[0, 1, 2, 3, 4].map((n) => (
        <span key={n} title={n === 4 ? "4 or more solved" : `${n} solved`} style={{ width: 12, height: 12, borderRadius: 3, background: cellBg(n, 0) }} />
      ))}
      <span style={{ ...label, letterSpacing: "0.1em", marginLeft: 4 }}>More</span>
    </span>
  );
}

const CELL = 14;
const GAP = 3;
const WEEKDAYS = ["Mon", "", "Wed", "", "Fri", "", ""];

function Heatmap({ days }: { days: MeStats["heatmap"] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ d: MeStats["heatmap"][number]; x: number; y: number } | null>(null);
  const weeks = useMemo(() => {
    const out: MeStats["heatmap"][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);
  const months = useMemo(
    () =>
      weeks.map((w, i) => {
        const d = new Date(`${w[0].date}T00:00:00`);
        const prev = i > 0 ? new Date(`${weeks[i - 1][0].date}T00:00:00`) : null;
        return !prev || prev.getMonth() !== d.getMonth() ? d.toLocaleDateString("en-GB", { month: "short" }).slice(0, 3) : "";
      }),
    [weeks],
  );
  const today = days[days.length - 1]?.date;
  const solvedTotal = days.reduce((a, d) => a + d.solved, 0);
  const activeDays = days.filter((d) => d.submissions > 0).length;

  return (
    <div ref={wrapRef} style={{ position: "relative", padding: "20px 24px 18px", overflowX: "auto" }}>
      <div style={{ display: "flex", gap: GAP, minWidth: "max-content" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: GAP, marginRight: 6 }} aria-hidden>
          <span style={{ height: 16 }} />
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="mono" style={{ height: CELL, fontSize: 10, lineHeight: `${CELL}px`, color: "var(--fg-faint)" }}>
              {w}
            </span>
          ))}
        </div>
        <div role="grid" aria-label="Problems solved per day, last 26 weeks" style={{ display: "flex", gap: GAP }}>
          {weeks.map((w, wi) => (
            <div key={w[0].date} role="row" style={{ display: "flex", flexDirection: "column", gap: GAP }}>
              {/* fixed to one cell wide and allowed to overflow, so a month
                  name never widens its week column */}
              <span className="mono" style={{ width: CELL, height: 16, fontSize: 10, color: "var(--fg-faint)", whiteSpace: "nowrap", overflow: "visible" }}>
                {months[wi]}
              </span>
              {w.map((d, di) => (
                <motion.span
                  key={d.date}
                  role="gridcell"
                  tabIndex={-1}
                  aria-label={`${d.date}: ${d.solved} solved, ${d.submissions} submitted`}
                  onMouseEnter={(e) => {
                    const host = wrapRef.current!.getBoundingClientRect();
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setHover({ d, x: r.left - host.left + CELL / 2 + wrapRef.current!.scrollLeft, y: r.top - host.top });
                  }}
                  onMouseLeave={() => setHover(null)}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: wi * 0.012 + di * 0.004, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 3,
                    background: cellBg(d.solved, d.submissions),
                    outline: d.date === today ? "1px solid var(--fg-muted)" : "none",
                    outlineOffset: 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {hover && (
        <div
          role="status"
          className="mono"
          style={{
            position: "absolute",
            left: hover.x,
            top: hover.y - 8,
            transform: "translate(-50%, -100%)",
            padding: "8px 10px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-inline)",
            boxShadow: "var(--shadow-float)",
            fontSize: 11,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <div style={{ color: "var(--fg)", fontWeight: 600 }}>
            {new Date(`${hover.d.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </div>
          <div style={{ color: hover.d.solved ? "var(--pass)" : "var(--fg-muted)", marginTop: 2 }}>
            {hover.d.solved} solved, {hover.d.submissions} submitted
          </div>
        </div>
      )}
      <p className="mono tnum" style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 14 }}>
        {solvedTotal} SOLVES ON {activeDays} ACTIVE {activeDays === 1 ? "DAY" : "DAYS"}
      </p>
    </div>
  );
}

/** One clock period per problem in the domain: a high pulse for each
 * solved problem, low for the rest. Empty domains show a dashed flat line. */
function ChannelTraces({ rows }: { rows: MeStats["by_domain"] }) {
  const W = 300, H = 26, hi = 5, lo = H - 5;
  return (
    <div>
      {rows.map((r) => {
        const ch = DOMAINS[r.domain];
        const n = Math.max(r.total, 1);
        const step = W / n;
        let d = `M0 ${lo}`;
        for (let i = 0; i < r.total; i++) {
          const x0 = i * step, x1 = x0 + step;
          if (i < r.solved) d += `H${x0 + step * 0.15}V${hi}H${x0 + step * 0.65}V${lo}H${x1}`;
          else d += `H${x1}`;
        }
        if (r.total === 0) d = `M0 ${H / 2}H${W}`;
        return (
          <div key={r.domain} style={{ display: "grid", gridTemplateColumns: "150px minmax(0, 1fr) 72px", alignItems: "center", gap: 16, padding: "14px 24px", borderBottom: "1px solid var(--border)" }}>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: r.total ? ch.text : "var(--fg-faint)" }}>
              {ch.label}
            </span>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H }} aria-hidden>
              <motion.path
                d={d}
                fill="none"
                stroke={r.total ? ch.fill : "var(--fg-faint)"}
                strokeWidth={1.5}
                strokeDasharray={r.total ? undefined : "4 4"}
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: IN_OUT }}
              />
            </svg>
            <span className="mono tnum" style={{ fontSize: 13, textAlign: "right", color: r.total ? "var(--fg)" : "var(--fg-faint)" }}>
              {r.total ? `${pad2(r.solved)} / ${pad2(r.total)}` : "SOON"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The one thing to do next: the first problem already started but not
 * solved, otherwise the next new one. */
function NextUpCard({ next, allDone }: { next: MeRecent["next_up"]; allDone: boolean }) {
  if (!next) {
    return (
      <Panel>
        <EmptyState
          channel="var(--pass)"
          title={allDone ? "Every problem solved" : "Nothing queued"}
          body={allDone ? "That is the whole catalogue. New domains are on the way." : "New problems appear here as they are published."}
          minHeight={220}
        />
      </Panel>
    );
  }
  const ch = DOMAINS[next.domain];
  return (
    <Link href={`/bitcode/${next.slug}`} className="bc-next" style={{ ["--row-ch" as string]: ch.fill }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={label}>{next.status === "attempted" ? "Pick up where you left off" : "Next up"}</span>
        <DomainBadge domain={next.domain} />
      </div>
      <div>
        <div className="mono tnum" style={{ fontSize: 13, color: "var(--fg-muted)" }}>
          {padNumber(next.number)}
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, marginTop: 4 }}>{next.title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <DifficultySignal difficulty={next.difficulty} />
        <span className="bc-next-go">
          {next.status === "attempted" ? "Continue" : "Start"} <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function RecentList({ items }: { items: MeRecent["recent"] }) {
  if (!items.length) {
    return <EmptyState channel="var(--ch3)" title="No attempts yet" body="Each time you submit, it shows up here with its result." minHeight={200} />;
  }
  return (
    <div>
      {items.map((it) => (
        <Link
          key={it.submission_id}
          href={`/bitcode/${it.slug}`}
          className="bc-recent"
          style={{ ["--row-ch" as string]: DOMAINS[it.domain].fill }}
        >
          <StatusTag kind={verdictKind(it.verdict_word)} word={it.verdict_word || "SUBMITTED"} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span className="mono" style={{ color: "var(--fg-muted)", fontWeight: 400, marginRight: 8 }}>
                {padNumber(it.number)}
              </span>
              {it.title}
            </span>
          </span>
          <span className="mono tnum" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            {it.total ? `${pad2(it.passed ?? 0)}/${pad2(it.total)}` : ""}
          </span>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-faint)", textAlign: "right" }}>
            {timeAgo(it.created_at)}
          </span>
        </Link>
      ))}
    </div>
  );
}
