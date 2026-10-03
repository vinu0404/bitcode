"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DifficultySignal, DomainBadge } from "@/components/bc/Marks";
import { EmptyState, TraceLoader } from "@/components/bc/States";
import { useToast } from "@/components/bc/Toasts";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Pager from "@/components/ui/Pager";
import { adminListProblems, adminPublish, adminSummary, adminUnpublish, adminValidate, type AdminProblem } from "@/lib/api";
import { padNumber } from "@/lib/domains";
import { describeError } from "@/lib/errors";

const STATUSES = [
  { id: "", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "validated", label: "Validated" },
  { id: "published", label: "Published" },
  { id: "archived", label: "Archived" },
];
const TONE: Record<string, "neutral" | "warn" | "pass" | "fail"> = { draft: "neutral", validated: "warn", published: "pass", archived: "fail" };
const PAGE_SIZE = 20;

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminList />
    </Suspense>
  );
}

function AdminList() {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get("status") || "";
  const offset = Number(params.get("offset") || 0);
  const qc = useQueryClient();
  const toast = useToast();

  const summary = useQuery({ queryKey: ["admin-summary"], queryFn: adminSummary });
  const list = useQuery({
    queryKey: ["admin-problems", status, offset],
    queryFn: () => adminListProblems({ limit: PAGE_SIZE, offset, status: status || undefined }),
    placeholderData: (p) => p,
  });

  const setParam = (k: string, v?: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== "offset") next.delete("offset");
    router.replace(`/admin${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-problems"] });
    qc.invalidateQueries({ queryKey: ["admin-summary"] });
  };
  const action = useMutation({
    mutationFn: async ({ p, kind }: { p: AdminProblem; kind: "validate" | "publish" | "unpublish" }) => {
      if (kind === "validate") return { kind, p, r: await adminValidate(p.id) };
      if (kind === "publish") return { kind, p, r: await adminPublish(p.id) };
      return { kind, p, r: await adminUnpublish(p.id) };
    },
    onSuccess: ({ kind, p, r }) => {
      refresh();
      if (kind === "validate") {
        const ok = (r as { ok: boolean }).ok;
        toast(ok ? { kind: "success", title: "Validated", body: `${padNumber(p.number)} passed all four checks.`, action: { label: "Publish", run: () => action.mutate({ p, kind: "publish" }) } } : { kind: "warn", title: "Validation failed", body: "Open the problem to see which check failed.", action: { label: "Open", run: () => router.push(`/admin/problems/${p.id}`) } });
      } else if (kind === "publish") toast({ kind: "success", title: "Published", body: `${padNumber(p.number)} is live for students.` });
      else toast({ kind: "info", title: "Unpublished", body: `${padNumber(p.number)} is hidden from students.` });
    },
    onError: (err, { kind }) => {
      const e = describeError(err, kind);
      toast({ kind: e.kind, title: e.title, body: e.body });
    },
  });

  const counts = summary.data?.by_status ?? {};
  const busyId = action.isPending ? action.variables?.p.id : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <h1 className="display" style={{ fontSize: "clamp(40px, 6vw, 72px)" }}>
          Admin.
        </h1>
        <Link href="/admin/problems/new">
          <Button variant="primary">New problem</Button>
        </Link>
      </div>

      <div role="group" aria-label="Filter by status" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {STATUSES.map((s) => (
          <button key={s.id} className="bc-chip" aria-pressed={status === s.id} onClick={() => setParam("status", s.id || undefined)}>
            {s.label}
            <span className="mono tnum" style={{ fontSize: 11, opacity: 0.7 }}>
              {s.id ? (counts[s.id] ?? 0) : (summary.data?.total ?? 0)}
            </span>
          </button>
        ))}
      </div>

      <section style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
        {list.isLoading ? (
          <TraceLoader label="Loading problems" />
        ) : list.isError ? (
          <EmptyState tone="error" title={describeError(list.error, "load problems").title} body={describeError(list.error, "load problems").body} />
        ) : !list.data?.items.length ? (
          <EmptyState
            title={status ? `No ${status} problems` : "No problems yet"}
            body={status ? "Pick another status above." : "Create the first one; the editor walks you through every part."}
            action={
              status ? undefined : (
                <Link href="/admin/problems/new">
                  <Button variant="primary" size="sm">
                    New problem
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          list.data.items.map((p) => (
            <div key={p.id} className="bc-admin-row">
              <span className="mono tnum" style={{ fontSize: 13, color: "var(--fg-muted)" }}>
                {padNumber(p.number)}
              </span>
              <Link href={`/admin/problems/${p.id}`} style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                <span className="mono" style={{ display: "block", fontSize: 11.5, color: "var(--fg-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.slug}
                  {p.topics.length > 0 && `  /  ${p.topics.map((t) => t.name).join(", ")}`}
                </span>
              </Link>
              <span className="bc-admin-meta">
                <DomainBadge domain={p.domain} />
                <DifficultySignal difficulty={p.difficulty as "easy" | "medium" | "hard"} />
              </span>
              <Badge tone={TONE[p.status] ?? "neutral"}>{p.status}</Badge>
              <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                {p.status === "published" ? (
                  <Button variant="ghost" size="sm" loading={busyId === p.id} loadingLabel="..." onClick={() => action.mutate({ p, kind: "unpublish" })}>
                    Unpublish
                  </Button>
                ) : p.status === "validated" ? (
                  <Button variant="secondary" size="sm" loading={busyId === p.id} loadingLabel="..." onClick={() => action.mutate({ p, kind: "publish" })}>
                    Publish
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" loading={busyId === p.id} loadingLabel="..." onClick={() => action.mutate({ p, kind: "validate" })}>
                    Validate
                  </Button>
                )}
                <Link href={`/admin/problems/${p.id}`}>
                  <Button variant="secondary" size="sm">
                    Edit
                  </Button>
                </Link>
              </span>
            </div>
          ))
        )}
      </section>
      {list.data && <Pager total={list.data.total} limit={PAGE_SIZE} offset={offset} onOffsetChange={(o) => setParam("offset", o ? String(o) : undefined)} />}
    </div>
  );
}
