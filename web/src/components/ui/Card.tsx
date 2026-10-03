"use client";

import type { CSSProperties, ReactNode } from "react";

/** A bounded surface: elevated background and a hairline, no shadow.
 * Shadows are reserved for floating layers (palette, toasts). */
export default function Card({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
