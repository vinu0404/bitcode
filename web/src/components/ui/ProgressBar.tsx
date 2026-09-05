"use client";

import { motion } from "framer-motion";

// Law of Prägnanz: a filled bar reads instantly as "how much" — simpler
// for the eye to parse than the same fact as bare digits alone, so every
// numeric score/breakdown pairs a bar with its number, never just the number.
export default function ProgressBar({
  value,
  max = 100,
  tone = "accent",
  height = 6,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "pass" | "fail" | "warn" | "signal";
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = `var(--${tone === "accent" ? "accent" : tone})`;
  return (
    <div style={{ height, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: "100%", borderRadius: 999, background: color }}
      />
    </div>
  );
}
