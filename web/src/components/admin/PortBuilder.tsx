"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Port } from "@/lib/api";
import { Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

interface Props {
  ports: Port[];
  onChange: (ports: Port[]) => void;
}

export default function PortBuilder({ ports, onChange }: Props) {
  function update(i: number, patch: Partial<Port>) {
    onChange(ports.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function add() {
    onChange([...ports, { name: "", dir: "input", width: 1, desc: "" }]);
  }
  function remove(i: number) {
    onChange(ports.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="mono" style={{ display: "grid", gridTemplateColumns: "140px 120px 80px 1fr 30px", gap: 8, marginBottom: 8, fontSize: 11, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        <span>name</span>
        <span>direction</span>
        <span>width</span>
        <span>description</span>
        <span />
      </div>
      <AnimatePresence initial={false}>
        {ports.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: "grid", gridTemplateColumns: "140px 120px 80px 1fr 30px", gap: 8, marginBottom: 8, alignItems: "center" }}
          >
            <Input aria-label="Port name" placeholder="e.g. a" value={p.name} onChange={(e) => update(i, { name: e.target.value })} style={{ padding: "7px 10px", fontSize: 13 }} />
            <Select aria-label="Direction" value={p.dir} onChange={(e) => update(i, { dir: e.target.value as Port["dir"] })} style={{ padding: "7px 10px", fontSize: 13 }}>
              <option value="input">input</option>
              <option value="output">output</option>
            </Select>
            <Input
              aria-label="Width"
              type="number"
              min={1}
              value={p.width}
              onChange={(e) => update(i, { width: parseInt(e.target.value || "1", 10) })}
              style={{ padding: "7px 10px", fontSize: 13 }}
            />
            <Input aria-label="Description" placeholder="Shown in the port table" value={p.desc ?? ""} onChange={(e) => update(i, { desc: e.target.value })} style={{ padding: "7px 10px", fontSize: 13 }} />
            <button onClick={() => remove(i)} aria-label="Remove port" style={{ color: "var(--fail-text)", background: "none", border: "none", fontSize: 13, padding: 6 }}>
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      <Button variant="secondary" size="sm" onClick={add}>
        Add port
      </Button>
    </div>
  );
}
