"use client";

import { motion } from "framer-motion";
import type { DifficultyBucket } from "@/lib/api";

const COLOR: Record<string, string> = { easy: "var(--pass)", medium: "var(--warn)", hard: "var(--fail)" };
const SIZE = 148;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

// The LeetCode-familiar ring (Jakob's Law — anyone who has used a coding
// practice site already knows how to read this at a glance): one ring,
// swept proportionally to total problems, one arc segment per difficulty
// solved, an unfilled track for what's left.
export default function SolvedRing({ byDifficulty, totalSolved, totalProblems }: { byDifficulty: DifficultyBucket[]; totalSolved: number; totalProblems: number }) {
  let offset = 0;
  const segments = byDifficulty.map((b) => {
    const len = totalProblems > 0 ? (b.solved / totalProblems) * CIRC : 0;
    const seg = { key: b.difficulty, len, offset, color: COLOR[b.difficulty] ?? "var(--text-faint)" };
    offset += len;
    return seg;
  });

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE, flex: "none" }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--surface-2)" strokeWidth={STROKE} />
        {segments.map((s, i) => (
          <motion.circle
            key={s.key}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            strokeDasharray={`${s.len} ${CIRC - s.len}`}
            initial={{ strokeDashoffset: 0, opacity: 0 }}
            animate={{ strokeDashoffset: -s.offset, opacity: 1 }}
            transition={{ duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
          {totalSolved}
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>
          / {totalProblems} solved
        </div>
      </div>
    </div>
  );
}
