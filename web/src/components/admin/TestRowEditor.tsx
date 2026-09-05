"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { TestIn } from "@/lib/api";
import { Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

interface Props {
  tests: TestIn[];
  buckets: string[];
  onChange: (tests: TestIn[]) => void;
}

const COLS = "70px 1fr 110px 1fr 120px 30px";

export default function TestRowEditor({ tests, buckets, onChange }: Props) {
  function update(i: number, patch: Partial<TestIn>) {
    onChange(tests.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function add() {
    const nextId = `T${tests.length + 1}`;
    onChange([...tests, { test_id: nextId, purpose: "", category: "logic", hint: "", bucket: buckets[0] ?? "functional" }]);
  }
  function remove(i: number) {
    onChange(tests.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="mono" style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, marginBottom: 8, fontSize: 10.5, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        <span>id</span>
        <span>purpose</span>
        <span>category</span>
        <span>hint</span>
        <span>bucket</span>
        <span />
      </div>
      <AnimatePresence initial={false}>
        {tests.map((t, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, marginBottom: 8 }}>
            <Input aria-label="Test id" value={t.test_id} onChange={(e) => update(i, { test_id: e.target.value })} style={{ padding: "7px 9px", fontSize: 12.5 }} placeholder="T1" />
            <Input aria-label="Purpose" value={t.purpose} onChange={(e) => update(i, { purpose: e.target.value })} style={{ padding: "7px 9px", fontSize: 12.5 }} placeholder="e.g. carry-in" />
            <Input aria-label="Category" value={t.category} onChange={(e) => update(i, { category: e.target.value })} style={{ padding: "7px 9px", fontSize: 12.5 }} placeholder="logic" />
            <Input aria-label="Hint" value={t.hint} onChange={(e) => update(i, { hint: e.target.value })} style={{ padding: "7px 9px", fontSize: 12.5 }} placeholder="shown on failure" />
            <Select aria-label="Bucket" value={t.bucket} onChange={(e) => update(i, { bucket: e.target.value })} style={{ padding: "7px 9px", fontSize: 12.5 }}>
              {buckets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
            <button onClick={() => remove(i)} aria-label="Remove test" style={{ color: "var(--fail)", background: "none", border: "none", fontSize: 13, padding: 6 }}>
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      <Button variant="secondary" size="sm" onClick={add}>
        + add test
      </Button>
    </div>
  );
}
