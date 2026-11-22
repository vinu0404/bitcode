"use client";

import { useRef, type ReactNode } from "react";
import type { Domain } from "@/lib/api";
import { DOMAIN_ORDER, DOMAINS } from "@/lib/domains";

/** Arrow keys move the selection inside a radio group, like native radios. */
function useRovingKeys<T extends string>(values: T[], value: T, onChange: (v: T) => void) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = values.indexOf(value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % values.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + values.length) % values.length;
    if (next < 0) return;
    e.preventDefault();
    onChange(values[next]);
    refs.current[next]?.focus();
  };
  return { refs, onKeyDown };
}

function Check({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 20,
        height: 20,
        flex: "none",
        display: "grid",
        placeItems: "center",
        borderRadius: 999,
        border: `1.5px solid ${on ? color : "var(--border-strong)"}`,
        background: on ? color : "transparent",
        color: "var(--on-channel)",
        transition: "background 150ms, border-color 150ms",
      }}
    >
      {on && (
        <svg width="11" height="11" viewBox="0 0 12 12">
          <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/** Domain as four check-mark cards, each in its own colour. */
export function ChannelPicker({ value, onChange, id }: { value: Domain; onChange: (d: Domain) => void; id?: string }) {
  const { refs, onKeyDown } = useRovingKeys(DOMAIN_ORDER, value, onChange);
  return (
    <div id={id} role="radiogroup" aria-label="Domain" onKeyDown={onKeyDown} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
      {DOMAIN_ORDER.map((d, i) => {
        const on = d === value;
        const ch = DOMAINS[d];
        return (
          <button
            key={d}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(d)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 14px",
              textAlign: "left",
              borderRadius: "var(--r-sm)",
              border: `1.5px solid ${on ? ch.fill : "var(--border-strong)"}`,
              background: on ? `color-mix(in srgb, ${ch.fill} 12%, transparent)` : "transparent",
              transition: "border-color 150ms, background 150ms",
            }}
          >
            <Check on={on} color={ch.fill} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{ch.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A segmented control for a small, fixed set of options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  id,
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  id?: string;
}) {
  const { refs, onKeyDown } = useRovingKeys(
    options.map((o) => o.value),
    value,
    onChange,
  );
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--bg-sunken)" }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={on ? "bc-seg bc-seg-on" : "bc-seg"}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
