"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const base: React.CSSProperties = { padding: "10px 12px", fontSize: 14, width: "100%" };

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`ui-input ${props.className ?? ""}`} style={{ ...base, ...props.style }} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`ui-input ${props.className ?? ""}`} style={{ ...base, fontFamily: "inherit", resize: "vertical", ...props.style }} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`ui-input ${props.className ?? ""}`} style={{ ...base, ...props.style }} />;
}

// A real <label>, programmatically tied via htmlFor/id — fixes the
// placeholder-only-label anti-pattern (Forms & Feedback, priority 8): a
// placeholder disappears the moment someone types, and never reaches a
// screen reader as the field's name the way a <label> does.
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={htmlFor}
        className="mono"
        style={{ fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-dim)" }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
