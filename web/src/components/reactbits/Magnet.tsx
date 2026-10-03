"use client";

// Adapted from React Bits Magnet (see LICENSE.md in this folder). Off for
// touch input and reduced motion, where a drifting button only gets in the way.

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function Magnet({ children, padding = 80, strength = 4 }: { children: ReactNode; padding?: number; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (Math.abs(cx - e.clientX) < r.width / 2 + padding && Math.abs(cy - e.clientY) < r.height / 2 + padding) {
        setPos({ x: (e.clientX - cx) / strength, y: (e.clientY - cy) / strength, active: true });
      } else {
        setPos((p) => (p.active ? { x: 0, y: 0, active: false } : p));
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [padding, strength]);

  return (
    <div ref={ref} style={{ display: "inline-block" }}>
      <div
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          transition: pos.active ? "transform 300ms cubic-bezier(0.16,1,0.3,1)" : "transform 600ms cubic-bezier(0.34,1.56,0.64,1)",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
