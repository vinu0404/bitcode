"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useMediaQuery } from "@/lib/usePersistentState";

/* Toasts are for things that happen outside the screen the student is
   looking at: saves, copies, connection changes, a request that failed.
   Test results never go here; they belong in the results pane.

   They stack like a deck, newest in front. Hovering or focusing the deck
   fans it out and pauses every timer; a hairline along the bottom of each
   card shows the time it has left. Esc dismisses the newest. */

export type ToastKind = "success" | "info" | "warn" | "error";

export interface ToastInput {
  title?: string;
  body?: string;
  kind?: ToastKind;
  action?: { label: string; run: () => void };
  /** ms; defaults to 3000, or 8000 for errors and warnings */
  duration?: number;
}

interface Toast extends Required<Pick<ToastInput, "kind">> {
  id: number;
  title?: string;
  body?: string;
  action?: ToastInput["action"];
  duration: number;
  count: number;
  /** ms left on the timer, and when the timer last (re)started */
  remaining: number;
  startedAt: number;
}

type Push = {
  (text: string, kind?: ToastKind): void;
  (input: ToastInput): void;
};

const ToastContext = createContext<Push>((() => {}) as Push);

export function useToast(): Push {
  return useContext(ToastContext);
}

const META: Record<ToastKind, { color: string; text: string; label: string }> = {
  success: { color: "var(--pass)", text: "var(--pass)", label: "Done" },
  info: { color: "var(--ch3)", text: "var(--ch3-text)", label: "Note" },
  warn: { color: "var(--warn)", text: "var(--warn)", label: "Heads up" },
  error: { color: "var(--fail)", text: "var(--fail-text)", label: "Error" },
};

function KindIcon({ kind }: { kind: ToastKind }) {
  const c = META[kind].color;
  return (
    <span
      aria-hidden
      style={{
        width: 28,
        height: 28,
        flex: "none",
        display: "grid",
        placeItems: "center",
        borderRadius: 8,
        background: `color-mix(in srgb, ${c} 16%, transparent)`,
        color: c,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14">
        {kind === "success" && <path d="M3 7.4l2.6 2.6L11 4.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
        {kind === "error" && <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
        {kind === "warn" && (
          <>
            <path d="M7 3.2v4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="7" cy="10.6" r="1" fill="currentColor" />
          </>
        )}
        {kind === "info" && (
          <>
            <circle cx="7" cy="3.6" r="1" fill="currentColor" />
            <path d="M7 6.2v4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
      </svg>
    </span>
  );
}

const GAP = 8;
const PEEK = 12; // how much of each older card shows behind the front one
const MAX = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());
  const narrow = useMediaQuery("(max-width: 1023px)");

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const arm = useCallback(
    (t: Toast) => {
      window.clearTimeout(timers.current.get(t.id));
      timers.current.set(t.id, window.setTimeout(() => dismiss(t.id), t.remaining));
    },
    [dismiss],
  );

  const push = useCallback(
    ((arg: string | ToastInput, kindArg?: ToastKind) => {
      const input: ToastInput = typeof arg === "string" ? { body: arg, kind: kindArg ?? "info" } : arg;
      const kind = input.kind ?? "info";
      const duration = input.duration ?? (kind === "error" || kind === "warn" ? 8000 : 3000);
      setToasts((list) => {
        // The same message again: bump its counter and restart its timer.
        const same = list.find((x) => x.kind === kind && x.title === input.title && x.body === input.body);
        if (same) {
          const bumped = { ...same, count: same.count + 1, remaining: duration, startedAt: Date.now(), duration };
          arm(bumped);
          return list.map((x) => (x.id === same.id ? bumped : x));
        }
        const t: Toast = { id: nextId.current++, kind, title: input.title, body: input.body, action: input.action, duration, count: 1, remaining: duration, startedAt: Date.now() };
        arm(t);
        const next = [...list, t];
        for (const old of next.slice(0, Math.max(0, next.length - MAX))) window.clearTimeout(timers.current.get(old.id));
        return next.slice(-MAX);
      });
    }) as Push,
    [arm],
  );

  // Fanning the deck out pauses every timer; folding it resumes them.
  useEffect(() => {
    setToasts((list) =>
      list.map((t) => {
        if (expanded) {
          window.clearTimeout(timers.current.get(t.id));
          return { ...t, remaining: Math.max(800, t.remaining - (Date.now() - t.startedAt)) };
        }
        const resumed = { ...t, startedAt: Date.now() };
        arm(resumed);
        return resumed;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !toasts.length || document.querySelector('[role="dialog"]')) return;
      dismiss(toasts[toasts.length - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toasts, dismiss]);

  useEffect(() => {
    if (!toasts.length) setExpanded(false);
  }, [toasts.length]);

  const ordered = [...toasts].reverse(); // newest first
  const frontHeight = heights[ordered[0]?.id] ?? 72;
  const stackHeight = expanded
    ? ordered.reduce((a, t) => a + (heights[t.id] ?? 72) + GAP, 0)
    : frontHeight + Math.min(ordered.length - 1, 2) * PEEK;

  return (
    <ToastContext.Provider value={push}>
      {children}
      <section
        aria-label="Notifications"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setExpanded(false)}
        style={{
          position: "fixed",
          zIndex: 300,
          right: narrow ? "50%" : 16,
          transform: narrow ? "translateX(50%)" : undefined,
          bottom: narrow ? "calc(84px + env(safe-area-inset-bottom))" : 16,
          width: "min(380px, calc(100vw - 32px))",
          height: toasts.length ? stackHeight : 0,
          transition: "height 300ms cubic-bezier(0.16,1,0.3,1)",
          pointerEvents: toasts.length ? "auto" : "none",
        }}
      >
        <AnimatePresence initial={false}>
          {ordered.map((t, i) => {
            let offset = 0;
            for (let j = 0; j < i; j++) offset += (heights[ordered[j].id] ?? 72) + GAP;
            const y = expanded ? -offset : -i * PEEK;
            const scale = expanded ? 1 : 1 - i * 0.05;
            return (
              <ToastCard
                key={t.id}
                t={t}
                y={y}
                scale={scale}
                hidden={!expanded && i > 2}
                front={i === 0}
                paused={expanded}
                z={MAX - i}
                onHeight={(h) => setHeights((m) => (m[t.id] === h ? m : { ...m, [t.id]: h }))}
                onClose={() => dismiss(t.id)}
              />
            );
          })}
        </AnimatePresence>
      </section>
    </ToastContext.Provider>
  );
}

function ToastCard({
  t,
  y,
  scale,
  hidden,
  front,
  paused,
  z,
  onHeight,
  onClose,
}: {
  t: Toast;
  y: number;
  scale: number;
  hidden: boolean;
  front: boolean;
  paused: boolean;
  z: number;
  onHeight: (h: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const meta = META[t.kind];
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const title = t.title ?? meta.label;

  return (
    <motion.div
      ref={ref}
      layout={false}
      role={t.kind === "error" || t.kind === "warn" ? "alert" : "status"}
      aria-live={t.kind === "error" || t.kind === "warn" ? "assertive" : "polite"}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: hidden ? 0 : 1, y, scale }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      style={{
        position: "absolute",
        right: 0,
        bottom: 0,
        width: "100%",
        zIndex: z,
        transformOrigin: "bottom center",
        overflow: "hidden",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-sm)",
        boxShadow: "var(--shadow-float)",
        pointerEvents: hidden ? "none" : "auto",
      }}
    >
      <div style={{ display: "flex", gap: 12, padding: "12px 12px 13px 12px", alignItems: "flex-start", opacity: front || paused ? 1 : 0.55, transition: "opacity 200ms" }}>
        <KindIcon kind={t.kind} />
        <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{title}</span>
            {t.count > 1 && (
              <span className="mono tnum" style={{ fontSize: 10.5, color: meta.text, border: `1px solid ${meta.color}`, borderRadius: 999, padding: "0 6px" }}>
                ×{t.count}
              </span>
            )}
          </div>
          {t.body && <p style={{ fontSize: 13, lineHeight: 1.45, color: "var(--fg-muted)", marginTop: 2 }}>{t.body}</p>}
          {t.action && (
            <button
              onClick={() => {
                t.action!.run();
                onClose();
              }}
              style={{
                marginTop: 8,
                height: 28,
                padding: "0 10px",
                borderRadius: "var(--r-inline)",
                border: `1px solid color-mix(in srgb, ${meta.color} 55%, transparent)`,
                background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
                color: meta.text,
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Dismiss notification"
          style={{ width: 24, height: 24, flex: "none", display: "grid", placeItems: "center", border: 0, borderRadius: 6, background: "transparent", color: "var(--fg-faint)" }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {/* time left */}
      <span
        aria-hidden
        key={`${t.id}-${t.count}`}
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 2,
          width: "100%",
          background: meta.color,
          opacity: 0.7,
          transformOrigin: "left",
          animation: `bc-toast-life ${t.duration}ms linear forwards`,
          animationPlayState: paused ? "paused" : "running",
        }}
      />
    </motion.div>
  );
}
