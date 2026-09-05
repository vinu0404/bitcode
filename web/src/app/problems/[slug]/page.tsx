"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, getProblem, runCustom, submit, type GradeResponse, type RunResponse } from "@/lib/api";
import { useAuthReady } from "@/lib/auth";
import CodeEditor from "@/components/CodeEditor";
import ProblemStatement from "@/components/ProblemStatement";
import ResultCard from "@/components/ResultCard";
import TestVectorTable from "@/components/TestVectorTable";
import Button from "@/components/ui/Button";

export default function ProblemDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const loggedIn = useAuthReady(); // null = not checked yet, then true/false

  useEffect(() => {
    if (loggedIn === false) router.push("/login");
  }, [loggedIn, router]);

  const { data: problem, isLoading } = useQuery({
    queryKey: ["problem", slug],
    queryFn: () => getProblem(slug),
    enabled: !!loggedIn,
  });

  const [code, setCode] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    if (problem && code === null) setCode(problem.starter_code);
  }, [problem, code]);

  async function handleSubmit() {
    if (!problem || code === null) return;
    setSubmitting(true);
    setBanner(null);
    try {
      const r = await submit(problem.slug, code);
      setResult(r);
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRun(vectors: Record<string, string>[]) {
    if (!problem || code === null) return;
    setRunning(true);
    try {
      const r = await runCustom(problem.slug, code, vectors);
      setRunResult(r);
    } catch (err) {
      setBanner(err instanceof ApiError ? err.message : "Run failed.");
    } finally {
      setRunning(false);
    }
  }

  if (loggedIn !== true || isLoading || !problem || code === null) return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 32, alignItems: "start" }}>
      <div>
        <ProblemStatement problem={problem} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 84 }}>
        <CodeEditor value={code} onChange={setCode} />

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Grading…" : "Submit"}
          </Button>
          <Button variant="secondary" onClick={() => setShowCustom((s) => !s)}>
            {showCustom ? "Hide custom test" : "Try your own test case"}
          </Button>
        </div>

        <AnimatePresence>
          {banner && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ color: "var(--fail)", fontSize: 13, background: "var(--fail-soft)", padding: "8px 12px", borderRadius: "var(--radius-sm)" }}
            >
              {banner}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCustom && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <TestVectorTable ports={problem.interface.ports} kind={problem.kind} onRun={handleRun} running={running} result={runResult} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{result && <ResultCard result={result} />}</AnimatePresence>
      </div>
    </div>
  );
}
