"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register, ApiError } from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { fadeUp } from "@/components/ui/motion";

export default function RegisterPage() {
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
      await register(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" style={{ maxWidth: 380, margin: "64px auto" }}>
      <Card style={{ padding: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Create an account</h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="password" hint="Minimum 8 characters">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          {error && (
            <div style={{ color: "var(--fail)", fontSize: 13, background: "var(--fail-soft)", padding: "8px 12px", borderRadius: "var(--radius-sm)" }}>
              {error}
            </div>
          )}
          <Button type="submit" variant="primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 18, textAlign: "center" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--accent-strong)" }}>
            Log in
          </Link>
        </p>
      </Card>
    </motion.div>
  );
}
