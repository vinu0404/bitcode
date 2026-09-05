"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getMyStats, listProblems } from "@/lib/api";
import { useAuthReady } from "@/lib/auth";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import Pager from "@/components/ui/Pager";
import { fadeUp, staggerContainer } from "@/components/ui/motion";

const DIFFICULTY_TONE: Record<string, "pass" | "warn" | "fail"> = { easy: "pass", medium: "warn", hard: "fail" };
const PAGE_SIZE = 20;

// Debounces keystrokes into the actual network request — search fires
// ~300ms after typing stops, not on every character (Doherty Threshold:
// keeps typing itself feeling instant while not hammering the API).
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function ProblemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loggedIn = useAuthReady();
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("");
  // Arriving from Dashboard's "click a topic to browse" link — read the
  // starting filter from the URL once, rather than always landing unfiltered.
  const [activeTopic, setActiveTopic] = useState<string | null>(() => searchParams.get("topic"));
  const [offset, setOffset] = useState(0);
  const debouncedQuery = useDebounced(query, 300);

  useEffect(() => {
    if (loggedIn === false) router.push("/login");
  }, [loggedIn, router]);

  // Any filter change invalidates the current page position.
  useEffect(() => setOffset(0), [debouncedQuery, difficulty, activeTopic]);

  const { data: stats } = useQuery({ queryKey: ["me-stats"], queryFn: getMyStats, enabled: !!loggedIn });
  const { data, isLoading, error } = useQuery({
    queryKey: ["problems", debouncedQuery, difficulty, activeTopic, offset],
    queryFn: () =>
      listProblems({
        q: debouncedQuery || undefined,
        difficulty: difficulty || undefined,
        topic: activeTopic ?? undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    enabled: !!loggedIn,
  });

  if (loggedIn !== true) return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;
  if (error) return <p style={{ color: "var(--fail)" }}>Failed to load problems.</p>;

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 30, fontWeight: 600, marginBottom: 8, fontStyle: "italic" }}>Problems</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 14.5 }}>A real Verilog simulator decides your score. AI only writes the feedback.</p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 260px" }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          >
            <circle cx="11" cy="11" r="7" stroke="var(--text-faint)" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <Input
            placeholder="Search problems by title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search problems"
            style={{ paddingLeft: 36 }}
          />
        </div>
        <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Filter by difficulty" style={{ width: 160 }}>
          <option value="">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </Select>
      </div>

      {stats && stats.by_topic.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {stats.by_topic.map((tb) => {
            const active = activeTopic === tb.topic.slug;
            return (
              <button
                key={tb.topic.id}
                onClick={() => setActiveTopic(active ? null : tb.topic.slug)}
                className="mono"
                style={{
                  fontSize: 11.5,
                  padding: "5px 11px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent-soft)" : "var(--surface)",
                  color: active ? "var(--accent-strong)" : "var(--text-dim)",
                }}
              >
                {tb.topic.name}
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <p style={{ color: "var(--text-dim)" }}>Loading…</p>
      ) : (
        <motion.div
          key={`${debouncedQuery}-${difficulty}-${activeTopic ?? "all"}-${offset}`}
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {data?.items.map((p) => (
            <motion.div key={p.id} variants={fadeUp}>
              <Link href={`/problems/${p.slug}`} style={{ textDecoration: "none", display: "block" }}>
                <Card hover style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        flex: "none",
                        background: p.solved ? "var(--pass-soft)" : "var(--surface-2)",
                        color: p.solved ? "var(--pass)" : "var(--text-faint)",
                        border: `1px solid ${p.solved ? "color-mix(in srgb, var(--pass) 40%, transparent)" : "var(--border)"}`,
                      }}
                    >
                      {p.solved ? "✓" : ""}
                    </span>
                    <span style={{ fontSize: 15.5, fontWeight: 500, color: "var(--text)" }}>{p.title}</span>
                    {p.topics.map((t) => (
                      <span
                        key={t.id}
                        className="mono"
                        style={{ fontSize: 10.5, color: "var(--text-faint)", background: "var(--surface-2)", padding: "2px 8px", borderRadius: 999 }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge tone="neutral" dot={false}>
                      {p.kind}
                    </Badge>
                    <Badge tone={DIFFICULTY_TONE[p.difficulty] ?? "neutral"}>{p.difficulty}</Badge>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
          {data?.items.length === 0 && (
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
              {query ? `No problems match "${query}".` : "No problems here yet."}
            </p>
          )}
        </motion.div>
      )}

      {data && <Pager total={data.total} limit={data.limit} offset={data.offset} onOffsetChange={setOffset} />}
    </div>
  );
}
