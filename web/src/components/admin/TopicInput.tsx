"use client";

import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/Field";

// Type a name, press Enter or comma to commit it as a chip — the server
// finds-or-creates the Topic row by name, so there's no separate "manage
// topics" screen an admin has to visit first to add problem #6 in a new area.
export default function TopicInput({ topics, onChange }: { topics: string[]; onChange: (topics: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function commit() {
    const name = draft.trim();
    if (name && !topics.includes(name)) onChange([...topics, name]);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && topics.length > 0) {
      onChange(topics.slice(0, -1));
    }
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: topics.length ? 8 : 0 }}>
        {topics.map((t) => (
          <span
            key={t}
            className="mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "4px 6px 4px 10px",
              borderRadius: 999,
              background: "var(--accent-soft)",
              color: "var(--accent-strong)",
              border: "1px solid var(--accent-border)",
            }}
          >
            {t}
            <button
              onClick={() => onChange(topics.filter((x) => x !== t))}
              aria-label={`Remove topic ${t}`}
              style={{ background: "none", border: "none", color: "inherit", fontSize: 12, padding: 2, lineHeight: 1 }}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <Input
        placeholder="Type a topic and press Enter — e.g. Arithmetic"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
    </div>
  );
}
