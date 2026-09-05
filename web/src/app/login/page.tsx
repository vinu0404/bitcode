"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, ApiError } from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { fadeUp } from "@/components/ui/motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" style={{ maxWidth: 380, margin: "64px auto" }}>
      <Card style={{ padding: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Log in</h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          {error && (
            <div style={{ color: "var(--fail)", fontSize: 13, background: "var(--fail-soft)", padding: "8px 12px", borderRadius: "var(--radius-sm)" }}>
              {error}
            </div>
          )}
          <Button type="submit" variant="primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 18, textAlign: "center" }}>
          No account?{" "}
          <Link href="/register" style={{ color: "var(--accent-strong)" }}>
            Register
          </Link>
        </p>
      </Card>
    </motion.div>
  );
}
