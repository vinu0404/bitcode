"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { listProblems } from "@/lib/api";
import { DOMAINS, padNumber } from "@/lib/domains";
import { useHotkeys } from "@/lib/hotkeys";
import { setTheme, useTheme } from "@/lib/theme";
import { ShortcutChip } from "./Marks";

const OPEN_EVENT = "bitcode-open-palette";

/** For buttons that open the palette; the palette itself owns its state. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export interface Command {
  id: string;
  label: string;
  group: string;
  shortcut?: string[];
  run: () => void;
}

/** ⌘K. Page commands come in through `commands`; navigation, theme and
 * "open problem" are always there. */
export default function CommandPalette({ commands = [] }: { commands?: Command[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const theme = useTheme();

  useHotkeys([{ combo: "mod+k", handler: () => setOpen((o) => !o) }]);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const problems = useQuery({ queryKey: ["palette-problems"], queryFn: () => listProblems({ limit: 100 }), enabled: open, staleTime: 60_000 });

  const all = useMemo<Command[]>(() => {
    const base: Command[] = [
      ...commands,
      { id: "nav-problems", group: "Go to", label: "Problems", run: () => router.push("/bitcode") },
      { id: "nav-progress", group: "Go to", label: "Progress", run: () => router.push("/bitcode/progress") },
      {
        id: "theme",
        group: "Preferences",
        label: theme === "ink" ? "Switch to paper theme" : "Switch to ink theme",
        run: () => setTheme(theme === "ink" ? "paper" : "ink"),
      },
    ];
    for (const p of problems.data?.items ?? []) {
      base.push({
        id: `p-${p.slug}`,
        group: "Open problem",
        label: `${padNumber(p.number)}  ${p.title}  ${DOMAINS[p.domain].channel}`,
        run: () => router.push(`/bitcode/${p.slug}`),
      });
    }
    return base;
  }, [commands, problems.data, router, theme]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((c) => c.label.toLowerCase().includes(needle) || c.group.toLowerCase().includes(needle));
  }, [all, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);
  useEffect(() => setCursor(0), [q]);

  function choose(c: Command | undefined) {
    if (!c) return;
    setOpen(false);
    c.run();
  }

  let lastGroup = "";
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 250, background: "var(--overlay)", display: "flex", justifyContent: "center", paddingTop: "14vh" }}
        >
          <motion.div
            role="dialog"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "min(640px, calc(100vw - 32px))",
              maxHeight: "62vh",
              display: "flex",
              flexDirection: "column",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-float)",
              overflow: "hidden",
              alignSelf: "flex-start",
            }}
          >
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type a command or a problem"
              aria-label="Search commands"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  choose(filtered[cursor]);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              style={{ height: 52, padding: "0 18px", border: 0, borderBottom: "1px solid var(--border)", background: "transparent", fontSize: 15, outline: "none" }}
            />
            <div style={{ overflowY: "auto", padding: "6px 0" }} role="listbox">
              {filtered.length === 0 && <div style={{ padding: "14px 18px", color: "var(--fg-muted)", fontSize: 13.5 }}>Nothing matches. Try a number like 0004.</div>}
              {filtered.map((c, i) => {
                const header = c.group !== lastGroup ? c.group : null;
                lastGroup = c.group;
                return (
                  <div key={c.id}>
                    {header && (
                      <div className="mono" style={{ padding: "10px 18px 4px", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-faint)" }}>
                        {header}
                      </div>
                    )}
                    <div
                      role="option"
                      aria-selected={i === cursor}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => choose(c)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "9px 18px",
                        cursor: "pointer",
                        fontSize: 14,
                        background: i === cursor ? "var(--selection)" : "transparent",
                        whiteSpace: "pre",
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</span>
                      {c.shortcut && <ShortcutChip keys={c.shortcut} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
