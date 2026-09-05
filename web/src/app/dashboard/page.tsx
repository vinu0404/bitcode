"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getMyStats } from "@/lib/api";
import { useAuthReady } from "@/lib/auth";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import CircuitTrace from "@/components/ui/CircuitTrace";
import { fadeUp } from "@/components/ui/motion";
import SolvedRing from "@/components/dashboard/SolvedRing";
import ActivityHeatmap from "@/components/dashboard/ActivityHeatmap";
import TopicBubbles from "@/components/dashboard/TopicBubbles";

const DIFFICULTY_TONE: Record<string, "pass" | "warn" | "fail"> = { easy: "pass", medium: "warn", hard: "fail" };

export default function DashboardPage() {
  const router = useRouter();
  const loggedIn = useAuthReady();

  useEffect(() => {
    if (loggedIn === false) router.push("/login");
  }, [loggedIn, router]);

  const { data: stats, isLoading } = useQuery({ queryKey: ["me-stats"], queryFn: getMyStats, enabled: !!loggedIn });

  if (loggedIn !== true || isLoading) return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;
  if (!stats) return null;

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <CircuitTrace />
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 600, marginBottom: 22, fontStyle: "italic" }}>Dashboard</h1>

      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Card glass style={{ padding: 26, marginBottom: 22 }}>
          <div style={{ display: "flex", gap: 36, flexWrap: "wrap", alignItems: "center" }}>
            <SolvedRing byDifficulty={stats.by_difficulty} totalSolved={stats.total_solved} totalProblems={stats.total_problems} />

            <div style={{ display: "flex", gap: 24 }}>
              {stats.by_difficulty.map((b) => (
                <div key={b.difficulty} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Badge tone={DIFFICULTY_TONE[b.difficulty] ?? "neutral"}>{b.difficulty}</Badge>
                  <span className="mono" style={{ fontSize: 13, color: "var(--text-dim)" }}>
                    {b.solved} / {b.total}
                  </span>
                </div>
              ))}
              {stats.current_streak > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Streak
                  </span>
                  <span className="mono" style={{ fontSize: 13, color: "var(--warn)" }}>
                    {stats.current_streak} day{stats.current_streak === 1 ? "" : "s"} 🔥
                  </span>
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 300 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 10 }}>
                Activity
              </div>
              <ActivityHeatmap days={stats.heatmap} />
            </div>
          </div>
        </Card>
      </motion.div>

      {stats.by_topic.length > 0 && (
        <Card style={{ padding: 22 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 12 }}>
            By topic — click one to browse its problems
          </div>
          <TopicBubbles topics={stats.by_topic} active={null} onToggle={(slug) => slug && router.push(`/problems?topic=${slug}`)} />
        </Card>
      )}
    </div>
  );
}
