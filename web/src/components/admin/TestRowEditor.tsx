"use client";

import type { TestIn } from "@/lib/api";
import { pad2 } from "@/lib/domains";
import { Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

interface Props {
  tests: TestIn[];
  buckets: string[];
  onChange: (tests: TestIn[]) => void;
}

const CATEGORIES = ["logic", "reset", "timing", "width", "interface"];

/** Problems with the test list that the validation gate would also reject,
 * shown as the admin types rather than after a full validation run. */
export function testIssues(tests: TestIn[], buckets: string[]): string[] {
  const issues: string[] = [];
  if (!tests.length) issues.push("Add at least one test.");
  if (tests.length && !tests.some((t) => t.visible)) issues.push("Mark at least one test as visible. Students run those on Run.");
  const firstHidden = tests.findIndex((t) => !t.visible);
  if (firstHidden >= 0 && tests.slice(firstHidden).some((t) => t.visible)) {
    issues.push("Visible tests must come before hidden ones. Move them up, and check in that order in the test bench too.");
  }
  const ids = tests.map((t) => t.test_id.trim());
  const dup = ids.find((id, i) => id && ids.indexOf(id) !== i);
  if (dup) issues.push(`Test id ${dup} is used twice.`);
  if (tests.some((t) => !t.test_id.trim() || !t.purpose.trim())) issues.push("Every test needs an id and a behaviour name.");
  if (tests.some((t) => !buckets.includes(t.bucket))) issues.push("Every test must feed a rubric bucket that exists.");
  return issues;
}

export default function TestRowEditor({ tests, buckets, onChange }: Props) {
  const update = (i: number, patch: Partial<TestIn>) => onChange(tests.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= tests.length) return;
    const next = [...tests];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => {
    const used = new Set(tests.map((t) => t.test_id));
    let n = tests.length + 1;
    while (used.has(`T${n}`)) n++;
    onChange([...tests, { test_id: `T${n}`, purpose: "", category: "logic", hint: "", bucket: buckets[0] ?? "functional", visible: tests.length < 2 }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {tests.map((t, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: 14, background: "var(--bg-elevated)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <span className="mono tnum" style={{ fontSize: 12, fontWeight: 600 }}>
              TEST {pad2(i + 1)}
            </span>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                role="switch"
                checked={t.visible}
                onChange={(e) => update(i, { visible: e.target.checked })}
                className="bc-switch"
                aria-label={`Test ${i + 1} visible on Run`}
              />
              <span style={{ color: t.visible ? "var(--pass)" : "var(--fg-muted)", fontWeight: 600 }}>{t.visible ? "Visible" : "Hidden"}</span>
            </label>
            <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              <Button variant="icon" type="button" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path d="M3 7.5L6 4.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </Button>
              <Button variant="icon" type="button" aria-label="Move down" title="Move down" disabled={i === tests.length - 1} onClick={() => move(i, 1)}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path d="M3 4.5L6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </Button>
              <Button variant="icon" type="button" aria-label="Remove test" title="Remove test" onClick={() => onChange(tests.filter((_, idx) => idx !== i))} style={{ color: "var(--fail-text)" }}>
                <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden>
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </Button>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "90px minmax(0, 1fr)", gap: 8 }}>
            <Input aria-label="Test id" value={t.test_id} onChange={(e) => update(i, { test_id: e.target.value.replace(/\s/g, "") })} placeholder="T1" className="mono" />
            <Input aria-label="Behaviour" value={t.purpose} onChange={(e) => update(i, { purpose: e.target.value })} placeholder="wraps from 15 to 0" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 130px 140px", gap: 8, marginTop: 8 }}>
            <Input aria-label="Hint shown when it fails" value={t.hint} onChange={(e) => update(i, { hint: e.target.value })} placeholder="Hint shown when this fails" />
            <Select aria-label="Category" value={t.category} onChange={(e) => update(i, { category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select aria-label="Rubric bucket" value={t.bucket} onChange={(e) => update(i, { bucket: e.target.value })}>
              {buckets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ))}
      <div>
        <Button variant="secondary" size="sm" type="button" onClick={add}>
          Add test
        </Button>
      </div>
    </div>
  );
}
