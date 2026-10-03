"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ReactNode } from "react";
import { ShortcutChip } from "@/components/bc/Marks";
import { StatusIcon } from "@/components/bc/Status";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon";
type Size = "sm" | "md" | "lg";

interface Props extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  /** Keys shown in a shortcut chip after the label, e.g. ["⌘", "⏎"]. */
  shortcut?: string[];
  /** Swaps the label for a spinner plus `loadingLabel`, keeping the width. */
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

const HEIGHT: Record<Size, number> = { sm: 32, md: 36, lg: 48 };

const VARIANT: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--action)", color: "var(--action-text)", border: "1px solid transparent" },
  secondary: { background: "transparent", color: "var(--fg)", border: "1px solid var(--border-strong)" },
  ghost: { background: "transparent", color: "var(--fg-muted)", border: "1px solid transparent" },
  danger: { background: "transparent", color: "var(--fail-text)", border: "1px solid var(--fail)" },
  icon: { background: "transparent", color: "var(--fg-muted)", border: "1px solid transparent" },
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "secondary", size = "md", shortcut, loading, loadingLabel = "Running", icon, style, disabled, children, ...rest },
  ref,
) {
  const h = variant === "icon" ? 32 : HEIGHT[size];
  const inert = disabled || loading;
  return (
    <motion.button
      ref={ref}
      whileHover={inert ? undefined : { scale: 1.02 }}
      whileTap={inert ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      disabled={disabled}
      aria-busy={loading || undefined}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: h,
        minWidth: variant === "icon" ? 32 : undefined,
        padding: variant === "icon" ? 0 : size === "lg" ? "0 22px" : "0 14px",
        borderRadius: variant === "icon" ? "var(--r-inline)" : "var(--r-sm)",
        fontSize: size === "lg" ? 15 : 14,
        fontWeight: 600,
        whiteSpace: "nowrap",
        opacity: disabled ? 0.45 : 1,
        transition: "background 150ms, border-color 150ms, color 150ms",
        ...VARIANT[variant],
        ...style,
      }}
      {...rest}
    >
      {/* The idle content always lays out (hidden while loading) so the
          button keeps its width when it swaps to the spinner. */}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, visibility: loading ? "hidden" : "visible" }}>
        {icon}
        {children}
        {shortcut && <ShortcutChip keys={shortcut} />}
      </span>
      {loading && (
        <span style={{ position: "absolute", inset: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <StatusIcon kind="running" size={14} />
          {loadingLabel}
        </span>
      )}
    </motion.button>
  );
});

export default Button;

export function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path d="M3 1.8v8.4L10 6z" fill="currentColor" />
    </svg>
  );
}

export function ArrowIcon({ dir = "right", size = 14 }: { dir?: "right" | "left"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden style={{ transform: dir === "left" ? "scaleX(-1)" : undefined }}>
      <path d="M2 7h10M8 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
