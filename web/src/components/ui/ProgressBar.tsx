"use client";

import { motion } from "framer-motion";

/** A filled hairline bar: reads as "how much" faster than bare digits, so it
 * always sits beside its number, never instead of it. */
export default function ProgressBar({
  value,
  max = 100,
  tone = "action",
  height = 4,
}: {
  value: number;
  max?: number;
  tone?: "action" | "pass" | "fail" | "warn";
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = tone === "action" ? "var(--action)" : `var(--${tone})`;
  return (
    <div style={{ height, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: "100%", borderRadius: 999, background: color }}
      />
    </div>
  );
}
