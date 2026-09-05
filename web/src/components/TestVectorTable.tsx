"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { Port, RunResponse } from "@/lib/api";
import WaveformViewer from "./WaveformViewer";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

interface Props {
  ports: Port[];
  kind: string;
  onRun: (vectors: Record<string, string>[]) => void;
  running: boolean;
  result: RunResponse | null;
}

export default function TestVectorTable({ ports, kind, onRun, running, result }: Props) {
  const inputPorts = ports.filter((p) => p.dir === "input" && !(kind === "sequential" && p.name === "clk"));
  const outputPorts = ports.filter((p) => p.dir === "output");
  const [rows, setRows] = useState<Record<string, string>[]>([Object.fromEntries(inputPorts.map((p) => [p.name, "0"]))]);
  const [showLog, setShowLog] = useState(false);
  const [showWave, setShowWave] = useState(true);

  function updateCell(rowIdx: number, name: string, value: string) {
    setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [name]: value } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, Object.fromEntries(inputPorts.map((p) => [p.name, "0"]))]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <Card style={{ padding: 18 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 12 }}>
        {kind === "sequential" ? "Custom test — one row per clock cycle" : "Custom test vectors"}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="mono" style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
          <thead>
            <tr>
              {kind === "sequential" && <th style={thStyle}>cycle</th>}
              {inputPorts.map((p) => (
                <th key={p.name} style={thStyle}>
                  {p.name}
                </th>
              ))}
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {rows.map((row, idx) => (
                <motion.tr
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {kind === "sequential" && <td style={tdStyle}>{idx}</td>}
                  {inputPorts.map((p) => (
                    <td key={p.name} style={tdStyle}>
                      <Input
                        aria-label={`${p.name}, row ${idx + 1}`}
                        value={row[p.name] ?? ""}
                        onChange={(e) => updateCell(idx, p.name, e.target.value)}
                        style={{ width: 76, padding: "5px 8px", fontSize: 13 }}
                      />
                    </td>
                  ))}
                  <td style={tdStyle}>
                    <button
                      onClick={() => removeRow(idx)}
                      aria-label={`Remove row ${idx + 1}`}
                      style={{ color: "var(--fail)", fontSize: 13, background: "none", border: "none", padding: 6 }}
                    >
                      ✕
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Button variant="secondary" size="sm" onClick={addRow}>
          + add {kind === "sequential" ? "cycle" : "vector"}
        </Button>
        <Button variant="primary" size="sm" onClick={() => onRun(rows)} disabled={running}>
          {running ? "Running…" : "Run"}
        </Button>
      </div>

      {result && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          {!result.compile.ok ? (
            <pre className="mono" style={{ fontSize: 12, color: "var(--fail)", background: "var(--fail-soft)", padding: 12, borderRadius: "var(--radius-sm)", whiteSpace: "pre-wrap", margin: 0 }}>
              {result.compile.errors}
            </pre>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="mono" style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%" }}>
                <thead>
                  <tr>
                    {inputPorts.map((p) => (
                      <th key={p.name} style={thStyle}>
                        {p.name}
                      </th>
                    ))}
                    {outputPorts.map((p) => (
                      <th key={`y-${p.name}`} style={thStyle}>
                        your {p.name}
                      </th>
                    ))}
                    {outputPorts.map((p) => (
                      <th key={`e-${p.name}`} style={thStyle}>
                        expected {p.name}
                      </th>
                    ))}
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {result.comparisons.map((c, i) => (
                    <tr key={i}>
                      {inputPorts.map((p) => (
                        <td key={p.name} style={tdStyle}>
                          0x{c.inputs[p.name]}
                        </td>
                      ))}
                      {outputPorts.map((p) => (
                        <td key={`y-${p.name}`} style={{ ...tdStyle, color: c.match ? "var(--text)" : "var(--fail)", fontWeight: c.match ? 400 : 600 }}>
                          0x{c.your_output[p.name]}
                        </td>
                      ))}
                      {outputPorts.map((p) => (
                        <td key={`e-${p.name}`} style={tdStyle}>
                          0x{c.expected_output[p.name]}
                        </td>
                      ))}
                      <td style={{ ...tdStyle, color: c.match ? "var(--pass)" : "var(--fail)", fontWeight: 600 }}>{c.match ? "MATCH" : "DIFF"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.compile.ok && result.waveform && (
            <div style={{ marginTop: 16 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowWave((v) => !v)} style={{ marginBottom: 10, paddingLeft: 0 }}>
                {showWave ? "Hide" : "Show"} waveform
              </Button>
              {showWave && <WaveformViewer waveform={result.waveform} />}
            </div>
          )}

          {result.compile.ok && result.raw_log && (
            <div style={{ marginTop: 12 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowLog((v) => !v)} style={{ paddingLeft: 0 }}>
                {showLog ? "Hide" : "Show"} raw simulator log
              </Button>
              <AnimatePresence>
                {showLog && (
                  <motion.pre
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mono"
                    style={{
                      marginTop: 8,
                      padding: 12,
                      fontSize: 12,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-dim)",
                      whiteSpace: "pre-wrap",
                      maxHeight: 240,
                      overflowY: "auto",
                      overflowX: "hidden",
                    }}
                  >
                    {result.raw_log}
                  </motion.pre>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 10px",
  color: "var(--text-faint)",
  fontWeight: 400,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--border)",
};
const tdStyle: React.CSSProperties = { padding: "6px 10px" };
