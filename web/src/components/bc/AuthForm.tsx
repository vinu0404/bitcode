"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { describeError } from "@/lib/errors";
import { googleEnabled, supabase } from "@/lib/supabase";
import Button, { ArrowIcon } from "@/components/ui/Button";
import ScopeField from "@/components/landing/ScopeField";
import { StatusIcon } from "./Status";
import { Wordmark } from "./AppHeader";

/* Log in and register share one screen: a brand panel on the left that
   says what Bitcode is, and a calm form on the right. On narrow screens the
   brand panel becomes a short strip above the form. Switching between the
   two modes keeps the email and the page the student was heading for. */

const EMAIL_KEY = "bitcode-auth-email";

type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string };

/** A simple, honest strength estimate: length first, then variety. Only
 * the length rule is enforced; the meter just nudges. */
function strength(pw: string): Strength {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length < 8) s = Math.min(s, 1);
  const score = Math.max(1, s) as Strength["score"];
  return { score, label: ["", "Too weak", "Okay", "Good", "Strong"][score] };
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 4.5L8 8.6l5.5-4.1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="2.75" y="7" width="10.5" height="7.25" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {!open && <path d="M2.5 13.5l11-11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}

function AuthInput({
  id,
  label,
  icon,
  error,
  trailing,
  below,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; icon: ReactNode; error?: string; trailing?: ReactNode; below?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
        {label}
      </label>
      <div className={`bc-auth-input${error ? " bc-auth-input-error" : ""}`}>
        <span className="bc-auth-icon">{icon}</span>
        <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} {...input} />
        {trailing}
      </div>
      {error ? (
        <span id={`${id}-error`} role="alert" style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 13, lineHeight: 1.4, color: "var(--fail-text)" }}>
          <span style={{ paddingTop: 1 }}>
            <StatusIcon kind="fail" size={13} />
          </span>
          {error}
        </span>
      ) : (
        below
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function AuthForm({ mode, action }: { mode: "login" | "register"; action: (email: string, password: string) => Promise<unknown> }) {
  const router = useRouter();
  const params = useSearchParams();
  const tabsId = useId();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/bitcode";
  const isLogin = mode === "login";
  const expired = params.get("reason") === "expired";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  // A form-level problem (offline, server) and per-field ones, separately:
  // a wrong password belongs under the password, not in a banner.
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Carry the email across a switch between Log in and Create account.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      /* storage blocked: start empty */
    }
  }, []);
  const remember = () => {
    try {
      sessionStorage.setItem(EMAIL_KEY, email);
    } catch {
      /* ignore */
    }
  };

  const st = strength(password);
  const longEnough = password.length >= 8;

  async function continueWithGoogle() {
    setGoogleLoading(true);
    setError(null);
    const { error: err } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` },
    });
    if (err) {
      setError({ title: "Google sign-in did not start", body: "Try again in a moment, or use your email." });
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErr({});
    if (!isLogin && !longEnough) {
      setFieldErr({ password: "Use at least 8 characters." });
      return;
    }
    setLoading(true);
    try {
      await action(email, password);
      try {
        sessionStorage.removeItem(EMAIL_KEY);
      } catch {
        /* ignore */
      }
      router.push(safeNext);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFieldErr({ password: "That email and password do not match. Check both and try again." });
      } else if (err instanceof ApiError && err.status === 409) {
        setFieldErr({ email: "There is already an account with this email. Switch to Log in above." });
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

  const tabHref = (m: "login" | "register") => `/${m}${next ? `?next=${encodeURIComponent(safeNext)}` : ""}`;

  return (
    <main className="bc-auth">
      {/* brand panel */}
      <aside className="bc-auth-brand">
        <ScopeField interactive intensity={0.9} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", gap: 32 }}>
          <Link href="/" aria-label="Bitcode home" style={{ alignSelf: "flex-start" }}>
            <Wordmark size={34} />
          </Link>
          <div className="bc-auth-pitch">
            <h2 className="display" style={{ fontSize: "clamp(40px, 4.6vw, 76px)", lineHeight: 0.88 }}>
              Write hardware.
              <br />
              <span style={{ color: "var(--ch1)" }}>Prove it.</span>
            </h2>
          </div>
          <svg viewBox="0 0 600 40" preserveAspectRatio="none" className="bc-auth-trace" aria-hidden style={{ width: "100%", height: 40 }}>
            <path d="M0 32H50V8H100V32H150V8H200V32H250V8H300V32H350V8H400V32H450V8H500V32H550V8H600" fill="none" stroke="var(--wave-clock)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pathLength={1} className="bc-trace-draw" />
          </svg>
        </div>
      </aside>

      {/* form */}
      <section className="bc-auth-form">
        <div style={{ width: "100%", maxWidth: 400 }}>
          <nav aria-label="Account" style={{ position: "relative", display: "flex", gap: 24, borderBottom: "1px solid var(--border)", marginBottom: 32 }}>
            {(["login", "register"] as const).map((m) => {
              const on = m === mode;
              return (
                <Link
                  key={m}
                  href={tabHref(m)}
                  onClick={remember}
                  aria-current={on ? "page" : undefined}
                  style={{ position: "relative", padding: "0 0 12px", fontSize: 14, fontWeight: 600, color: on ? "var(--fg)" : "var(--fg-muted)" }}
                >
                  {m === "login" ? "Log in" : "Create account"}
                  {on && <motion.span layoutId={`auth-tab-${tabsId}`} style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, background: "var(--ch3)" }} />}
                </Link>
              );
            })}
          </nav>

          <h1 className="display" style={{ fontSize: 44, lineHeight: 0.95 }}>
            {isLogin ? "Welcome back." : "Start building."}
          </h1>
          <p style={{ fontSize: 15, color: "var(--fg-muted)", margin: "12px 0 28px" }}>
            {isLogin ? "Log in to pick up your problems and streak." : "Free account. Your code and progress save as you go."}
          </p>

          {expired && isLogin && !error && (
            <div role="status" className="bc-auth-note" style={{ ["--tone" as string]: "var(--warn)" }}>
              <StatusIcon kind="warn" size={14} />
              <span>
                <strong>Your session ended.</strong> Log in and you will land back where you were. Drafts are still saved.
              </span>
            </div>
          )}

          {googleEnabled && (
            <>
              <button type="button" className="bc-google" onClick={continueWithGoogle} disabled={googleLoading}>
                <GoogleIcon />
                {googleLoading ? "Opening Google" : "Continue with Google"}
              </button>
              <div className="bc-or" aria-hidden>
                <span>or</span>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <AuthInput
              id="email"
              label="Email"
              icon={<MailIcon />}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErr.email) setFieldErr((f) => ({ ...f, email: undefined }));
              }}
              placeholder="you@college.edu"
              required
              autoComplete="email"
              autoFocus
              error={fieldErr.email}
            />
            <AuthInput
              id="password"
              label="Password"
              icon={<LockIcon />}
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErr.password) setFieldErr((f) => ({ ...f, password: undefined }));
              }}
              onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
              onKeyDown={(e) => setCaps(e.getModifierState("CapsLock"))}
              onBlur={() => setCaps(false)}
              placeholder={isLogin ? "Your password" : "8 or more characters"}
              required
              minLength={isLogin ? undefined : 8}
              autoComplete={isLogin ? "current-password" : "new-password"}
              error={fieldErr.password}
              trailing={
                <button type="button" className="bc-auth-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
                  <EyeIcon open={show} />
                </button>
              }
              below={
                <>
                  {caps && (
                    <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "var(--warn)" }}>
                      <StatusIcon kind="warn" size={13} /> Caps Lock is on
                    </span>
                  )}
                  {!isLogin && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }} aria-live="polite">
                      <span style={{ display: "flex", gap: 4, flex: 1 }} aria-hidden>
                        {[1, 2, 3, 4].map((n) => (
                          <span
                            key={n}
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              background: st.score >= n ? (st.score <= 1 ? "var(--fail)" : st.score === 2 ? "var(--warn)" : "var(--pass)") : "var(--border-strong)",
                              transition: "background 200ms",
                            }}
                          />
                        ))}
                      </span>
                      <span className="mono" style={{ fontSize: 11, minWidth: 64, textAlign: "right", color: "var(--fg-muted)" }}>
                        {st.label}
                      </span>
                    </div>
                  )}
                  {!isLogin && (
                    <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: longEnough ? "var(--pass)" : "var(--fg-faint)", transition: "color 200ms" }}>
                      <StatusIcon kind={longEnough ? "pass" : "pending"} size={13} />8 or more characters
                    </span>
                  )}
                </>
              }
            />

            {error && (
              <div role="alert" className="bc-auth-note" style={{ ["--tone" as string]: "var(--fail)" }}>
                <StatusIcon kind="fail" size={14} />
                <span>
                  <strong>{error.title}.</strong> {error.body}
                </span>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" loading={loading} loadingLabel={isLogin ? "Logging in" : "Creating account"} style={{ width: "100%", marginTop: 4 }} icon={<ArrowIcon />}>
              {isLogin ? "Log in" : "Create account"}
            </Button>
          </form>

          <p style={{ fontSize: 12.5, color: "var(--fg-faint)", marginTop: 24, lineHeight: 1.5 }}>
            {isLogin ? "New here? Switch to Create account above. It takes ten seconds." : "Your email is only used to sign you in."}
          </p>
        </div>
      </section>
    </main>
  );
}
