"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import AppHeader from "@/components/bc/AppHeader";
import CommandPalette from "@/components/bc/CommandPalette";
import { DifficultySignal, DomainBadge, ShortcutChip } from "@/components/bc/Marks";
import { EmptyState, TraceLoader } from "@/components/bc/States";
import { StatusIcon } from "@/components/bc/Status";
import Button, { ArrowIcon } from "@/components/ui/Button";
import Pager from "@/components/ui/Pager";
import { getProblem, listProblems, type Difficulty, type Domain, type Language, type ProblemFilters, type ProblemListItem, type ProblemStatus } from "@/lib/api";
import { DOMAIN_ORDER, DOMAINS, LANGUAGE_LABEL, LANGUAGE_NAME, pad2, padNumber } from "@/lib/domains";
import { useHotkeys } from "@/lib/hotkeys";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { markTransitionReady, navigateWithTransition, vtName } from "@/lib/viewTransition";

const PAGE_SIZE = 50;

const STATUS_ICON: Record<ProblemStatus, { kind: "pass" | "warn" | "pending"; label: string }> = {
  solved: { kind: "pass", label: "Solved" },
  attempted: { kind: "warn", label: "Attempted" },
  new: { kind: "pending", label: "New" },
};

export default function ProblemsPage() {
  return (
    <Suspense fallback={null}>
      <ProblemsPageInner />
    </Suspense>
  );
}

function ProblemsPageInner() {
  const authed = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters: ProblemFilters = {
    domain: (params.get("domain") as Domain) || undefined,
    difficulty: (params.get("difficulty") as Difficulty) || undefined,
    language: (params.get("language") as Language) || undefined,
    status: (params.get("status") as ProblemStatus) || undefined,
    q: params.get("q") || undefined,
  };
  const offset = Number(params.get("offset") || 0);

  // The search box types into local state; the URL (and the query) follow
  // 300ms after the last keystroke.
  const [search, setSearch] = useState(filters.q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "offset") next.delete("offset");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q ?? "") !== search.trim()) setParam("q", search.trim() || undefined);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useHotkeys([{ combo: "/", handler: () => searchRef.current?.focus(), allowInInputs: false }]);

  const query = useQuery({
    queryKey: ["problems", filters, offset],
    queryFn: () => listProblems({ ...filters, limit: PAGE_SIZE, offset }),
    enabled: authed === true,
    placeholderData: (prev) => prev,
  });

  // Coming back from a problem: the rows are on screen, let the morph run.
  useEffect(() => {
    if (query.data) markTransitionReady();
  }, [query.data]);

  const anyFilter = Boolean(filters.domain || filters.difficulty || filters.language || filters.status || filters.q);
  const items = query.data?.items ?? [];

  return (
    <>
      <AppHeader />
      <CommandPalette />
      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 24px 96px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 32 }}>
          <h1 className="display" style={{ fontSize: "clamp(56px, 9vw, 120px)" }}>
            Problems.
          </h1>
          <p className="mono tnum" style={{ fontSize: 12, color: "var(--fg-muted)", letterSpacing: "0.08em", paddingBottom: 10 }}>
            {query.data ? `${pad2(query.data.total)} ${query.data.total === 1 ? "PROBLEM" : "PROBLEMS"}${anyFilter ? " MATCH" : ""}` : " "}
          </p>
        </div>

        <FilterBar
          filters={filters}
          search={search}
          searchRef={searchRef}
          onSearch={setSearch}
          onChange={setParam}
          onClear={() => {
            setSearch("");
            router.replace(pathname, { scroll: false });
          }}
          anyFilter={anyFilter}
        />

        <section
          aria-label="Problem list"
          aria-busy={query.isFetching}
          style={{ border: "1px solid var(--border)", borderTop: 0, borderRadius: "0 0 var(--r-md) var(--r-md)", overflow: "hidden" }}
        >
          <ListHeader />
          {authed === null || (query.isLoading && !query.data) ? (
            <TraceLoader label="Loading problems" />
          ) : query.isError ? (
            <EmptyState
              tone="error"
              title="Could not load problems"
              body={(query.error as Error).message}
              action={
                <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              channel={filters.domain ? DOMAINS[filters.domain].fill : undefined}
              title={anyFilter ? "No problems match these filters" : "No problems published yet"}
              body={anyFilter ? "Remove one of these to widen the search." : "Published problems appear here."}
              extra={
                anyFilter ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 520 }}>
                    {(
                      [
                        filters.domain && ["domain", DOMAINS[filters.domain].label],
                        filters.difficulty && ["difficulty", filters.difficulty[0].toUpperCase() + filters.difficulty.slice(1)],
                        filters.language && ["language", LANGUAGE_LABEL[filters.language]],
                        filters.status && ["status", STATUS_ICON[filters.status].label],
                        filters.q && ["q", `"${filters.q}"`],
                      ].filter(Boolean) as [string, string][]
                    ).map(([key, text]) => (
                      <button
                        key={key}
                        className="bc-chip"
                        onClick={() => {
                          if (key === "q") setSearch("");
                          setParam(key, undefined);
                        }}
                        aria-label={`Remove filter ${text}`}
                      >
                        {text}
                        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
                          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </button>
                    ))}
                  </div>
                ) : undefined
              }
              action={
                anyFilter ? (
                  <Button variant="secondary" size="sm" onClick={() => router.replace(pathname)}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}>
              {items.map((p) => (
                <ProblemRow key={p.id} p={p} />
              ))}
            </motion.div>
          )}
        </section>

        {query.data && (
          <Pager total={query.data.total} limit={PAGE_SIZE} offset={offset} onOffsetChange={(o) => setParam("offset", o ? String(o) : undefined)} />
        )}
      </main>
    </>
  );
}

function ListHeader() {
  const cell: React.CSSProperties = { fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-faint)" };
  return (
    <div className="bc-row mono" style={{ minHeight: 36, padding: "0 20px", background: "var(--bg-subtle)" }} aria-hidden>
      <span />
      <span style={cell}>No.</span>
      <span style={cell}>Title</span>
      <span className="bc-hide-narrow" style={cell}>
        Domain
      </span>
      <span className="bc-hide-narrow" style={cell}>
        Lang
      </span>
      <span className="bc-hide-narrow" style={cell}>
        Difficulty
      </span>
      <span className="bc-hide-narrow" style={{ ...cell, textAlign: "right" }}>
        Accept
      </span>
      <span />
    </div>
  );
}

function ProblemRow({ p }: { p: ProblemListItem }) {
  const router = useRouter();
  const qc = useQueryClient();
  const status = STATUS_ICON[p.status];
  const href = `/bitcode/${p.slug}`;
  // Fetch the problem on intent, so the morph into the workspace never
  // waits on the network.
  const prefetch = () => qc.prefetchQuery({ queryKey: ["problem", p.slug], queryFn: () => getProblem(p.slug), staleTime: 30_000 });
  const topic = p.topics.map((t) => t.name).join(", ");
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } } }}>
      <Link
        href={href}
        onMouseEnter={prefetch}
        onFocus={prefetch}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          navigateWithTransition(router, href);
        }}
        className="bc-row"
        style={{ ["--row-ch" as string]: DOMAINS[p.domain].fill }}
        aria-label={`${padNumber(p.number)} ${p.title}, ${p.difficulty}, ${status.label}`}
      >
        <span title={status.label} style={{ display: "inline-flex" }}>
          <StatusIcon kind={status.kind} size={16} />
        </span>
        <span className="mono tnum" style={{ fontSize: 13, color: "var(--fg-muted)", viewTransitionName: vtName("num", p.slug) } as React.CSSProperties}>
          {padNumber(p.number)}
        </span>
        <span className="bc-row-title" style={{ minWidth: 0 }}>
          <span
            style={{
              display: "block",
              width: "fit-content",
              maxWidth: "100%",
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.25,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              viewTransitionName: vtName("title", p.slug),
            } as React.CSSProperties}
          >
            {p.title}
          </span>
          {topic && <span style={{ display: "block", fontSize: 13, color: "var(--fg-muted)", marginTop: 2 }}>{topic}</span>}
        </span>
        <span className="bc-hide-narrow">
          <DomainBadge domain={p.domain} />
        </span>
        <span className="bc-hide-narrow mono" title={LANGUAGE_NAME[p.language]} style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)" }}>
          {LANGUAGE_LABEL[p.language]}
        </span>
        <span className="bc-hide-narrow">
          <DifficultySignal difficulty={p.difficulty} />
        </span>
        <span className="bc-hide-narrow mono tnum" style={{ fontSize: 13, color: "var(--fg-muted)", textAlign: "right" }}>
          {p.acceptance === null ? "--" : `${Math.round(p.acceptance)}%`}
        </span>
        <span className="bc-solve" aria-hidden>
          <ArrowIcon />
        </span>
      </Link>
    </motion.div>
  );
}

function FilterBar({
  filters,
  search,
  searchRef,
  onSearch,
  onChange,
  onClear,
  anyFilter,
}: {
  filters: ProblemFilters;
  search: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onSearch: (v: string) => void;
  onChange: (key: string, value: string | undefined) => void;
  onClear: () => void;
  anyFilter: boolean;
}) {
  const toggle = (key: keyof ProblemFilters, value: string) => onChange(key, filters[key] === value ? undefined : value);
  const group: React.CSSProperties = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" };
  const sep = <span style={{ width: 1, height: 20, background: "var(--border)", flex: "none" }} aria-hidden />;

  return (
    <div
      style={{
        position: "sticky",
        top: 56,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        padding: "12px 16px",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md) var(--r-md) 0 0",
      }}
    >
      <div style={group} role="group" aria-label="Domain">
        {DOMAIN_ORDER.map((d) => (
          <button key={d} className="bc-chip" aria-pressed={filters.domain === d} onClick={() => toggle("domain", d)}>
            <span className="bc-dot" style={{ background: DOMAINS[d].fill }} />
            {DOMAINS[d].label}
          </button>
        ))}
      </div>
      {sep}
      <div style={group} role="group" aria-label="Difficulty">
        {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
          <button key={d} className="bc-chip" aria-pressed={filters.difficulty === d} onClick={() => toggle("difficulty", d)} style={{ textTransform: "capitalize" }}>
            <DifficultySignal difficulty={d} label={false} />
            {d}
          </button>
        ))}
      </div>
      {sep}
      <div style={group} role="group" aria-label="Language">
        {(["sv", "v"] as Language[]).map((l) => (
          <button key={l} className="bc-chip mono" aria-pressed={filters.language === l} onClick={() => toggle("language", l)} title={LANGUAGE_NAME[l]}>
            {LANGUAGE_LABEL[l]}
          </button>
        ))}
      </div>
      {sep}
      <div style={group} role="group" aria-label="Status">
        {(["solved", "attempted", "new"] as ProblemStatus[]).map((s) => (
          <button key={s} className="bc-chip" aria-pressed={filters.status === s} onClick={() => toggle("status", s)}>
            <StatusIcon kind={STATUS_ICON[s].kind} size={12} />
            {STATUS_ICON[s].label}
          </button>
        ))}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flex: "1 1 220px", maxWidth: 320 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            ref={searchRef}
            className="ui-input"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search title or number"
            aria-label="Search problems"
            style={{ width: "100%", paddingRight: 36 }}
          />
          <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }}>
            <ShortcutChip keys={["/"]} />
          </span>
        </div>
        {anyFilter && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
