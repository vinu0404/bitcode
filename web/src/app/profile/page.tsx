"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getMe, getMyStats, logout } from "@/lib/api";
import { useAuthReady } from "@/lib/auth";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import CircuitTrace from "@/components/ui/CircuitTrace";
import { fadeUp } from "@/components/ui/motion";

const DIFFICULTY_TONE: Record<string, "pass" | "warn" | "fail"> = { easy: "pass", medium: "warn", hard: "fail" };

function initials(email: string): string {
  const name = email.split("@")[0];
  return name.slice(0, 2).toUpperCase();
}

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function ProfilePage() {
  const router = useRouter();
  const loggedIn = useAuthReady();

  useEffect(() => {
    if (loggedIn === false) router.push("/login");
  }, [loggedIn, router]);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe, enabled: !!loggedIn });
  const { data: stats } = useQuery({ queryKey: ["me-stats"], queryFn: getMyStats, enabled: !!loggedIn });

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  if (loggedIn !== true || !me) return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 8 }}>
        <CircuitTrace width={180} />
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 600, marginBottom: 22, fontStyle: "italic" }}>Profile</h1>

      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Card glass style={{ padding: 26, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 20 }}>
            <div
              aria-hidden="true"
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--f-display)",
                fontWeight: 600,
                fontSize: 20,
                flex: "none",
                background: "var(--accent-soft)",
                color: "var(--accent-strong)",
                border: "1px solid var(--accent-border)",
              }}
            >
              {initials(me.email)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>{me.email}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge tone={me.role === "admin" ? "accent" : "neutral"} dot={false}>
                  {me.role}
                </Badge>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  Member since {memberSince(me.created_at)}
                </span>
              </div>
            </div>
          </div>

          {stats && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Overall progress
                </span>
                <span className="mono" style={{ fontSize: 13, color: "var(--text-dim)" }}>
                  {stats.total_solved} / {stats.total_problems} solved
                </span>
              </div>
              <ProgressBar value={stats.total_solved} max={Math.max(stats.total_problems, 1)} tone="pass" height={7} />

              {stats.current_streak > 0 && (
                <p style={{ marginTop: 12, fontSize: 13.5, color: "var(--text-dim)" }}>
                  On a <span style={{ color: "var(--warn)", fontWeight: 600 }}>{stats.current_streak}-day streak</span> 🔥
                </p>
              )}
            </>
          )}
        </Card>
      </motion.div>

      {stats && stats.by_difficulty.length > 0 && (
        <Card style={{ padding: 22, marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 14 }}>
            By difficulty
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stats.by_difficulty.map((b) => (
              <div key={b.difficulty}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <Badge tone={DIFFICULTY_TONE[b.difficulty] ?? "neutral"}>{b.difficulty}</Badge>
                  <span className="mono" style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                    {b.solved} / {b.total}
                  </span>
                </div>
                <ProgressBar value={b.solved} max={Math.max(b.total, 1)} tone={DIFFICULTY_TONE[b.difficulty] === "fail" ? "fail" : DIFFICULTY_TONE[b.difficulty] === "warn" ? "warn" : "pass"} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button variant="danger" onClick={handleLogout}>
        Log out
      </Button>
    </div>
  );
}
