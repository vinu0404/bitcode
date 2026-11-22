"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import CodeEditor from "@/components/CodeEditor";
import { DifficultySignal, DomainBadge } from "@/components/bc/Marks";
import { StatusIcon } from "@/components/bc/Status";
import { useToast } from "@/components/bc/Toasts";
import Badge from "@/components/ui/Badge";
import Button, { ArrowIcon } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import ProgressBar from "@/components/ui/ProgressBar";
import Stepper from "@/components/ui/Stepper";
import {
  adminAiDraft,
  adminCreateProblem,
  adminPublish,
  adminSetAssets,
  adminUnpublish,
  adminUpdateProblem,
  adminValidate,
  type AdminProblemDetail,
  type Difficulty,
  type Domain,
  type Language,
  type Port,
  type TestIn,
  type ValidationResult,
} from "@/lib/api";
import { LANGUAGE_NAME, padNumber } from "@/lib/domains";
import { describeError } from "@/lib/errors";
import { ChannelPicker, Segmented } from "./Choice";
import PortBuilder from "./PortBuilder";
import TestRowEditor, { testIssues } from "./TestRowEditor";
import TopicInput from "./TopicInput";
import ValidatePanel from "./ValidatePanel";

const STEPS = ["Basics", "Statement", "Ports", "Tests", "Bench", "Validate"];
const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

type RubricRow = { bucket: string; points: number };
type Sample = { input: string; expected: string };

interface Draft {
  slug: string;
  number: string;
  title: string;
  domain: Domain;
  language: Language;
  difficulty: Difficulty;
  kind: "combinational" | "sequential";
  topics: string[];
  statement: string;
  samples: Sample[];
  hints: string[];
  ports: Port[];
  resetSync: boolean;
  resetActiveHigh: boolean;
  rubric: RubricRow[];
  tests: TestIn[];
  testbench: string;
  reference: string;
}

const EMPTY: Draft = {
  slug: "",
  number: "",
  title: "",
  domain: "vlsi",
  language: "sv",
  difficulty: "easy",
  kind: "combinational",
  topics: [],
  statement: "",
  samples: [{ input: "", expected: "" }],
  hints: [""],
  ports: [{ name: "a", dir: "input", width: 1, desc: "" }],
  resetSync: true,
  resetActiveHigh: true,
  rubric: [
    { bucket: "interface", points: 20 },
    { bucket: "functional", points: 80 },
  ],
  tests: [],
  testbench: "",
  reference: "",
};

function fromDetail(p: AdminProblemDetail): Draft {
  return {
    slug: p.slug,
    number: String(p.number),
    title: p.title,
    domain: p.domain,
    language: p.language,
    difficulty: p.difficulty as Difficulty,
    kind: p.kind as Draft["kind"],
    topics: p.topics.map((t) => t.name),
    statement: p.statement_md,
    samples: p.sample_tests.length ? p.sample_tests : [{ input: "", expected: "" }],
    hints: p.hints.length ? p.hints : [""],
    ports: p.interface.ports.map((x) => ({ ...x, desc: x.desc ?? "" })),
    resetSync: p.constraints.reset?.sync ?? true,
    resetActiveHigh: p.constraints.reset?.active_high ?? true,
    rubric: Object.entries(p.rubric).map(([bucket, points]) => ({ bucket, points })),
    tests: p.tests,
    testbench: p.testbench_sv,
    reference: p.reference_sv,
  };
}

/** Same shape the backend gives students as starter code. */
function starterCode(module: string, ports: Port[]): string {
  const lines = ports.map((p) => `    ${p.dir.padEnd(6)} ${p.width > 1 ? `logic [${p.width - 1}:0]` : "logic"} ${p.name}`);
  return `module ${module || "module_name"} (\n${lines.join(",\n")}\n);\n    // Write your code here\nendmodule\n`;
}

/** What blocks each step, in words; empty means the step is complete. */
function stepIssues(d: Draft, step: number, isNew: boolean): string[] {
  const out: string[] = [];
  if (step === 0) {
    if (isNew && !/^[a-z][a-z0-9_]*$/.test(d.slug)) out.push("Slug: lowercase letters, digits and _, starting with a letter.");
    if (!d.title.trim()) out.push("Give it a title.");
    if (d.number && (!/^\d{1,4}$/.test(d.number) || Number(d.number) < 1)) out.push("Number must be 1 to 9999, or blank.");
  }
  if (step === 1) {
    if (!d.statement.trim()) out.push("Write the statement.");
    if (d.samples.some((s) => (s.input.trim() && !s.expected.trim()) || (!s.input.trim() && s.expected.trim()))) out.push("Each example needs both an input and an expected result.");
  }
  if (step === 2) {
    if (!d.ports.length) out.push("Add at least one port.");
    if (d.ports.some((p) => !IDENT.test(p.name))) out.push("Port names must be valid identifiers, like clk or data_in.");
    const names = d.ports.map((p) => p.name);
    if (names.some((n, i) => names.indexOf(n) !== i)) out.push("Two ports share a name.");
    if (!d.ports.some((p) => p.dir === "output")) out.push("Add at least one output.");
    if (d.kind === "sequential" && !d.ports.some((p) => p.name === "clk" && p.dir === "input" && p.width === 1)) out.push("Sequential problems need a 1-bit input named clk.");
  }
  if (step === 3) {
    const sum = d.rubric.reduce((a, r) => a + r.points, 0);
    if (sum !== 100) out.push(`Rubric adds up to ${sum}; it must be exactly 100.`);
    if (d.rubric.some((r) => !r.bucket.trim())) out.push("Every rubric bucket needs a name.");
    out.push(...testIssues(d.tests, d.rubric.map((r) => r.bucket)));
  }
  if (step === 4) {
    if (!d.testbench.trim()) out.push("Add the test bench (or draft one with AI).");
    if (!d.reference.trim()) out.push("Add the reference solution.");
  }
  return out;
}

const label: React.CSSProperties = { fontFamily: "var(--f-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-muted)" };

export default function ProblemEditor({ initial }: { initial?: AdminProblemDetail }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const isNew = !initial;
  const [d, setD] = useState<Draft>(() => (initial ? fromDetail(initial) : EMPTY));
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(initial ? STEPS.length - 1 : 0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "draft" | "validate" | "publish">(null);
  const [validation, setValidation] = useState<ValidationResult | null>(initial?.last_validation ?? null);
  const [preview, setPreview] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  const issues = useMemo(() => stepIssues(d, step, isNew), [d, step, isNew]);
  const rubricSum = d.rubric.reduce((a, r) => a + r.points, 0);
  const module = isNew ? d.slug : initial!.interface.module;

  function payload() {
    return {
      number: d.number ? Number(d.number) : undefined,
      title: d.title.trim(),
      domain: d.domain,
      language: d.language,
      difficulty: d.difficulty,
      kind: d.kind,
      statement_md: d.statement,
      starter_code: starterCode(module, d.ports),
      ports: d.ports.map((p) => ({ ...p, desc: p.desc?.trim() ?? "" })),
      rubric: Object.fromEntries(d.rubric.map((r) => [r.bucket.trim(), r.points])),
      sample_tests: d.samples.filter((s) => s.input.trim() && s.expected.trim()).map((s) => ({ input: s.input.trim(), expected: s.expected.trim() })),
      hints: d.hints.map((h) => h.trim()).filter(Boolean),
      tests: d.tests.map((t) => ({ ...t, test_id: t.test_id.trim(), purpose: t.purpose.trim() })),
      banned_tasks: initial?.constraints.banned_tasks ?? [],
      topics: d.topics,
      reset_sync: d.kind === "sequential" ? d.resetSync : null,
      reset_active_high: d.kind === "sequential" ? d.resetActiveHigh : null,
    };
  }

  async function fail(err: unknown, doing: string) {
    const e = describeError(err, doing);
    toast({ kind: e.kind, title: e.title, body: e.body });
  }

  /** New problems: create the draft once Tests are done, then carry on. */
  async function createDraft() {
    setBusy("draft");
    try {
      const created = await adminCreateProblem({ slug: d.slug, ...payload() } as Parameters<typeof adminCreateProblem>[0]);
      setId(created.id);
      setStatus(created.status);
      setDirty(false);
      toast({ kind: "success", title: "Draft created", body: `${padNumber(created.number)} ${created.title}. Add the bench and reference next.` });
      go(4);
    } catch (err) {
      fail(err, "create the draft");
    } finally {
      setBusy(null);
    }
  }

  /** Saves everything: fields, then the bench and reference. Any save
   * sends the problem back to draft, as the backend requires. */
  async function save(): Promise<boolean> {
    if (!id) return false;
    setBusy("save");
    try {
      await adminUpdateProblem(id, payload());
      if (d.testbench.trim() && d.reference.trim()) await adminSetAssets(id, d.testbench, d.reference);
      setStatus("draft");
      setValidation(null);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["admin-problems"] });
      qc.invalidateQueries({ queryKey: ["admin-summary"] });
      toast({ kind: "success", title: "Saved", body: "Back to draft. Validate again to publish." });
      return true;
    } catch (err) {
      fail(err, "save");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function validate() {
    if (!id) return;
    if (dirty && !(await save())) return;
    setBusy("validate");
    try {
      const r = await adminValidate(id);
      setValidation(r);
      setStatus(r.ok ? "validated" : "draft");
      toast(r.ok ? { kind: "success", title: "All four checks passed", body: "Ready to publish." } : { kind: "warn", title: "Validation failed", body: "See which check failed below." });
    } catch (err) {
      fail(err, "validate");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!id) return;
    setBusy("publish");
    try {
      await adminPublish(id);
      setStatus("published");
      qc.invalidateQueries({ queryKey: ["admin-problems"] });
      qc.invalidateQueries({ queryKey: ["admin-summary"] });
      toast({ kind: "success", title: "Published", body: "Students can see it now.", action: { label: "Open as student", run: () => router.push(`/bitcode/${d.slug}`) } });
    } catch (err) {
      fail(err, "publish");
    } finally {
      setBusy(null);
    }
  }

  async function unpublish() {
    if (!id) return;
    try {
      await adminUnpublish(id);
      setStatus("archived");
      qc.invalidateQueries({ queryKey: ["admin-problems"] });
      qc.invalidateQueries({ queryKey: ["admin-summary"] });
      toast({ kind: "info", title: "Unpublished", body: "Hidden from students. Validate and publish to bring it back." });
    } catch (err) {
      fail(err, "unpublish");
    }
  }

  async function aiDraft() {
    if (!id) return;
    if (dirty && !(await save())) return;
    setBusy("draft");
    try {
      const r = await adminAiDraft(id);
      set("testbench", r.testbench_sv);
      set("reference", r.reference_sv);
      toast({ kind: "info", title: "Draft written", body: "Read it before validating; the gate will catch mistakes, but not every intent." });
    } catch (err) {
      fail(err, "draft with AI");
    } finally {
      setBusy(null);
    }
  }

  function go(i: number) {
    setStep(i);
    setReached((r) => Math.max(r, i));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const next = async () => {
    if (issues.length) return;
    if (isNew && step === 3 && !id) return createDraft();
    if (isNew && step === 4 && id) {
      if (await save()) go(5);
      return;
    }
    go(step + 1);
  };

  return (
    <div style={{ maxWidth: 920 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <div>
          <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", marginBottom: 10 }}>
            <ArrowIcon dir="left" size={12} /> All problems
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>{isNew ? "New problem" : d.title || "Untitled"}</h1>
          {!isNew && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                {padNumber(Number(d.number))} / {d.slug}
              </span>
              <Badge tone={status === "published" ? "pass" : status === "validated" ? "warn" : status === "archived" ? "fail" : "neutral"}>{status}</Badge>
              {dirty && (
                <span className="mono" style={{ fontSize: 11, color: "var(--warn)" }}>
                  UNSAVED CHANGES
                </span>
              )}
            </div>
          )}
        </div>
        {!isNew && (
          <div style={{ display: "flex", gap: 8 }}>
            {status === "published" && (
              <Link href={`/bitcode/${d.slug}`} target="_blank">
                <Button variant="ghost">View as student</Button>
              </Link>
            )}
            <Button variant="primary" onClick={save} loading={busy === "save"} loadingLabel="Saving" disabled={!dirty}>
              Save changes
            </Button>
          </div>
        )}
      </div>

      <Stepper steps={STEPS} current={step} onSelect={isNew ? (i) => i <= reached && setStep(i) : go} reachable={isNew ? (id ? reached : Math.min(reached, 3)) : STEPS.length - 1} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 140px", gap: 12 }}>
                <Field label="Slug" htmlFor="slug" hint={isNew ? "Lowercase snake_case. Becomes the URL and the module name." : "Fixed after creation; it is the module name."}>
                  <Input id="slug" className="mono" value={d.slug} disabled={!isNew} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder="full_adder1" />
                </Field>
                <Field label="Number" htmlFor="number" hint={isNew ? "Blank: next free" : undefined}>
                  <Input id="number" className="mono" inputMode="numeric" value={d.number} onChange={(e) => set("number", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0006" />
                </Field>
              </div>
              <Field label="Title" htmlFor="title" hint="An instruction, like the others: Build a 1-bit full adder.">
                <Input id="title" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="Build a 1-bit full adder" />
              </Field>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={label}>Domain</span>
                <ChannelPicker value={d.domain} onChange={(v) => set("domain", v)} />
              </div>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={label}>Difficulty</span>
                  <Segmented<Difficulty>
                    label="Difficulty"
                    value={d.difficulty}
                    onChange={(v) => set("difficulty", v)}
                    options={(["easy", "medium", "hard"] as Difficulty[]).map((x) => ({ value: x, label: x[0].toUpperCase() + x.slice(1), icon: <DifficultySignal difficulty={x} label={false} /> }))}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={label}>Type</span>
                  <Segmented
                    label="Type"
                    value={d.kind}
                    onChange={(v) => set("kind", v)}
                    options={[
                      { value: "combinational", label: "Combinational" },
                      { value: "sequential", label: "Sequential" },
                    ]}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={label}>Language</span>
                  <Segmented<Language> label="Language" value={d.language} onChange={(v) => set("language", v)} options={(["sv", "v"] as Language[]).map((x) => ({ value: x, label: LANGUAGE_NAME[x] }))} />
                </div>
              </div>
              <Field label="Topics" htmlFor="topics" hint="Shown under the title in the list, for example Counters, Arithmetic. Enter adds one.">
                <TopicInput topics={d.topics} onChange={(v) => set("topics", v)} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label htmlFor="statement" style={label}>
                    Statement
                  </label>
                  <Segmented label="Statement view" value={preview ? "preview" : "write"} onChange={(v) => setPreview(v === "preview")} options={[{ value: "write", label: "Write" }, { value: "preview", label: "Preview" }]} />
                </div>
                {preview ? (
                  <div className="bc-prose" style={{ minHeight: 200, padding: "14px 16px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 15, lineHeight: 1.65 }}>
                    {d.statement.trim() ? <ReactMarkdown>{d.statement}</ReactMarkdown> : <span style={{ color: "var(--fg-faint)" }}>Nothing written yet.</span>}
                  </div>
                ) : (
                  <Textarea id="statement" rows={9} value={d.statement} onChange={(e) => set("statement", e.target.value)} placeholder={"Create a module named `full_adder1`. ...\n\nMarkdown works: `code`, **bold**, lists."} />
                )}
              </div>

              <div>
                <span style={label}>Examples</span>
                <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "4px 0 10px" }}>Shown as EXAMPLE 01 / INPUT and EXPECTED. Plain language is fine.</p>
                {d.samples.map((s, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) 32px", gap: 8, marginBottom: 8 }}>
                    <Input aria-label={`Example ${i + 1} input`} value={s.input} placeholder="a=1, b=1, cin=0" onChange={(e) => set("samples", d.samples.map((x, j) => (j === i ? { ...x, input: e.target.value } : x)))} />
                    <Input aria-label={`Example ${i + 1} expected`} value={s.expected} placeholder="sum=0, cout=1" onChange={(e) => set("samples", d.samples.map((x, j) => (j === i ? { ...x, expected: e.target.value } : x)))} />
                    <Button variant="icon" type="button" aria-label="Remove example" onClick={() => set("samples", d.samples.filter((_, j) => j !== i))}>
                      <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden>
                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </Button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" type="button" onClick={() => set("samples", [...d.samples, { input: "", expected: "" }])}>
                  Add example
                </Button>
              </div>

              <div>
                <span style={label}>Hints</span>
                <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "4px 0 10px" }}>Gentlest first. Students open them one at a time.</p>
                {d.hints.map((h, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr) 32px", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span className="mono" style={{ fontSize: 12, color: "var(--fg-faint)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Input aria-label={`Hint ${i + 1}`} value={h} onChange={(e) => set("hints", d.hints.map((x, j) => (j === i ? e.target.value : x)))} placeholder="A nudge, not the answer" />
                    <Button variant="icon" type="button" aria-label="Remove hint" onClick={() => set("hints", d.hints.filter((_, j) => j !== i))}>
                      <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden>
                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </Button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" type="button" onClick={() => set("hints", [...d.hints, ""])}>
                  Add hint
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <span style={label}>Ports</span>
                <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "4px 0 10px" }}>The description appears in the statement&apos;s port table.</p>
                <PortBuilder ports={d.ports} onChange={(v) => set("ports", v)} />
              </div>
              {d.kind === "sequential" && (
                <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={label}>Reset timing</span>
                    <Segmented label="Reset timing" value={d.resetSync ? "sync" : "async"} onChange={(v) => set("resetSync", v === "sync")} options={[{ value: "sync", label: "Synchronous" }, { value: "async", label: "Asynchronous" }]} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={label}>Reset level</span>
                    <Segmented label="Reset level" value={d.resetActiveHigh ? "high" : "low"} onChange={(v) => set("resetActiveHigh", v === "high")} options={[{ value: "high", label: "Active high" }, { value: "low", label: "Active low" }]} />
                  </div>
                </div>
              )}
              <div>
                <span style={label}>Starter code students get</span>
                <pre className="mono" style={{ margin: "8px 0 0", padding: "12px 14px", fontSize: 12.5, lineHeight: 1.6, background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflowX: "auto" }}>
                  {starterCode(module, d.ports)}
                </pre>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <span style={label}>Rubric</span>
                  <span className="mono tnum" style={{ fontSize: 12, color: rubricSum === 100 ? "var(--pass)" : "var(--warn)" }}>
                    {rubricSum} / 100
                  </span>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <ProgressBar value={rubricSum} tone={rubricSum === 100 ? "pass" : "warn"} />
                </div>
                {d.rubric.map((r, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) 100px 32px", gap: 8, marginBottom: 8 }}>
                    <Input aria-label="Bucket name" className="mono" value={r.bucket} onChange={(e) => set("rubric", d.rubric.map((x, j) => (j === i ? { ...x, bucket: e.target.value } : x)))} />
                    <Input aria-label="Points" type="number" min={0} max={100} value={r.points} onChange={(e) => set("rubric", d.rubric.map((x, j) => (j === i ? { ...x, points: parseInt(e.target.value || "0", 10) } : x)))} />
                    <Button variant="icon" type="button" aria-label="Remove bucket" onClick={() => set("rubric", d.rubric.filter((_, j) => j !== i))}>
                      <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden>
                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </Button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" type="button" onClick={() => set("rubric", [...d.rubric, { bucket: "", points: 0 }])}>
                  Add bucket
                </Button>
              </div>
              <div>
                <span style={label}>Tests</span>
                <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "4px 0 12px" }}>
                  Name each by behaviour, like &quot;wraps from 15 to 0&quot;. Visible tests run on Run with a waveform; keep them first, in the same order the bench checks them.
                </p>
                <TestRowEditor tests={d.tests} buckets={d.rubric.map((r) => r.bucket).filter(Boolean)} onChange={(v) => set("tests", v)} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <p style={{ fontSize: 13.5, color: "var(--fg-muted)", maxWidth: 560 }}>Neither is ever shown to students. The bench must print one result line per test id, visible tests first.</p>
                <Button variant="secondary" onClick={aiDraft} loading={busy === "draft"} loadingLabel="Drafting" disabled={!id}>
                  Draft with AI
                </Button>
              </div>
              <div>
                <span style={label}>Test bench</span>
                <div style={{ marginTop: 8 }}>
                  <CodeEditor value={d.testbench} onChange={(v) => set("testbench", v)} height="300px" />
                </div>
              </div>
              <div>
                <span style={label}>Reference solution</span>
                <div style={{ marginTop: 8 }}>
                  <CodeEditor value={d.reference} onChange={(v) => set("reference", v)} height="240px" />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 18px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 13, color: "var(--fg-muted)" }}>
                  {d.number ? padNumber(Number(d.number)) : "----"}
                </span>
                <span style={{ fontSize: 17, fontWeight: 600 }}>{d.title}</span>
                <DomainBadge domain={d.domain} />
                <DifficultySignal difficulty={d.difficulty} />
                <span className="mono" style={{ fontSize: 12, color: "var(--fg-muted)", marginLeft: "auto" }}>
                  {d.tests.length} tests, {d.tests.filter((t) => t.visible).length} visible
                </span>
              </div>
              {dirty && (
                <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, color: "var(--warn)" }}>
                  <StatusIcon kind="warn" size={14} /> You have unsaved changes. Validate saves them first.
                </div>
              )}
              <ValidatePanel onValidate={validate} onPublish={publish} onUnpublish={unpublish} validating={busy === "validate"} publishing={busy === "publish"} result={validation} status={status} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* step footer: what is missing, and the way forward */}
      {step < 5 && (
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minHeight: 20 }}>
            {issues.length > 0 ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {issues.map((x) => (
                  <li key={x} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, color: "var(--fg-muted)" }}>
                    <span style={{ paddingTop: 2 }}>
                      <StatusIcon kind="warn" size={13} />
                    </span>
                    {x}
                  </li>
                ))}
              </ul>
            ) : (
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13.5, color: "var(--pass)" }}>
                <StatusIcon kind="pass" size={14} /> This step is complete.
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <Button variant="secondary" onClick={() => go(step - 1)}>
                Back
              </Button>
            )}
            <Button variant="primary" onClick={next} disabled={issues.length > 0} loading={busy === "draft" || busy === "save"} loadingLabel={busy === "draft" ? "Creating" : "Saving"}>
              {isNew && step === 3 && !id ? "Create draft" : isNew && step === 4 ? "Save and validate" : "Next"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
