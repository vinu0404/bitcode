"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { inViewTransition } from "@/lib/viewTransition";

/** Re-mounts on every navigation inside /bitcode: a short fade and rise.
 * Skipped during a shared-element view transition, which animates instead,
 * and on a hidden page, where animation frames do not run and the page
 * would otherwise be left half faded. */
export default function BitcodeTemplate({ children }: { children: React.ReactNode }) {
  const [skip] = useState(() => inViewTransition() || (typeof document !== "undefined" && document.hidden));
  return (
    <motion.div
      initial={skip ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
