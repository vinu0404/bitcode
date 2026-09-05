"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface Props extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const VARIANT: Record<Variant, React.CSSProperties> = {
  // A solid clay fill, not a gradient+glow — the glow ring read as
  // "modern SaaS," out of step with a paper page. A plain soft shadow is
  // enough to say "this is the one to press."
  primary: {
    background: "var(--accent)",
    border: "1px solid var(--accent-strong)",
    color: "var(--accent-ink)",
    boxShadow: "var(--shadow-glow)",
  },
  secondary: {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  },
  ghost: {
    background: "transparent",
    border: "1px solid transparent",
    color: "var(--text-dim)",
  },
  danger: {
    background: "var(--fail-soft)",
    border: "1px solid color-mix(in srgb, var(--fail) 40%, transparent)",
    color: "var(--fail)",
  },
};

const SIZE: Record<Size, React.CSSProperties> = {
  sm: { padding: "7px 13px", fontSize: 12.5, borderRadius: "var(--radius-sm)" },
  md: { padding: "10px 18px", fontSize: 14, borderRadius: "var(--radius)" },
};

// Fitts's Law: every button keeps a real minimum hit target even at the
// "sm" size — never smaller than ~34px tall, comfortably clickable.
export default function Button({ variant = "secondary", size = "md", style, disabled, children, ...rest }: Props) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1, filter: "brightness(1.08)" }}
      whileTap={disabled ? undefined : { scale: 0.97, y: 0 }}
      transition={{ duration: 0.12 }}
      disabled={disabled}
      style={{
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: size === "sm" ? 34 : 40,
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s, border-color 0.15s",
        ...VARIANT[variant],
        ...SIZE[size],
        ...style,
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
