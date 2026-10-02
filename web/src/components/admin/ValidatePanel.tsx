"use client";

import type { ValidationResult } from "@/lib/api";
import { StatusIcon } from "@/components/bc/Status";
import Button from "@/components/ui/Button";

const CHECKS = [
  "The reference solution scores exactly 100.",
  "An empty stub scores below 100, so the bench can fail a design.",
  "Every declared test id is printed by the bench.",
  "At least one test is visible, and visible tests run before hidden ones.",
];

/** Turns the gate's log ("[1] reference scores 100: OK (got 100 ...)")
 * into one row per check. */
function parse(log: string): Array<{ ok: boolean; detail: string } | null> {
  const rows: Array<{ ok: boolean; detail: string } | null> = [null, null, null, null];
  for (const line of log.split("\n")) {
    const m = line.match(/^\[(\d)\][^:]*:\s*(OK|FAIL)\s*(?:\((.*)\))?/);
    if (m) rows[Number(m[1]) - 1] = { ok: m[2] === "OK", detail: m[3] ?? "" };
  }
  return rows;
}

export default function ValidatePanel({
  onValidate,
  onPublish,
  onUnpublish,
  validating,
  publishing,
  result,
  status,
}: {
  onValidate: () => void;
  onPublish: () => void;
  onUnpublish?: () => void;
  validating: boolean;
  publishing: boolean;
  result: ValidationResult | null;
  status: string;
}) {
  const rows = result ? parse(result.log) : [null, null, null, null];
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--fg-muted)" }}>
            VALIDATION GATE
          </div>
          <p style={{ fontSize: 13.5, color: "var(--fg-muted)", marginTop: 4 }}>All four must pass before students can see the problem.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={onValidate} loading={validating} loadingLabel="Validating">
            {result ? "Validate again" : "Validate"}
          </Button>
          {status === "published" ? (
            onUnpublish && (
              <Button variant="danger" onClick={onUnpublish}>
                Unpublish
              </Button>
            )
          ) : (
            <Button variant="primary" onClick={onPublish} loading={publishing} loadingLabel="Publishing" disabled={!result?.ok || status !== "validated"}>
              Publish
            </Button>
          )}
        </div>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {CHECKS.map((c, i) => {
          const r = rows[i];
          return (
            <li key={c} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 12, padding: "14px 20px", borderBottom: i < 3 ? "1px solid var(--border)" : 0 }}>
              <span style={{ paddingTop: 2 }}>
                <StatusIcon kind={validating ? "running" : !r ? "pending" : r.ok ? "pass" : "fail"} size={16} />
              </span>
              <span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{c}</span>
                {r?.detail && (
                  <span className="mono" style={{ display: "block", fontSize: 12, color: r.ok ? "var(--fg-faint)" : "var(--fail-text)", marginTop: 4 }}>
                    {r.detail}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {status === "published" && (
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--pass)", display: "flex", gap: 8, alignItems: "center" }}>
          <StatusIcon kind="pass" size={14} /> Live for students. Saving any change takes it back to draft until it is validated and published again.
        </div>
      )}
    </div>
  );
}
