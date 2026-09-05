"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ApiError,
  adminAiDraft,
  adminCreateProblem,
  adminPublish,
  adminSetAssets,
  adminValidate,
  type Port,
  type TestIn,
} from "@/lib/api";
import PortBuilder from "@/components/admin/PortBuilder";
import TestRowEditor from "@/components/admin/TestRowEditor";
import TopicInput from "@/components/admin/TopicInput";
import ValidatePanel from "@/components/admin/ValidatePanel";
import CodeEditor from "@/components/CodeEditor";
import Stepper from "@/components/ui/Stepper";
import Button from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import ProgressBar from "@/components/ui/ProgressBar";

type RubricRow = { bucket: string; points: number };

const STEPS = ["Basics", "Interface", "Tests", "Testbench + reference", "Validate"];

export default function NewProblemWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // step 1
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [kind, setKind] = useState<"combinational" | "sequential">("combinational");
  const [statement, setStatement] = useState("");
  const [topics, setTopics] = useState<string[]>([]);

  // step 2
  const [ports, setPorts] = useState<Port[]>([{ name: "a", dir: "input", width: 1 }]);

  // step 3
  const [rubric, setRubric] = useState<RubricRow[]>([
    { bucket: "interface", points: 20 },
    { bucket: "functional", points: 80 },
  ]);
  const [tests, setTests] = useState<TestIn[]>([]);

  // step 4
  const [problemId, setProblemId] = useState<string | null>(null);
  const [testbench, setTestbench] = useState("");
  const [reference, setReference] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);

  // step 5
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validation, setValidation] = useState<{ ok: boolean; ref_score: number | null; stub_score: number | null; log: string } | null>(
    null
  );
  const [published, setPublished] = useState(false);

  const rubricDict = Object.fromEntries(rubric.map((r) => [r.bucket, r.points]));
  const rubricSum = rubric.reduce((s, r) => s + r.points, 0);

  async function handleCreateAndAdvance() {
    setError(null);
    try {
      const created = await adminCreateProblem({
        slug,
        title,
        difficulty,
        kind,
        statement_md: statement,
        ports,
        rubric: rubricDict,
        sample_tests: [],
        tests,
        banned_tasks: [],
        topics,
      });
      setProblemId(created.id);
      setStep(3);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create problem.");
    }
  }

  async function handleAiDraft() {
    if (!problemId) return;
    setDrafting(true);
    setError(null);
    try {
      const draft = await adminAiDraft(problemId);
      setTestbench(draft.testbench_sv);
      setReference(draft.reference_sv);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "AI drafting failed — write the testbench by hand instead.");
    } finally {
      setDrafting(false);
    }
  }

  async function handleSaveAssets() {
    if (!problemId) return;
    setSaving(true);
    setError(null);
    try {
      await adminSetAssets(problemId, testbench, reference);
      setStep(4);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save assets.");
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    if (!problemId) return;
    setValidating(true);
    setError(null);
    try {
      const r = await adminValidate(problemId);
      setValidation(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Validation request failed.");
    } finally {
      setValidating(false);
    }
  }

  async function handlePublish() {
    if (!problemId) return;
    setPublishing(true);
    setError(null);
    try {
      await adminPublish(problemId);
      setPublished(true);
      setTimeout(() => router.push("/admin"), 800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 22 }}>New problem</h1>
      <Stepper steps={STEPS} current={step} />

      {error && (
        <div style={{ color: "var(--fail)", fontSize: 13, background: "var(--fail-soft)", padding: "9px 12px", borderRadius: "var(--radius-sm)", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }}>
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Slug" htmlFor="slug" hint="lowercase, snake_case — used in the URL and module name">
                <Input id="slug" placeholder="e.g. full_adder1" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </Field>
              <Field label="Title" htmlFor="title">
                <Input id="title" placeholder="e.g. Full Adder" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <div style={{ display: "flex", gap: 12 }}>
                <Field label="Difficulty" htmlFor="difficulty">
                  <Select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </Select>
                </Field>
                <Field label="Kind" htmlFor="kind">
                  <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value as any)}>
                    <option value="combinational">Combinational</option>
                    <option value="sequential">Sequential</option>
                  </Select>
                </Field>
              </div>
              <Field label="Statement" htmlFor="statement" hint="Markdown supported">
                <Textarea id="statement" placeholder="Create a module named..." value={statement} onChange={(e) => setStatement(e.target.value)} rows={6} />
              </Field>
              <Field label="Topics" htmlFor="topics" hint="Study-area bubbles on the student dashboard — e.g. Arithmetic, Counters">
                <TopicInput topics={topics} onChange={setTopics} />
              </Field>
              <div>
                <Button variant="primary" onClick={() => setStep(1)} disabled={!slug || !title || !statement}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PortBuilder ports={ports} onChange={setPorts} />
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button variant="primary" onClick={() => setStep(2)} disabled={ports.length === 0}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--text-dim)", textTransform: "uppercase" }}>
                    Rubric buckets
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: rubricSum === 100 ? "var(--pass)" : "var(--warn)" }}>
                    {rubricSum} / 100
                  </span>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <ProgressBar value={rubricSum} tone={rubricSum === 100 ? "pass" : "warn"} />
                </div>
                {rubric.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <Input
                      aria-label="Bucket name"
                      value={r.bucket}
                      onChange={(e) => setRubric(rubric.map((x, idx) => (idx === i ? { ...x, bucket: e.target.value } : x)))}
                      style={{ width: 180, padding: "8px 10px", fontSize: 13 }}
                    />
                    <Input
                      aria-label="Points"
                      type="number"
                      value={r.points}
                      onChange={(e) => setRubric(rubric.map((x, idx) => (idx === i ? { ...x, points: parseInt(e.target.value || "0", 10) } : x)))}
                      style={{ width: 90, padding: "8px 10px", fontSize: 13 }}
                    />
                    <button onClick={() => setRubric(rubric.filter((_, idx) => idx !== i))} aria-label="Remove bucket" style={{ color: "var(--fail)", background: "none", border: "none" }}>
                      ✕
                    </button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => setRubric([...rubric, { bucket: "", points: 0 }])}>
                  + add bucket
                </Button>
              </div>

              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 10 }}>
                  Hidden tests
                </div>
                <TestRowEditor tests={tests} buckets={rubric.map((r) => r.bucket).filter(Boolean)} onChange={setTests} />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button variant="primary" onClick={handleCreateAndAdvance} disabled={rubricSum !== 100 || tests.length === 0}>
                  Create draft & continue
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Button variant="secondary" onClick={handleAiDraft} disabled={drafting}>
                {drafting ? "Drafting…" : "✨ Draft with AI"}
              </Button>

              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginBottom: 8 }}>testbench_sv (hidden from students)</div>
                <CodeEditor value={testbench} onChange={setTestbench} height="260px" />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginBottom: 8 }}>reference_sv (hidden from students)</div>
                <CodeEditor value={reference} onChange={setReference} height="220px" />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button variant="primary" onClick={handleSaveAssets} disabled={!testbench || !reference || saving}>
                  {saving ? "Saving…" : "Save & continue"}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <ValidatePanel
              onValidate={handleValidate}
              onPublish={handlePublish}
              validating={validating}
              publishing={publishing}
              result={validation}
              published={published}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
