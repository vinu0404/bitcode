// Shared motion vocabulary, matching the CSS easing tokens in globals.css.
import type { Variants } from "framer-motion";

export const EXPO_OUT = [0.16, 1, 0.3, 1] as const;
export const SPRING = [0.34, 1.56, 0.64, 1] as const;
export const IN_OUT = [0.65, 0, 0.35, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EXPO_OUT } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
