"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CommandPalette, { type Command } from "@/components/bc/CommandPalette";
import { EmptyState, TraceLoader } from "@/components/bc/States";
import { useToast } from "@/components/bc/Toasts";
import type { MonacoEditor } from "@/components/CodeEditor";
import Button from "@/components/ui/Button";
import EditorPane, { type SaveState } from "@/components/workspace/EditorPane";
import ResultsPane, { type ResultsModel, type ResultsTab, type TestRow } from "@/components/workspace/ResultsPane";
import Splitter from "@/components/workspace/Splitter";
import StatementPane, { type StatementTab } from "@/components/workspace/StatementPane";
import TopBar from "@/components/workspace/TopBar";
import type { WaveFocus } from "@/components/bc/WaveformViewer";
import {
  ApiError,
  getProblem,
  getSubmission,
  listProblems,
  runTests,
  submit,
  type ConsoleLine,
  type GradeResponse,
  type Language,
  type ProblemDetail,
  type RunResponse,
  type SubmissionListItem,
  type Waveform,
} from "@/lib/api";
import { DOMAINS, LANGUAGE_EXT } from "@/lib/domains";
import { useHotkeys, useModKey } from "@/lib/hotkeys";
import { useMediaQuery, usePersistentState } from "@/lib/usePersistentState";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { formatVerilog } from "@/lib/verilog-monarch";
import { describeError } from "@/lib/errors";

const MIN_PANE = 320;
const DRAFT_KEY = (slug: string) => `bitcode-draft:${slug}`;

function queuedRows(problem: ProblemDetail, visibleOnly: boolean): TestRow[] {
  return problem.tests
    .filter((t) => !visibleOnly || t.visible)
    .map((t) => ({ number: t.number, id: t.id, visible: t.visible, name: t.name, status: "QUEUED", exp: null, got: null, at_ns: null }));
}

function submitConsole(res: GradeResponse): ConsoleLine[] {
  const lines: ConsoleLine[] = [];
  if (!res.compile.ok) {
    for (const raw of res.compile.errors.split("\n")) {
      const text = raw.trim();
      if (!text) continue;
      const m = text.match(/^(?:student\.sv:(\d+):\s*(?:error:)?\s*|Line (\d+):\s*)(.*)$/);
      const line = m ? Number(m[1] ?? m[2]) : null;
      lines.push({ time: `${res.compile.duration_ms}ms`, source: "CC", level: "error", text: m && line ? text : text.replace(/^tb\.sv:\d+:\s*/, "Test bench: "), line });
    }
    return lines;
  }
  lines.push({ time: `${res.compile.duration_ms}ms`, source: "CC", level: "info", text: "Compiled", line: null });
  const sim = res.simulation;
  if (sim) {
    lines.push({
      time: `${sim.duration_ms}ms`,
      source: "SIM",
      level: res.verdict_word === "ACCEPTED" ? "info" : "error",
      text: `${sim.passed} of ${sim.total} tests passed. ${res.verdict_word}.`,
      line: null,
    });
  }
  return lines;
}

export default function WorkspacePage() {
  const authed = useRequireAuth();
  const { slug } = useParams<{ slug: string }>();
  const problemQuery = useQuery({ queryKey: ["problem", slug], queryFn: () => getProblem(slug), enabled: authed === true });

  if (authed === null || problemQuery.isLoading) {
    return (
      <div style={{ height: "100vh" }}>
        <TraceLoader label="Loading problem" minHeight={0} />
      </div>
    );
  }
  if (problemQuery.isError || !problemQuery.data) {
    const notFound = problemQuery.error instanceof ApiError && problemQuery.error.status === 404;
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center" }}>
        <EmptyState
          tone={notFound ? "neutral" : "error"}
          title={notFound ? "This problem does not exist or is not published" : "Could not load this problem"}
          body={notFound ? undefined : (problemQuery.error as Error)?.message}
          action={
            <a href="/bitcode">
              <Button variant="secondary" size="sm">
                Back to problems
              </Button>
            </a>
          }
        />
      </div>
    );
  }
  return <Workspace key={problemQuery.data.slug} problem={problemQuery.data} />;
}

function Workspace({ problem }: { problem: ProblemDetail }) {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const mod = useModKey();
  const narrow = useMediaQuery("(max-width: 1023px)");

  // ── layout ───────────────────────────────────────────────────────────
  const [split, setSplit] = usePersistentState("bitcode-panes", { left: 0.36, top: 0.62 });
  const [resultsCollapsed, setResultsCollapsed] = usePersistentState("bitcode-results-collapsed", false);
  const [mobileTab, setMobileTab] = useState<"problem" | "code" | "results">("code");
  const [statementTab, setStatementTab] = useState<StatementTab>("problem");
  const [resultsTab, setResultsTab] = useState<ResultsTab>("tests");
  const [language, setLanguage] = useState<Language>(problem.language);
  const fileName = `${problem.interface.module}.${LANGUAGE_EXT[language]}`;

  // ── code and drafts ──────────────────────────────────────────────────
  const [code, setCode] = useState(problem.starter_code);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const editorRef = useRef<MonacoEditor | null>(null);
  const loadedDraft = useRef(false);

  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY(problem.slug));
      if (draft !== null) setCode(draft);
    } catch {
      /* storage blocked: start from the starter code */
    }
    loadedDraft.current = true;
  }, [problem.slug]);

  const saveNow = useCallback(
    (value: string) => {
      try {
        localStorage.setItem(DRAFT_KEY(problem.slug), value);
        setSaveState("saved");
        return true;
      } catch {
        setSaveState("unsaved");
        return false;
      }
    },
    [problem.slug],
  );

  // Autosave 700ms after the last edit.
  useEffect(() => {
    if (!loadedDraft.current || saveState === "saved") return;
    const t = window.setTimeout(() => saveNow(code), 700);
    return () => window.clearTimeout(t);
  }, [code, saveState, saveNow]);

  // Leaving must never lose the last keystrokes still inside that 700ms
  // window: flush the draft when the student navigates away inside the
  // app (unmount), closes or reloads the tab (pagehide), or switches away
  // (hidden). Refs, so the handlers always see the latest buffer.
  const latest = useRef({ code, dirty: false });
  latest.current = { code, dirty: saveState !== "saved" };
  useEffect(() => {
    const flush = () => {
      if (loadedDraft.current && latest.current.dirty) saveNow(editorRef.current?.getValue() ?? latest.current.code);
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [saveNow]);

  function onCodeChange(v: string) {
    setCode(v);
    setSaveState("unsaved");
  }

  /** Replace the whole buffer through Monaco, so the change can be undone. */
  function replaceCode(next: string) {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (ed && model) {
      ed.pushUndoStop();
      ed.executeEdits("bitcode", [{ range: model.getFullModelRange(), text: next }]);
      ed.pushUndoStop();
    } else {
      onCodeChange(next);
    }
  }

  function revealLine(line: number) {
    const ed = editorRef.current;
    if (narrow) setMobileTab("code");
    if (!ed) return;
    ed.revealLineInCenter(line);
    ed.setPosition({ lineNumber: line, column: 1 });
    ed.focus();
  }

  // ── run / submit ─────────────────────────────────────────────────────
  const [model, setModel] = useState<ResultsModel>(() => ({
    kind: null,
    phase: "idle",
    rows: queuedRows(problem, true),
    console: [],
    seq: 0,
    note: `${problem.tests.filter((t) => !t.visible).length} hidden tests also run on Submit.`,
  }));
  const [lastRun, setLastRun] = useState<RunResponse | null>(null);
  const [waveFocus, setWaveFocus] = useState<WaveFocus | null>(null);
  const [pulse, setPulse] = useState(0);

  const runMut = useMutation({
    mutationFn: () => runTests(problem.slug, code),
    onMutate: () => {
      setModel((m) => ({ ...m, kind: "run", phase: "running", rows: queuedRows(problem, true), verdictWord: undefined }));
    },
    onSuccess: (res) => {
      setLastRun(res);
      const hidden = problem.tests.filter((t) => !t.visible).length;
      setModel((m) => ({
        kind: "run",
        phase: "done",
        verdictWord: res.verdict_word,
        timedOut: res.timed_out,
        rows: res.tests.map((t) => ({ ...t, name: t.name ?? null })),
        durationMs: res.duration_ms,
        console: res.console,
        note: `Run checks the visible tests only. ${hidden} hidden tests also run on Submit.`,
        seq: m.seq + 1,
      }));
      if (res.verdict_word === "COMPILE ERROR") setResultsTab("console");
      if (res.verdict_word === "PASSED") setPulse((p) => p + 1);
    },
    onError: (err) => {
      const d = describeError(err, "run the tests");
      setModel((m) => ({ ...m, phase: "error", error: d, seq: m.seq + 1 }));
      toast({ kind: d.kind, title: d.title, body: d.body, action: d.retryable ? { label: "Run again", run: () => runRef.current() } : undefined });
    },
  });

  const submitMut = useMutation({
    mutationFn: () => submit(problem.slug, code),
    onMutate: () => {
      setModel((m) => ({ ...m, kind: "submit", phase: "running", rows: queuedRows(problem, false), verdictWord: undefined }));
      setResultsTab("tests");
    },
    onSuccess: (res) => {
      const tests = res.simulation?.tests;
      setModel((m) => ({
        kind: "submit",
        phase: "done",
        verdictWord: res.verdict_word,
        timedOut: res.simulation?.timed_out,
        rows: tests ? tests.map((t) => ({ ...t, name: t.name ?? null })) : queuedRows(problem, false).map((r) => ({ ...r, status: "UNCERTAIN" as const })),
        durationMs: res.simulation?.duration_ms ?? res.compile.duration_ms,
        console: submitConsole(res),
        ai: res.ai_feedback,
        seq: m.seq + 1,
      }));
      if (res.verdict_word === "COMPILE ERROR") setResultsTab("console");
      if (res.verdict_word === "ACCEPTED") setPulse((p) => p + 1);
      qc.invalidateQueries({ queryKey: ["my-submissions", problem.slug] });
      qc.invalidateQueries({ queryKey: ["problems"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["recent"] });
    },
    onError: (err) => {
      const d = describeError(err, "submit");
      setModel((m) => ({ ...m, phase: "error", error: d, seq: m.seq + 1 }));
      toast({ kind: d.kind, title: d.title, body: d.body, action: d.retryable ? { label: "Submit again", run: () => submitRef.current() } : undefined });
    },
  });

  /** Undo the last whole-buffer replace (reset or loaded submission). */
  const undo = () => {
    editorRef.current?.trigger("bitcode", "undo", null);
    editorRef.current?.focus();
  };

  const busy: "run" | "submit" | null = runMut.isPending ? "run" : submitMut.isPending ? "submit" : null;
  const doRun = () => {
    if (busy) return;
    if (resultsCollapsed) setResultsCollapsed(false);
    if (narrow) setMobileTab("results");
    runMut.mutate();
  };
  const doSubmit = () => {
    if (busy) return;
    if (resultsCollapsed) setResultsCollapsed(false);
    if (narrow) setMobileTab("results");
    submitMut.mutate();
  };

  // Toast actions outlive the render that created them; go through refs.
  const runRef = useRef(doRun);
  const submitRef = useRef(doSubmit);
  runRef.current = doRun;
  submitRef.current = doSubmit;

  function showInWaveform(t: number) {
    setResultsTab("waveform");
    setWaveFocus({ t, nonce: Date.now() });
  }

  const mismatches = useMemo(
    () => (lastRun?.tests ?? []).filter((t) => t.status === "FAIL" && t.at_ns !== null).map((t) => ({ at: t.at_ns as number })),
    [lastRun],
  );
  const waveform: Waveform | null = lastRun?.waveform ?? null;
  const waveNote = waveform ? "Shows the visible tests only. The trace stops before the first hidden test." : undefined;

  async function openSubmission(s: SubmissionListItem) {
    try {
      const full = await getSubmission(s.id);
      if (full.code) {
        replaceCode(full.code);
        toast({ kind: "info", title: "Submission loaded", body: `Your ${(s.verdict_word || "earlier").toLowerCase()} attempt is in the editor.`, action: { label: "Undo", run: undo } });
        if (narrow) setMobileTab("code");
      }
    } catch (err) {
      const d = describeError(err, "load that submission");
      toast({ kind: d.kind, title: d.title, body: d.body });
    }
  }

  function format() {
    const ed = editorRef.current;
    const current = ed?.getValue() ?? code;
    const next = formatVerilog(current);
    if (next !== current) replaceCode(next);
  }

  function resetToStarter() {
    replaceCode(problem.starter_code);
    toast({ kind: "info", title: "Back to the starter code", body: "Your previous code is one undo away.", action: { label: "Undo", run: undo } });
  }

  // ── neighbours for ⌘] and ⌘[ ─────────────────────────────────────────
  const all = useQuery({ queryKey: ["problems-nav"], queryFn: () => listProblems({ limit: 100 }), staleTime: 60_000 });
  const neighbours = useMemo(() => {
    const items = all.data?.items ?? [];
    const i = items.findIndex((p) => p.slug === problem.slug);
    return { prev: i > 0 ? items[i - 1] : null, next: i >= 0 && i < items.length - 1 ? items[i + 1] : null };
  }, [all.data, problem.slug]);

  const go = (p: { slug: string } | null) => p && router.push(`/bitcode/${p.slug}`);

  useHotkeys([
    { combo: "mod+shift+enter", handler: doSubmit },
    { combo: "mod+enter", handler: doRun },
    { combo: "alt+shift+f", handler: format },
    { combo: "mod+j", handler: () => setResultsCollapsed((c) => !c) },
    { combo: "mod+1", handler: () => (setResultsCollapsed(false), setResultsTab("tests")) },
    { combo: "mod+2", handler: () => (setResultsCollapsed(false), setResultsTab("console")) },
    { combo: "mod+3", handler: () => (setResultsCollapsed(false), setResultsTab("waveform")) },
    { combo: "mod+]", handler: () => go(neighbours.next) },
    { combo: "mod+[", handler: () => go(neighbours.prev) },
    { combo: "mod+e", handler: () => (narrow && setMobileTab("code"), editorRef.current?.focus()) },
    {
      combo: "mod+s",
      handler: () => {
        if (saveNow(editorRef.current?.getValue() ?? code)) toast({ kind: "success", title: "Draft saved", body: "Kept on this device. It autosaves as you type too." });
        else toast({ kind: "error", title: "Could not save the draft", body: "This browser is blocking storage, so copy your code somewhere safe." });
      },
    },
  ]);

  const commands: Command[] = [
    { id: "run", group: "Workspace", label: "Run visible tests", shortcut: [mod, "⏎"], run: doRun },
    { id: "submit", group: "Workspace", label: "Submit", shortcut: [mod, "⇧", "⏎"], run: doSubmit },
    { id: "format", group: "Workspace", label: "Format code", shortcut: ["⌥", "⇧", "F"], run: format },
    { id: "results", group: "Workspace", label: resultsCollapsed ? "Show results" : "Hide results", shortcut: [mod, "J"], run: () => setResultsCollapsed((c) => !c) },
    { id: "tests", group: "Workspace", label: "Show tests", shortcut: [mod, "1"], run: () => setResultsTab("tests") },
    { id: "console", group: "Workspace", label: "Show console", shortcut: [mod, "2"], run: () => setResultsTab("console") },
    { id: "waveform", group: "Workspace", label: "Show waveform", shortcut: [mod, "3"], run: () => setResultsTab("waveform") },
    { id: "focus", group: "Workspace", label: "Focus editor", shortcut: [mod, "E"], run: () => editorRef.current?.focus() },
    { id: "reset", group: "Workspace", label: "Reset to starter code", run: resetToStarter },
    ...(neighbours.next ? [{ id: "next", group: "Workspace", label: "Next problem", shortcut: [mod, "]"], run: () => go(neighbours.next) }] : []),
    ...(neighbours.prev ? [{ id: "prev", group: "Workspace", label: "Previous problem", shortcut: [mod, "["], run: () => go(neighbours.prev) }] : []),
  ];

  // ── panes ────────────────────────────────────────────────────────────
  const statement = <StatementPane problem={problem} tab={statementTab} onTab={setStatementTab} onOpenSubmission={openSubmission} onSubmit={doSubmit} mod={mod} />;
  const editor = (
    <EditorPane
      fileName={fileName}
      code={code}
      onChange={onCodeChange}
      saveState={saveState}
      onFormat={format}
      onReset={resetToStarter}
      onEditor={(e) => (editorRef.current = e)}
      formatShortcut="⌥⇧F"
    />
  );
  const results = (
    <ResultsPane
      model={model}
      tab={resultsTab}
      onTab={setResultsTab}
      waveform={waveform}
      mismatches={mismatches}
      waveNote={waveNote}
      waveFocus={waveFocus}
      onShowInWaveform={showInWaveform}
      onRevealLine={revealLine}
      mod={mod}
      collapsed={!narrow && resultsCollapsed}
      onToggleCollapsed={() => setResultsCollapsed((c) => !c)}
      fileName={fileName}
      onRun={doRun}
      onRetry={() => (model.kind === "submit" ? doSubmit() : doRun())}
      channel={DOMAINS[problem.domain].fill}
    />
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <CommandPalette commands={commands} />
      <TopBar
        problem={problem}
        language={language}
        onLanguage={setLanguage}
        onRun={doRun}
        onSubmit={doSubmit}
        busy={busy}
        mod={mod}
        pulse={pulse}
        compact={narrow}
      />

      {narrow ? (
        <>
          <div style={{ flex: 1, minHeight: 0 }}>
            <div style={{ height: "100%", display: mobileTab === "problem" ? "block" : "none" }}>{statement}</div>
            <div style={{ height: "100%", display: mobileTab === "code" ? "block" : "none" }}>{editor}</div>
            <div style={{ height: "100%", display: mobileTab === "results" ? "block" : "none" }}>{results}</div>
          </div>
          <nav
            aria-label="Workspace panes"
            style={{ flex: "none", display: "flex", justifyContent: "center", padding: "10px 16px calc(10px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--border)" }}
          >
            <div style={{ display: "flex", gap: 4, padding: 4, border: "1px solid var(--border-strong)", borderRadius: "var(--r-full)" }}>
              {(["problem", "code", "results"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setMobileTab(t)}
                  aria-pressed={mobileTab === t}
                  style={{
                    height: 36,
                    padding: "0 18px",
                    border: 0,
                    borderRadius: "var(--r-full)",
                    fontSize: 14,
                    fontWeight: 600,
                    textTransform: "capitalize",
                    background: mobileTab === t ? "var(--fg)" : "transparent",
                    color: mobileTab === t ? "var(--bg)" : "var(--fg-muted)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </nav>
        </>
      ) : (
        <div style={{ flex: 1, minHeight: 0, padding: 8 }}>
          <div
            style={{
              height: "100%",
              display: "flex",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              overflow: "hidden",
            }}
          >
            <div style={{ width: `${split.left * 100}%`, minWidth: MIN_PANE, minHeight: 0 }}>{statement}</div>
            <Splitter direction="row" fraction={split.left} minPx={MIN_PANE} onChange={(f) => setSplit((s) => ({ ...s, left: f }))} label="Resize problem pane" />
            <div style={{ flex: 1, minWidth: MIN_PANE, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ flex: resultsCollapsed ? 1 : `0 0 ${split.top * 100}%`, minHeight: 160 }}>{editor}</div>
              {!resultsCollapsed && (
                <Splitter direction="column" fraction={split.top} minPx={120} onChange={(f) => setSplit((s) => ({ ...s, top: f }))} label="Resize results pane" />
              )}
              <div style={{ flex: resultsCollapsed ? "0 0 41px" : 1, minHeight: resultsCollapsed ? 41 : 120 }}>{results}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
