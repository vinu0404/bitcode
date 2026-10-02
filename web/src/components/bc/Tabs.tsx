"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { pad2 } from "@/lib/domains";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
  shortcut?: string; // shown as a hint in the title attribute
}

/** Text tabs with a 2px action-colour underline that slides between them on
 * a spring. Counts sit beside the label in mono. */
export default function Tabs<T extends string>({
  items,
  active,
  onChange,
  height = 40,
  trailing,
}: {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  height?: number;
  trailing?: React.ReactNode;
}) {
  const group = useId();
  return (
    <div
      role="tablist"
      style={{ display: "flex", alignItems: "stretch", gap: 20, height, padding: "0 16px", borderBottom: "1px solid var(--border)", flex: "none" }}
    >
      {items.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            title={t.shortcut ? `${t.label} (${t.shortcut})` : undefined}
            onClick={() => onChange(t.id)}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: 0,
              border: 0,
              background: "transparent",
              fontSize: 13,
              fontWeight: 600,
              color: on ? "var(--fg)" : "var(--fg-muted)",
              transition: "color 150ms",
            }}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="mono tnum" style={{ fontSize: 11, color: on ? "var(--fg-muted)" : "var(--fg-faint)" }}>
                {pad2(t.count)}
              </span>
            )}
            {on && (
              <motion.span
                layoutId={`tab-underline-${group}`}
                transition={{ type: "spring", stiffness: 520, damping: 34, duration: 0.3 }}
                style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, background: "var(--ch3)" }}
              />
            )}
          </button>
        );
      })}
      {trailing && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>{trailing}</div>}
    </div>
  );
}
