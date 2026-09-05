// Shared animation variants — one vocabulary of motion across the app so
// every list/card/panel enters the same way (Jakob's Law applied to the
// app's own internal consistency, not just external conventions).
import type { Variants } from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  show: { opacity: 1, scale: 1 },
};

export const springy = { type: "spring" as const, stiffness: 400, damping: 32 };
