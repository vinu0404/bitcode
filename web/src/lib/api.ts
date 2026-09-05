"use client";

import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";

// Relative by default: Next.js proxies /api/* server-side to the api
// container (see next.config.mjs rewrites), so the browser only ever talks
// to whatever origin served the page — no CORS, and it works unmodified
// behind a tunnel (ngrok, etc.) since the proxy runs server-side.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
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

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !retried) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options, true);
    clearTokens();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "unauthorized", "Session expired");
  }

  if (!res.ok) {
    let body: { code?: string; message?: string; detail?: unknown } = {};
    try {
      body = await res.json();
    } catch {
      /* non-JSON error body */
    }
    const message = body.message || (Array.isArray(body.detail) ? body.detail.map((d: any) => d.msg).join(", ") : res.statusText);
    throw new ApiError(res.status, body.code || "error", message);
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
export interface Port {
  name: string;
  dir: "input" | "output";
  width: number;
}

export interface Topic {
  id: string;
  slug: string;
  name: string;
}

export interface ProblemListItem {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  kind: string;
  solved: boolean;
  topics: Topic[];
}

export interface ProblemDetail {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  kind: string;
  statement_md: string;
  starter_code: string;
  interface: { module: string; ports: Port[] };
  rubric: Record<string, number>;
  sample_tests: Array<{ input: string; expected: string }>;
  topics: Topic[];
}

export interface TestOutcome {
  id: string;
  status: "PASS" | "FAIL" | "UNCERTAIN";
  category: string;
  purpose: string;
}

export interface GradeResponse {
  submission_id: string;
  mode: string;
  verdict: "CORRECT" | "PARTIAL" | "INCORRECT" | "NEEDS_VERIFICATION";
  compile: { ok: boolean; errors: string; warnings: string };
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

export interface VecComparison {
  inputs: Record<string, string>;
  your_output: Record<string, string>;
  expected_output: Record<string, string>;
  match: boolean;
}

export interface WaveSignal {
  name: string;
  width: number;
  changes: [number, string][]; // [time in ns, value]
}

export interface Waveform {
  end_time: number;
  signals: WaveSignal[];
}

export interface RunResponse {
  compile: { ok: boolean; errors: string; warnings: string };
  ran: boolean;
  timed_out: boolean;
  comparisons: VecComparison[];
  // Only ever populated here, never on a graded submission — the
  // student's own inputs have nothing hidden to protect. See the design
  // doc's "why no full log" note.
  raw_log: string;
  waveform: Waveform | null;
}

// ── problems / submissions ─────────────────────────────────────────────
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function listProblems(opts?: { q?: string; difficulty?: string; topic?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.q) params.set("q", opts.q);
  if (opts?.difficulty) params.set("difficulty", opts.difficulty);
  if (opts?.topic) params.set("topic", opts.topic);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return request<Page<ProblemListItem>>(`/api/problems${qs ? `?${qs}` : ""}`);
}

// ── dashboard stats ────────────────────────────────────────────────────
export interface DifficultyBucket {
  difficulty: string;
  solved: number;
  total: number;
}
export interface TopicBucket {
  topic: Topic;
  solved: number;
  total: number;
}
export interface HeatmapDay {
  date: string;
  count: number;
}
export interface MeStats {
  total_solved: number;
  total_problems: number;
  by_difficulty: DifficultyBucket[];
  by_topic: TopicBucket[];
  heatmap: HeatmapDay[];
  current_streak: number;
}
export function getMyStats() {
  return request<MeStats>("/api/me/stats");
}

export function getProblem(slug: string) {
  return request<ProblemDetail>(`/api/problems/${slug}`);
}

export function submit(problem_slug: string, code: string) {
  return request<GradeResponse>("/api/submissions", {
    method: "POST",
    body: JSON.stringify({ problem_slug, code }),
  });
}

export function runCustom(problem_slug: string, code: string, vectors: Record<string, string>[]) {
  return request<RunResponse>("/api/submissions/run", {
    method: "POST",
    body: JSON.stringify({ problem_slug, code, vectors }),
  });
}

// ── admin ───────────────────────────────────────────────────────────────
export interface AdminProblem {
  id: string;
  slug: string;
  title: string;
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
}

export interface ProblemCreatePayload {
  slug: string;
  title: string;
  difficulty: string;
  kind: string;
  statement_md: string;
  starter_code?: string;
  ports: Port[];
  rubric: Record<string, number>;
  sample_tests: Array<{ input: string; expected: string }>;
  tests: TestIn[];
  banned_tasks: string[];
  reset_sync?: boolean;
  reset_active_high?: boolean;
  topics: string[]; // names — server finds-or-creates, no separate "manage topics" step
}

export function adminListProblems(opts?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
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
