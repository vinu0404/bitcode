"use client";

import { motion } from "framer-motion";

// Serial Position + Zeigarnik: the full sequence stays visible (first/last
// steps are never lost off-screen), and a visibly unfinished trail behind
// the active dot creates real pull to complete the wizard — the effect
// works because progress is genuinely rendered, not just implied by text.
export default function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i === steps.length - 1 ? "none" : 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "none" }}>
              <motion.div
                animate={{
                  background: state === "pending" ? "var(--surface-2)" : "var(--accent)",
                  scale: state === "active" ? 1.15 : 1,
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: state === "pending" ? "1px solid var(--border)" : "1px solid var(--accent-border)",
                  color: state === "pending" ? "var(--text-faint)" : "var(--accent-ink)",
                  fontSize: 12,
                  fontWeight: 700,
                  boxShadow: state === "active" ? "var(--shadow-glow)" : "none",
                  flex: "none",
                }}
              >
                {state === "done" ? "✓" : i + 1}
              </motion.div>
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: state === "pending" ? "var(--text-faint)" : "var(--text-dim)",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: "0 8px 18px", background: "var(--border)", borderRadius: 1, overflow: "hidden" }}>
                <motion.div
                  animate={{ width: state === "pending" ? "0%" : "100%" }}
                  transition={{ duration: 0.3 }}
                  style={{ height: "100%", background: "var(--accent)" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
