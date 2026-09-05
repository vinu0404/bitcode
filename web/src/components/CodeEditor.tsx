"use client";

import Editor, { BeforeMount } from "@monaco-editor/react";
import { VERILOG_LANGUAGE_ID, verilogLanguageConfig, verilogMonarchTokens } from "@/lib/verilog-monarch";
import { useTheme } from "@/lib/theme";

interface Props {
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

const DARK_THEME_ID = "bitcode-dark";
const LIGHT_THEME_ID = "bitcode-light";

// Registering themes in onMount is too late — @monaco-editor/react applies
// the `theme` prop while creating the editor, before onMount ever fires,
// so an unregistered theme silently falls back to Monaco's default light
// "vs". beforeMount runs first, so both themes exist by the time either
// is needed — and both are `inherit: false` (fully self-contained): the
// Monarch grammar emits a distinct token per keyword ("keyword.module.sv",
// not a shared "keyword.sv" — confirmed via monaco.editor.tokenize at
// runtime), and inheriting vs-dark/vs pulls in built-in rules for some of
// those exact scope names that win over ours regardless of rule order.
const handleBeforeMount: BeforeMount = (monaco) => {
  const languages = monaco.languages.getLanguages();
  if (!languages.some((l) => l.id === VERILOG_LANGUAGE_ID)) {
    monaco.languages.register({ id: VERILOG_LANGUAGE_ID });
    monaco.languages.setLanguageConfiguration(VERILOG_LANGUAGE_ID, verilogLanguageConfig);
    monaco.languages.setMonarchTokensProvider(VERILOG_LANGUAGE_ID, verilogMonarchTokens as any);
  }

  monaco.editor.defineTheme(DARK_THEME_ID, {
    base: "vs-dark",
    inherit: false,
    rules: [
      { token: "", foreground: "ebeef3", background: "12161d" },
      { token: "keyword", foreground: "6ba0ff", fontStyle: "bold" },
      { token: "predefined", foreground: "22d3ee" },
      { token: "comment", foreground: "5b6472", fontStyle: "italic" },
      { token: "string", foreground: "34d399" },
      { token: "number", foreground: "fbbf24" },
      { token: "number.hex", foreground: "fbbf24" },
      { token: "identifier", foreground: "ebeef3" },
      { token: "delimiter", foreground: "8d96a6" },
      { token: "operator", foreground: "8d96a6" },
    ],
    colors: {
      "editor.background": "#12161d",
      "editor.foreground": "#ebeef3",
      "editor.lineHighlightBackground": "#181d2680",
      "editor.selectionBackground": "#4c8eff40",
      "editorCursor.foreground": "#6ba0ff",
      "editorLineNumber.foreground": "#5b6472",
      "editorLineNumber.activeForeground": "#8d96a6",
      "editorIndentGuide.background": "#232a36",
      "editorIndentGuide.activeBackground": "#333c4d",
      "editorGutter.background": "#12161d",
      "scrollbarSlider.background": "#232a36a0",
      "scrollbarSlider.hoverBackground": "#333c4dc0",
    },
  });

  monaco.editor.defineTheme(LIGHT_THEME_ID, {
    base: "vs",
    inherit: false,
    rules: [
      { token: "", foreground: "151a23", background: "ffffff" },
      { token: "keyword", foreground: "0f4fc9", fontStyle: "bold" },
      { token: "predefined", foreground: "0891b2" },
      { token: "comment", foreground: "8891a1", fontStyle: "italic" },
      { token: "string", foreground: "059669" },
      { token: "number", foreground: "b45309" },
      { token: "number.hex", foreground: "b45309" },
      { token: "identifier", foreground: "151a23" },
      { token: "delimiter", foreground: "5c6576" },
      { token: "operator", foreground: "5c6576" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#151a23",
      "editor.lineHighlightBackground": "#eef1f680",
      "editor.selectionBackground": "#1d5fe030",
      "editorCursor.foreground": "#0f4fc9",
      "editorLineNumber.foreground": "#8891a1",
      "editorLineNumber.activeForeground": "#5c6576",
      "editorIndentGuide.background": "#dde2ea",
      "editorIndentGuide.activeBackground": "#c3cad6",
      "editorGutter.background": "#ffffff",
      "scrollbarSlider.background": "#dde2eaa0",
      "scrollbarSlider.hoverBackground": "#c3cad6c0",
    },
  });
};

export default function CodeEditor({ value, onChange, height = "420px" }: Props) {
  const theme = useTheme();

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <Editor
        height={height}
        language={VERILOG_LANGUAGE_ID}
        theme={theme === "dark" ? DARK_THEME_ID : LIGHT_THEME_ID}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        beforeMount={handleBeforeMount}
        options={{
          fontSize: 13,
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 4,
          automaticLayout: true,
          padding: { top: 14 },
          cursorBlinking: "smooth",
          // Off by default in Monaco, and the actual cause of a
          // white/gold-text bug this replaces: it colors matching
          // brackets from Monaco's own fixed palette, a layer completely
          // separate from — and rendered on top of — the language theme's
          // token `rules`. See the CSS override in globals.css too.
          bracketPairColorization: { enabled: false },
        }}
      />
    </div>
  );
}
