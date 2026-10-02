"use client";

import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";

// Relative by default: Next.js proxies /api/* server-side to the api
// container (see next.config.mjs rewrites), so the browser only ever talks
// to the origin that served the page. No CORS, and it works unchanged
// behind a tunnel since the proxy runs server-side.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export class ApiError extends Error {
  /** 0 when the request never reached the server (offline, DNS, CORS). */
  status: number;
  code: string;
  /** Seconds to wait before retrying, from a 429's Retry-After. */
  retryAfter: number | null;
  /** Per-field messages from a 422, keyed by field name. */
  fields: Record<string, string>;
  constructor(status: number, code: string, message: string, opts: { retryAfter?: number | null; fields?: Record<string, string> } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = opts.retryAfter ?? null;
    this.fields = opts.fields ?? {};
  }
  get offline() {
    return this.status === 0;
  }
}

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return true;
}

async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const access = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (access) headers["Authorization"] = `Bearer ${access}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    // fetch only rejects when no response came back at all.
    throw new ApiError(0, "offline", "No connection to Bitcode.");
  }

  // Login itself answers 401 for a wrong password; only treat 401 as an
  // expired session when the request carried a token.
  if (res.status === 401 && access && !retried) {
    const refreshed = await tryRefresh().catch(() => false);
    if (refreshed) return request<T>(path, options, true);
    clearTokens();
    if (typeof window !== "undefined") {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}&reason=expired`;
    }
    throw new ApiError(401, "session_expired", "Your session ended.");
  }

  if (!res.ok) {
    let body: { code?: string; message?: string; detail?: unknown; retry_after?: number } = {};
    try {
      body = await res.json();
    } catch {
      /* non-JSON error body, e.g. a proxy error page */
    }
    const fields: Record<string, string> = {};
    if (Array.isArray(body.detail)) {
      for (const d of body.detail as Array<{ loc?: unknown[]; msg?: string }>) {
        const name = String(d.loc?.[d.loc.length - 1] ?? "");
        if (name && d.msg) fields[name] = d.msg.replace(/^Value error, /, "");
      }
    }
    const message = body.message || Object.values(fields).join(" ") || res.statusText || "Request failed.";
    const header = Number(res.headers.get("Retry-After"));
    throw new ApiError(res.status, body.code || (res.status >= 500 ? "server_error" : "error"), message, {
      retryAfter: body.retry_after ?? (Number.isFinite(header) && header > 0 ? header : null),
      fields,
    });
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── auth ────────────────────────────────────────────────────────────────
export async function register(email: string, password: string) {
  const data = await request<{ access_token: string; refresh_token: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function login(email: string, password: string) {
  const data = await request<{ access_token: string; refresh_token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function logout() {
  const refresh = getRefreshToken();
  clearTokens();
  if (refresh) {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
    } catch {
      /* best-effort */
    }
  }
}

export interface Me {
  id: string;
  email: string;
  role: string;
  created_at: string;
}
export function getMe() {
  return request<Me>("/api/auth/me");
}

// ── types ───────────────────────────────────────────────────────────────
export type Domain = "vlsi" | "embedded" | "communication" | "others";
export type Difficulty = "easy" | "medium" | "hard";
export type Language = "sv" | "v";
export type ProblemStatus = "solved" | "attempted" | "new";
export type TestStatus = "PASS" | "FAIL" | "UNCERTAIN";
export type VerdictWord = "ACCEPTED" | "WRONG ANSWER" | "COMPILE ERROR" | "TIME LIMIT" | "RUNTIME ERROR";
export type RunVerdictWord = "PASSED" | "WRONG ANSWER" | "COMPILE ERROR" | "TIME LIMIT" | "RUNTIME ERROR";

export interface Port {
  name: string;
  dir: "input" | "output";
  width: number;
  desc?: string;
}

export interface Topic {
  id: string;
  slug: string;
  name: string;
}

export interface ProblemListItem {
  id: string;
  slug: string;
  number: number;
  title: string;
  domain: Domain;
  language: Language;
  difficulty: Difficulty;
  kind: string;
  status: ProblemStatus;
  acceptance: number | null;
  topics: Topic[];
}

export interface TestCase {
  number: number;
  id: string;
  visible: boolean;
  name: string | null;
}

export interface ProblemDetail {
  id: string;
  slug: string;
  number: number;
  title: string;
  domain: Domain;
  language: Language;
  difficulty: Difficulty;
  kind: string;
  statement_md: string;
  starter_code: string;
  interface: { module: string; ports: Port[] };
  constraints: string[];
  rubric: Record<string, number>;
  sample_tests: Array<{ input: string; expected: string }>;
  hints: string[];
  tests: TestCase[];
  status: ProblemStatus;
  topics: Topic[];
}

export interface TestOutcome {
  number: number;
  id: string;
  status: TestStatus;
  visible: boolean;
  name: string | null;
  exp: string | null;
  got: string | null;
  at_ns: number | null;
}

export interface CompileInfo {
  ok: boolean;
  errors: string;
  warnings: string;
  duration_ms: number;
}

export interface GradeResponse {
  submission_id: string;
  mode: string;
  verdict: "CORRECT" | "PARTIAL" | "INCORRECT" | "NEEDS_VERIFICATION";
  verdict_word: VerdictWord;
  created_at: string | null;
  code: string | null;
  compile: CompileInfo;
  simulation: {
    ran: boolean;
    timed_out: boolean;
    undefined_outputs: boolean;
    passed: number;
    total: number;
    duration_ms: number;
    tests: TestOutcome[];
  } | null;
  score: { total: number; breakdown: Record<string, number> } | null;
  ai_feedback: { summary: string; hint: string; confidence: string; model: string; generated: boolean } | null;
}

export interface WaveSignal {
  name: string;
  width: number;
  kind: "clock" | "input" | "output" | "";
  changes: [number, string][]; // [time in ns, value]
}

export interface Waveform {
  end_time: number;
  signals: WaveSignal[];
}

export interface ConsoleLine {
  time: string;
  source: "CC" | "TB" | "SIM";
  level: "info" | "warn" | "error";
  text: string;
  line: number | null;
}

export interface RunResponse {
  verdict_word: RunVerdictWord;
  compile: CompileInfo;
  ran: boolean;
  timed_out: boolean;
  duration_ms: number;
  tests: TestOutcome[];
  console: ConsoleLine[];
  waveform: Waveform | null;
}

export interface SubmissionListItem {
  id: string;
  created_at: string;
  verdict: string;
  verdict_word: VerdictWord | "";
  passed: number | null;
  total: number | null;
  score: number | null;
  sim_ms: number | null;
}

// ── problems / submissions ─────────────────────────────────────────────
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProblemFilters {
  q?: string;
  domain?: Domain;
  difficulty?: Difficulty;
  language?: Language;
  status?: ProblemStatus;
  limit?: number;
  offset?: number;
}

export function listProblems(f: ProblemFilters = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") params.set(k, String(v));
  const qs = params.toString();
  return request<Page<ProblemListItem>>(`/api/problems${qs ? `?${qs}` : ""}`);
}

export function getProblem(slug: string) {
  return request<ProblemDetail>(`/api/problems/${slug}`);
}

export function listMySubmissions(slug: string, opts: { limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return request<Page<SubmissionListItem>>(`/api/problems/${slug}/submissions${qs ? `?${qs}` : ""}`);
}

export function getSubmission(id: string) {
  return request<GradeResponse>(`/api/submissions/${id}`);
}

export function submit(problem_slug: string, code: string) {
  return request<GradeResponse>("/api/submissions", {
    method: "POST",
    body: JSON.stringify({ problem_slug, code }),
  });
}

export function runTests(problem_slug: string, code: string) {
  return request<RunResponse>("/api/submissions/run", {
    method: "POST",
    body: JSON.stringify({ problem_slug, code }),
  });
}

// ── progress ───────────────────────────────────────────────────────────
export interface MeStats {
  total_solved: number;
  total_attempted: number;
  total_problems: number;
  total_submissions: number;
  by_difficulty: Array<{ difficulty: Difficulty; solved: number; total: number }>;
  by_domain: Array<{ domain: Domain; solved: number; total: number }>;
  by_topic: Array<{ topic: Topic; solved: number; total: number }>;
  heatmap: Array<{ date: string; solved: number; submissions: number }>;
  current_streak: number;
  longest_streak: number;
}
export function getMyStats() {
  return request<MeStats>("/api/me/stats");
}

// ── admin ───────────────────────────────────────────────────────────────
export interface AdminProblem {
  id: string;
  slug: string;
  number: number;
  title: string;
  domain: Domain;
  language: Language;
  difficulty: string;
  kind: string;
  status: string;
  order_index: number;
  rubric: Record<string, number>;
  topics: Topic[];
}

export interface TestIn {
  test_id: string;
  purpose: string;
  category: string;
  hint: string;
  bucket: string;
  visible: boolean;
}

export interface ProblemCreatePayload {
  slug: string;
  number?: number;
  title: string;
  domain: Domain;
  language: Language;
  hints: string[];
  difficulty: string;
  kind: string;
  statement_md: string;
  starter_code?: string;
  ports: Port[];
  rubric: Record<string, number>;
  sample_tests: Array<{ input: string; expected: string }>;
  tests: TestIn[];
  banned_tasks: string[];
  reset_sync?: boolean | null;
  reset_active_high?: boolean | null;
  topics: string[]; // names; the server finds or creates each one
}

export function adminListProblems(opts?: { limit?: number; offset?: number; status?: string }) {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return request<Page<AdminProblem>>(`/api/admin/problems${qs ? `?${qs}` : ""}`);
}

export function adminCreateProblem(payload: ProblemCreatePayload) {
  return request<AdminProblem>("/api/admin/problems", { method: "POST", body: JSON.stringify(payload) });
}

export function adminSetAssets(id: string, testbench_sv: string, reference_sv: string) {
  return request<AdminProblem>(`/api/admin/problems/${id}/assets`, {
    method: "PUT",
    body: JSON.stringify({ testbench_sv, reference_sv }),
  });
}

export function adminAiDraft(id: string) {
  return request<{ testbench_sv: string; reference_sv: string }>(`/api/admin/problems/${id}/ai-draft`, {
    method: "POST",
  });
}

export function adminValidate(id: string) {
  return request<{ ok: boolean; ref_score: number | null; stub_score: number | null; log: string }>(
    `/api/admin/problems/${id}/validate`,
    { method: "POST" }
  );
}

export function adminPublish(id: string) {
  return request<AdminProblem>(`/api/admin/problems/${id}/publish`, { method: "POST" });
}

// ── public (no login) ──────────────────────────────────────────────────
export interface PublicCatalogue {
  total: number;
  by_domain: Partial<Record<Domain, number>>;
  items: Array<{ slug: string; number: number; title: string; difficulty: Difficulty; domain: Domain }>;
}
export function getCatalogue(limit = 4) {
  return request<PublicCatalogue>(`/api/public/catalogue?limit=${limit}`);
}

// ── progress: recent attempts and what to do next ──────────────────────
export interface MeRecent {
  recent: Array<{
    submission_id: string;
    created_at: string;
    slug: string;
    number: number;
    title: string;
    domain: Domain;
    verdict_word: VerdictWord | "";
    passed: number | null;
    total: number | null;
  }>;
  next_up: { slug: string; number: number; title: string; domain: Domain; difficulty: Difficulty; status: "attempted" | "new" } | null;
}
export function getMyRecent(limit = 5) {
  return request<MeRecent>(`/api/me/recent?limit=${limit}`);
}

// ── admin: edit an existing problem ────────────────────────────────────
export interface ValidationResult {
  ok: boolean;
  ref_score: number | null;
  stub_score: number | null;
  log: string;
}

export interface AdminProblemDetail extends AdminProblem {
  statement_md: string;
  starter_code: string;
  interface: { module: string; ports: Port[] };
  constraints: { banned_tasks?: string[]; reset?: { sync: boolean; active_high: boolean } };
  sample_tests: Array<{ input: string; expected: string }>;
  hints: string[];
  tests: TestIn[];
  testbench_sv: string;
  reference_sv: string;
  last_validation: ValidationResult | null;
}

export function adminGetProblem(id: string) {
  return request<AdminProblemDetail>(`/api/admin/problems/${id}`);
}

export type ProblemUpdatePayload = Partial<Omit<ProblemCreatePayload, "slug">>;

export function adminUpdateProblem(id: string, payload: ProblemUpdatePayload) {
  return request<AdminProblem>(`/api/admin/problems/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function adminUnpublish(id: string) {
  return request<AdminProblem>(`/api/admin/problems/${id}/unpublish`, { method: "POST" });
}

export function adminSummary() {
  return request<{ total: number; by_status: Record<string, number> }>("/api/admin/problems/summary");
}
