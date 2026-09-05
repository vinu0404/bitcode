"use client";

import { motion } from "framer-motion";
import type { HeatmapDay } from "@/lib/api";

const CELL = 12;
const GAP = 3;
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function level(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  const r = count / max;
  if (r > 0.75) return 4;
  if (r > 0.5) return 3;
  if (r > 0.25) return 2;
  return 1;
}

const LEVEL_BG = [
  "var(--surface-2)",
  "color-mix(in srgb, var(--pass) 28%, var(--surface-2))",
  "color-mix(in srgb, var(--pass) 52%, var(--surface-2))",
  "color-mix(in srgb, var(--pass) 76%, var(--surface-2))",
  "var(--pass)",
];

// GitHub/LeetCode-style activity calendar. Weeks run left-to-right as
// columns (Sun-Sat top-to-bottom per column) so recent activity always
// reads at the right edge — the same spatial convention every visitor
// already has muscle memory for (Jakob's Law).
export default function ActivityHeatmap({ days }: { days: HeatmapDay[] }) {
  if (days.length === 0) return null;

  const first = new Date(days[0].date + "T00:00:00");
  const leadingPad = first.getDay(); // 0 = Sunday
  const cells: (HeatmapDay | null)[] = [...Array(leadingPad).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const max = Math.max(1, ...days.map((d) => d.count));

  // Which weeks start a new month, for the label row above the grid.
  const monthLabels: { weekIndex: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstReal = week.find((c) => c !== null);
    if (!firstReal) return;
    const m = new Date(firstReal.date + "T00:00:00").getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ weekIndex: wi, label: MONTH_ABBR[m] });
      lastMonth = m;
    }
  });

  const gridWidth = weeks.length * (CELL + GAP);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ width: gridWidth, position: "relative", height: 14, marginBottom: 4 }}>
        {monthLabels.map((m) => (
          <span
            key={m.weekIndex}
            className="mono"
            style={{ position: "absolute", left: m.weekIndex * (CELL + GAP), fontSize: 10, color: "var(--text-faint)" }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: GAP, width: gridWidth }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
            {week.map((day, di) =>
              day ? (
                <motion.div
                  key={di}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: (wi * 7 + di) * 0.0015 }}
                  title={`${day.date} — ${day.count} submission${day.count === 1 ? "" : "s"}`}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 3,
                    background: LEVEL_BG[level(day.count, max)],
                    border: "1px solid var(--border)",
                  }}
                />
              ) : (
                <div key={di} style={{ width: CELL, height: CELL }} />
              )
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 10.5, color: "var(--text-faint)" }}>
        <span>Less</span>
        {LEVEL_BG.map((bg, i) => (
          <span key={i} style={{ width: CELL - 2, height: CELL - 2, borderRadius: 3, background: bg, border: "1px solid var(--border)" }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
