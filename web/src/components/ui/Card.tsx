"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

interface Props {
  children: ReactNode;
  hover?: boolean;
  glass?: boolean; // name kept for call-site stability — see note below
  style?: CSSProperties;
  onClick?: () => void;
}

// Law of Common Region: one bounded surface + border reads as one group.
// `hover` lifts the card and warms the border on interaction — the visual
// affordance that it's clickable, reinforcing Fitts's Law targets.
//
// `glass` no longer means blur — glassmorphism read as a "modern screen"
// effect in real tension with a warm paper page (paper doesn't have
// translucency). It now means "lifted": a solid surface, a touch more
// radius, and a stronger shadow — a card resting on the page, not
// floating over it. Kept the prop name rather than rename it everywhere
// it's already used; the visual result is what changed.
export default function Card({ children, hover = false, glass = false, style, onClick }: Props) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -2, borderColor: "var(--border-strong)" } : undefined}
      transition={{ duration: 0.15 }}
      style={
        glass
          ? {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg)",
              cursor: onClick ? "pointer" : undefined,
              ...style,
            }
          : {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow-sm)",
              cursor: onClick ? "pointer" : undefined,
              ...style,
            }
      }
    >
      {children}
    </motion.div>
  );
}
