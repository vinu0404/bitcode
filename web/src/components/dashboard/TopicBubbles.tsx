"use client";

import { motion } from "framer-motion";
import type { TopicBucket } from "@/lib/api";

// Law of Similarity: every bubble shares one visual form, so the set
// reads as one interchangeable group of filters rather than a list of
// distinct controls — exactly what a topic filter should communicate.
export default function TopicBubbles({
  topics,
  active,
  onToggle,
}: {
  topics: TopicBucket[];
  active: string | null;
  onToggle: (slug: string | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {topics.map((tb) => {
        const isActive = active === tb.topic.slug;
        const complete = tb.total > 0 && tb.solved === tb.total;
        return (
          <motion.button
            key={tb.topic.id}
            onClick={() => onToggle(isActive ? null : tb.topic.slug)}
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -1 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 13px",
              borderRadius: 999,
              fontSize: 12.5,
              fontWeight: 500,
              border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
              background: isActive ? "var(--accent-soft)" : "var(--surface)",
              color: isActive ? "var(--accent-strong)" : "var(--text)",
              boxShadow: isActive ? "0 0 0 1px var(--accent-border)" : "none",
            }}
          >
            {complete && (
              <span aria-hidden="true" style={{ color: "var(--pass)", fontSize: 11 }}>
                ✓
              </span>
            )}
            {tb.topic.name}
            <span className="mono" style={{ fontSize: 11, color: isActive ? "var(--accent-strong)" : "var(--text-faint)" }}>
              {tb.solved}/{tb.total}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
