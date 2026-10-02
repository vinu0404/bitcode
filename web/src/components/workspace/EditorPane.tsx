"use client";

import { useState } from "react";
import CodeEditor, { type MonacoEditor } from "@/components/CodeEditor";
import { TraceLoader } from "@/components/bc/States";

export type SaveState = "saved" | "unsaved";

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 28,
        height: 28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: 0,
        borderRadius: "var(--r-inline)",
        background: "transparent",
        color: "var(--fg-muted)",
      }}
    >
      {children}
    </button>
  );
}

export default function EditorPane({
  fileName,
  code,
  onChange,
  saveState,
  onFormat,
  onReset,
  onEditor,
  formatShortcut,
}: {
  fileName: string;
  code: string;
  onChange: (v: string) => void;
  saveState: SaveState;
  onFormat: () => void;
  onReset: () => void;
  onEditor: (e: MonacoEditor) => void;
  formatShortcut: string;
}) {
  const [pos, setPos] = useState({ line: 1, col: 1 });
  const [ready, setReady] = useState(false);
  const footer: React.CSSProperties = { fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--fg-faint)" };

  return (
    <div className="no-grain" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "var(--bg-sunken)" }}>
      <div style={{ height: 36, flex: "none", display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
        <div
          className="mono"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 14px",
            fontSize: 12,
            background: "var(--bg-sunken)",
            borderRight: "1px solid var(--border)",
            marginBottom: -1,
          }}
        >
          {fileName}
          <span
            aria-label={saveState === "saved" ? "Saved" : "Unsaved changes"}
            style={{ width: 6, height: 6, borderRadius: 999, background: saveState === "saved" ? "transparent" : "var(--fg-muted)", transition: "background 200ms" }}
          />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2, padding: "0 6px" }}>
          <IconButton label={`Format (${formatShortcut})`} onClick={onFormat}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M2 3h10M4 7h8M4 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </IconButton>
          <IconButton label="Reset to starter code" onClick={onReset}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M2.5 7a4.5 4.5 0 1 0 1.4-3.3M2.5 2v2.5H5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </IconButton>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {!ready && (
          <div style={{ position: "absolute", inset: 0 }}>
            <TraceLoader label="Loading editor" minHeight={0} />
          </div>
        )}
        <CodeEditor
          value={code}
          onChange={onChange}
          height="100%"
          framed={false}
          onMount={(editor) => {
            setReady(true);
            onEditor(editor);
            editor.onDidChangeCursorPosition((e: { position: { lineNumber: number; column: number } }) => setPos({ line: e.position.lineNumber, col: e.position.column }));
          }}
        />
      </div>

      <div
        style={{
          height: 28,
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "0 14px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg)",
        }}
      >
        <span className="tnum" style={footer}>
          Ln {pos.line}, Col {pos.col}
        </span>
        <span style={footer}>UTF-8</span>
        <span style={footer}>Spaces: 2</span>
        <span style={{ ...footer, marginLeft: "auto", color: saveState === "saved" ? "var(--fg-faint)" : "var(--fg-muted)" }}>
          {saveState === "saved" ? "Saved" : "Unsaved"}
        </span>
      </div>
    </div>
  );
}
