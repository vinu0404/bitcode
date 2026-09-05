"use client";

import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface ValidationResult {
  ok: boolean;
  ref_score: number | null;
  stub_score: number | null;
  log: string;
}

interface Props {
  onValidate: () => void;
  onPublish: () => void;
  validating: boolean;
  publishing: boolean;
  result: ValidationResult | null;
  published: boolean;
}

export default function ValidatePanel({ onValidate, onPublish, validating, publishing, result, published }: Props) {
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 10 }}>
        Validation gate
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
        Checks: (1) the reference solution scores exactly 100, (2) an empty stub module scores below 100 — a
        testbench that never fails would silently pass every student — and (3) declared test ids match what the
        simulator prints.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Button variant="secondary" onClick={onValidate} disabled={validating}>
          {validating ? "Validating…" : "Validate"}
        </Button>
        <Button variant="primary" onClick={onPublish} disabled={publishing || !result?.ok || published}>
          {published ? "Published ✓" : publishing ? "Publishing…" : "Publish"}
        </Button>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ marginBottom: 10 }}>
            <Badge tone={result.ok ? "pass" : "fail"}>{result.ok ? "Passed" : "Failed"}</Badge>
          </div>
          <pre
            className="mono"
            style={{
              fontSize: 12,
              whiteSpace: "pre-wrap",
              margin: 0,
              color: "var(--text-dim)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: 12,
            }}
          >
            {result.log}
          </pre>
        </motion.div>
      )}
    </Card>
  );
}
