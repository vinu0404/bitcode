"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { adminListProblems } from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Pager from "@/components/ui/Pager";
import { fadeUp, staggerContainer } from "@/components/ui/motion";

const STATUS_TONE: Record<string, "neutral" | "warn" | "pass" | "fail"> = {
  draft: "neutral",
  validated: "warn",
  published: "pass",
  archived: "fail",
};
const PAGE_SIZE = 20;

export default function AdminProblemsPage() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-problems", offset],
    queryFn: () => adminListProblems({ limit: PAGE_SIZE, offset }),
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Admin · Problems</h1>
        <Link href="/admin/problems/new">
          <Button variant="primary">+ New problem</Button>
        </Link>
      </div>

      {isLoading && <p style={{ color: "var(--text-dim)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--fail)" }}>Forbidden — admin role required.</p>}

      {data && (
        <>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.items.map((p) => (
              <motion.div key={p.id} variants={fadeUp}>
                <Card style={{ padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 14.5 }}>{p.title}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                      {p.slug}
                    </span>
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
                  <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge>
                </Card>
              </motion.div>
            ))}
          </motion.div>
          <Pager total={data.total} limit={data.limit} offset={data.offset} onOffsetChange={setOffset} />
        </>
      )}
    </div>
  );
}
