"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { VERILOG_LANGUAGE_ID, verilogLanguageConfig, verilogMonarchTokens } from "@/lib/verilog-monarch";
import { useTheme } from "@/lib/theme";

export type MonacoEditor = Parameters<OnMount>[0];
export type Monaco = Parameters<OnMount>[1];

interface Props {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  onMount?: OnMount;
  readOnly?: boolean;
  /** Draw the bordered frame used outside the workspace (admin). */
  framed?: boolean;
}

const INK_THEME = "bitcode-ink";
const PAPER_THEME = "bitcode-paper";

// Themes are registered in beforeMount: @monaco-editor/react applies the
// `theme` prop while creating the editor, before onMount fires, so a theme
// registered later silently falls back to Monaco's "vs". Both themes are
// `inherit: false`, so no built-in rule can outrank ours.
const handleBeforeMount: BeforeMount = (monaco) => {
  if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === VERILOG_LANGUAGE_ID)) {
    monaco.languages.register({ id: VERILOG_LANGUAGE_ID });
    monaco.languages.setLanguageConfiguration(VERILOG_LANGUAGE_ID, verilogLanguageConfig);
    monaco.languages.setMonarchTokensProvider(VERILOG_LANGUAGE_ID, verilogMonarchTokens as never);
  }

  monaco.editor.defineTheme(INK_THEME, {
    base: "vs-dark",
    inherit: false,
    rules: [
      { token: "", foreground: "F2EFE8", background: "080A14" },
      { token: "keyword", foreground: "D690FF" },
      { token: "keyword.direction", foreground: "7AA5FF", fontStyle: "bold" },
      { token: "type", foreground: "7AA5FF" },
      { token: "number", foreground: "FFB347" },
      { token: "string", foreground: "2EE0C6" },
      { token: "predefined", foreground: "FF7A5C" },
      { token: "macro", foreground: "C04BFF" },
      { token: "operator", foreground: "A3A9C2" },
      { token: "delimiter", foreground: "A3A9C2" },
      { token: "comment", foreground: "6B7192", fontStyle: "italic" },
      { token: "identifier", foreground: "F2EFE8" },
    ],
    colors: {
      "editor.background": "#080A14",
      "editor.foreground": "#F2EFE8",
      "editor.lineHighlightBackground": "#FFFFFF0A",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#3D7BFF47",
      "editor.inactiveSelectionBackground": "#3D7BFF24",
      "editorCursor.foreground": "#F2EFE8",
      "editorLineNumber.foreground": "#5A6080",
      "editorLineNumber.activeForeground": "#9AA0B8",
      "editorIndentGuide.background1": "#BEC8FF1A",
      "editorIndentGuide.activeBackground1": "#BEC8FF38",
      "editorBracketMatch.background": "#00000000",
      "editorBracketMatch.border": "#9AA0B8",
      "editorGutter.background": "#080A14",
      "editorWidget.background": "#161B33",
      "editorWidget.border": "#BEC8FF38",
      "scrollbarSlider.background": "#BEC8FF22",
      "scrollbarSlider.hoverBackground": "#BEC8FF38",
      "editorError.foreground": "#FF5A5F",
    },
  });

  monaco.editor.defineTheme(PAPER_THEME, {
    base: "vs",
    inherit: false,
    rules: [
      { token: "", foreground: "12142A", background: "FBF9F4" },
      { token: "keyword", foreground: "8F2CCC" },
      { token: "keyword.direction", foreground: "2156DC", fontStyle: "bold" },
      { token: "type", foreground: "2156DC" },
      { token: "number", foreground: "A86400" },
      { token: "string", foreground: "00806F" },
      { token: "predefined", foreground: "C93D1C" },
      { token: "macro", foreground: "8F2CCC" },
      { token: "operator", foreground: "5D6178" },
      { token: "delimiter", foreground: "5D6178" },
      { token: "comment", foreground: "8A8DA0", fontStyle: "italic" },
      { token: "identifier", foreground: "12142A" },
    ],
    colors: {
      "editor.background": "#FBF9F4",
      "editor.foreground": "#12142A",
      "editor.lineHighlightBackground": "#12142A08",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#3D7BFF47",
      "editor.inactiveSelectionBackground": "#3D7BFF24",
      "editorCursor.foreground": "#12142A",
      "editorLineNumber.foreground": "#9A9DB0",
      "editorLineNumber.activeForeground": "#5D6178",
      "editorIndentGuide.background1": "#12142A1A",
      "editorIndentGuide.activeBackground1": "#12142A38",
      "editorBracketMatch.background": "#00000000",
      "editorBracketMatch.border": "#5D6178",
      "editorGutter.background": "#FBF9F4",
      "editorWidget.background": "#FFFDF8",
      "editorWidget.border": "#12142A38",
      "scrollbarSlider.background": "#12142A22",
      "scrollbarSlider.hoverBackground": "#12142A38",
      "editorError.foreground": "#C2333A",
    },
  });
};

export default function CodeEditor({ value, onChange, height = "420px", onMount, readOnly = false, framed = true }: Props) {
  const theme = useTheme();
  const editor = (
    <Editor
      height={height}
      language={VERILOG_LANGUAGE_ID}
      theme={theme === "paper" ? PAPER_THEME : INK_THEME}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      beforeMount={handleBeforeMount}
      onMount={onMount}
      loading={null}
      options={{
        readOnly,
        fontSize: 13.5,
        lineHeight: 21,
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        fontLigatures: false,
        minimap: { enabled: false },
        wordWrap: "off",
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
        detectIndentation: false,
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        lineNumbersMinChars: 4,
        lineDecorationsWidth: 12,
        glyphMargin: false,
        folding: false,
        renderLineHighlight: "line",
        cursorStyle: "line",
        cursorWidth: 2,
        cursorBlinking: "solid",
        cursorSmoothCaretAnimation: "off",
        smoothScrolling: false,
        matchBrackets: "always",
        guides: { indentation: true, bracketPairs: false },
        // Off: Monaco's own bracket palette paints over the theme's token
        // colours. See the CSS override in globals.css as well.
        bracketPairColorization: { enabled: false },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
        renderWhitespace: "none",
        fixedOverflowWidgets: true,
      }}
    />
  );
  if (!framed) return editor;
  return <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>{editor}</div>;
}
