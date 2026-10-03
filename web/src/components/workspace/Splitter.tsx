"use client";

import { useRef } from "react";

/** A 1px hairline with an 8px grab area between two panes. Reports the new
 * split as a fraction of the parent, clamped so neither side drops below
 * `minPx`. Arrow keys nudge it by 2% for keyboard users. */
export default function Splitter({
  direction,
  fraction,
  minPx,
  onChange,
  label,
}: {
  direction: "row" | "column";
  fraction: number;
  minPx: number;
  onChange: (fraction: number) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const horizontal = direction === "row";

  function clamp(f: number, total: number) {
    const min = Math.min(0.5, minPx / Math.max(total, 1));
    return Math.max(min, Math.min(1 - min, f));
  }

  function onPointerDown(e: React.PointerEvent) {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    e.preventDefault();
    const rect = parent.getBoundingClientRect();
    const total = horizontal ? rect.width : rect.height;
    const move = (ev: PointerEvent) => {
      const pos = horizontal ? ev.clientX - rect.left : ev.clientY - rect.top;
      onChange(clamp(pos / total, total));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = horizontal ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const total = horizontal ? parent.clientWidth : parent.clientHeight;
    const dec = horizontal ? "ArrowLeft" : "ArrowUp";
    const inc = horizontal ? "ArrowRight" : "ArrowDown";
    if (e.key === dec) onChange(clamp(fraction - 0.02, total));
    else if (e.key === inc) onChange(clamp(fraction + 0.02, total));
    else return;
    e.preventDefault();
  }

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuenow={Math.round(fraction * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      style={{
        position: "relative",
        flex: "none",
        width: horizontal ? 1 : "100%",
        height: horizontal ? "100%" : 1,
        background: "var(--border)",
        cursor: horizontal ? "col-resize" : "row-resize",
        zIndex: 5,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: horizontal ? "0 -4px" : "-4px 0",
        }}
      />
    </div>
  );
}
