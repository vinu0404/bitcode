"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { describeError } from "@/lib/errors";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { StatusIcon } from "./Status";
import { Wordmark } from "./AppHeader";
import ScopeField from "@/components/landing/ScopeField";

/** Log in and register share one layout: a single card on a graticule. */
export default function AuthForm({ mode, action }: { mode: "login" | "register"; action: (email: string, password: string) => Promise<unknown> }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/bitcode";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // A form-level problem (offline, server) and per-field ones, separately:
  // a wrong password belongs under the password, not in a banner.
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const expired = params.get("reason") === "expired";
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErr({});
    setLoading(true);
    try {
      await action(email, password);
      router.push(safeNext);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFieldErr({ password: "That email and password do not match. Check both and try again." });
      } else if (err instanceof ApiError && err.status === 409) {
        setFieldErr({ email: "There is already an account with this email. Log in instead." });
      } else if (err instanceof ApiError && err.status === 422 && (err.fields.email || err.fields.password)) {
        setFieldErr({ email: err.fields.email && "Enter a full email address, like name@college.edu.", password: err.fields.password && "Use at least 8 characters." });
      } else {
        const d = describeError(err, isLogin ? "log you in" : "create your account");
        setError({ title: d.title, body: d.body });
      }
    } finally {
      setLoading(false);
    }
  }

  const other = isLogin ? "/register" : "/login";
  const otherHref = next ? `${other}?next=${encodeURIComponent(safeNext)}` : other;

  return (
    <main style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflow: "hidden" }}>
      <ScopeField interactive={false} intensity={0.75} />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 400,
          padding: 32,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
        }}
      >
        <Link href="/" aria-label="Bitcode home">
          <Wordmark size={38} />
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "28px 0 24px" }}>{isLogin ? "Log in" : "Create an account"}</h1>
        {expired && isLogin && !error && (
          <div role="status" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", marginBottom: 18, borderRadius: "var(--r-sm)", background: "color-mix(in srgb, var(--warn) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--warn) 40%, transparent)" }}>
            <StatusIcon kind="warn" size={14} />
            <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>
              <strong style={{ fontWeight: 600 }}>Your session ended.</strong> <span style={{ color: "var(--fg-muted)" }}>Log in and you will land back where you were. Drafts are still saved.</span>
            </span>
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Email" htmlFor="email" error={fieldErr.email}>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErr.email) setFieldErr((f) => ({ ...f, email: undefined }));
              }}
              required
              autoComplete="email"
              aria-invalid={!!fieldErr.email}
              aria-describedby={fieldErr.email ? "email-error" : undefined}
            />
          </Field>
          <Field label="Password" htmlFor="password" hint={isLogin ? undefined : "At least 8 characters."} error={fieldErr.password}>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErr.password) setFieldErr((f) => ({ ...f, password: undefined }));
              }}
              aria-invalid={!!fieldErr.password}
              aria-describedby={fieldErr.password ? "password-error" : undefined}
              required
              minLength={isLogin ? undefined : 8}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </Field>
          {error && (
            <div role="alert" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "color-mix(in srgb, var(--fail) 9%, transparent)", border: "1px solid color-mix(in srgb, var(--fail) 40%, transparent)" }}>
              <StatusIcon kind="fail" size={14} />
              <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                <strong style={{ fontWeight: 600 }}>{error.title}.</strong> <span style={{ color: "var(--fg-muted)" }}>{error.body}</span>
              </span>
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" loading={loading} loadingLabel={isLogin ? "Logging in" : "Creating"} style={{ width: "100%", marginTop: 4 }}>
            {isLogin ? "Log in" : "Create account"}
          </Button>
        </form>
        <p style={{ fontSize: 13.5, color: "var(--fg-muted)", marginTop: 20 }}>
          {isLogin ? "No account yet? " : "Already registered? "}
          <Link href={otherHref} style={{ color: "var(--ch3-text)", fontWeight: 600 }}>
            {isLogin ? "Create one" : "Log in"}
          </Link>
        </p>
      </div>
    </main>
  );
}
