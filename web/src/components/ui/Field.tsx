"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const base: React.CSSProperties = { width: "100%" };

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`ui-input ${props.className ?? ""}`} style={{ ...base, ...props.style }} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`ui-input ${props.className ?? ""}`} style={{ ...base, resize: "vertical", ...props.style }} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`ui-input ${props.className ?? ""}`} style={{ ...base, ...props.style }} />;
}

/** A real <label> tied to its control by htmlFor, so the field keeps its
 * name after the placeholder disappears and screen readers announce it. */
export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={htmlFor}
        className="mono"
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-muted)" }}
      >
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${htmlFor}-error`} role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12.5, lineHeight: 1.4, color: "var(--fail-text)" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ flex: "none", marginTop: 2 }}>
            <circle cx="6" cy="6" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M6 3.4v3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="6" cy="8.6" r="0.8" fill="currentColor" />
          </svg>
          {error}
        </span>
      ) : (
        hint && <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>{hint}</span>
      )}
    </div>
  );
}
