"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useToast } from "./Toasts";

/** A slim bar across the top while the browser is offline, and a quiet
 * toast when the connection comes back. Drafts autosave locally, so the bar
 * says so: the student's first worry is losing work. */
export default function ConnectionBanner() {
  const [offline, setOffline] = useState(false);
  const wasOffline = useRef(false);
  const toast = useToast();

  useEffect(() => {
    const update = () => {
      const off = !navigator.onLine;
      setOffline(off);
      if (!off && wasOffline.current) toast({ kind: "success", title: "Back online", body: "Run and Submit work again." });
      wasOffline.current = off;
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [toast]);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          role="status"
          initial={{ y: -40 }}
          animate={{ y: 0 }}
          exit={{ y: -40 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 280,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 10,
            height: 32,
            background: "color-mix(in srgb, var(--warn) 16%, var(--bg))",
            borderBottom: "1px solid color-mix(in srgb, var(--warn) 45%, transparent)",
            fontSize: 12.5,
          }}
        >
          <span className="mono" style={{ fontWeight: 600, letterSpacing: "0.14em", color: "var(--warn)" }}>
            OFFLINE
          </span>
          <span style={{ color: "var(--fg-muted)" }}>Your code keeps saving on this device. Run and Submit come back with the connection.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
