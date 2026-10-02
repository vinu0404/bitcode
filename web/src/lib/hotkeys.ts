"use client";

import { useEffect, useRef, useState } from "react";

/** "⌘" on Apple platforms, "Ctrl" elsewhere. Starts as "⌘" on both server
 * and client so hydration matches, then corrects after mount. */
export function useModKey(): string {
  const [mod, setMod] = useState("⌘");
  useEffect(() => {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "";
    setMod(/mac|iphone|ipad/i.test(platform) ? "⌘" : "Ctrl");
  }, []);
  return mod;
}

export interface Hotkey {
  /** e.g. "mod+enter", "mod+shift+enter", "mod+k", "alt+shift+f", "mod+1", "mod+]" */
  combo: string;
  handler: (e: KeyboardEvent) => void;
  /** Fire even while typing in an input or the editor. Default true: every
   * workspace shortcut uses a modifier, so it cannot collide with typing. */
  allowInInputs?: boolean;
}

function matches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const want = { mod: parts.includes("mod"), shift: parts.includes("shift"), alt: parts.includes("alt") };
  const mod = e.metaKey || e.ctrlKey;
  if (want.mod !== mod || want.shift !== e.shiftKey || want.alt !== e.altKey) return false;
  const k = e.key.toLowerCase();
  if (key === "enter") return k === "enter";
  // With alt held, macOS reports a composed character in e.key; e.code is stable.
  if (/^[a-z]$/.test(key)) return k === key || e.code === `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return k === key || e.code === `Digit${key}`;
  if (key === "]") return k === "]" || e.code === "BracketRight";
  if (key === "[") return k === "[" || e.code === "BracketLeft";
  return k === key;
}

/** Global keyboard shortcuts. Handlers are read through a ref, so callers can
 * pass fresh closures every render without re-binding the listener. */
export function useHotkeys(hotkeys: Hotkey[]): void {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const h of ref.current) {
        if (!matches(e, h.combo)) continue;
        const target = e.target as HTMLElement | null;
        const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
        if (typing && h.allowInInputs === false) continue;
        e.preventDefault();
        e.stopPropagation();
        h.handler(e);
        return;
      }
    };
    // Capture phase, so Monaco does not swallow ⌘⏎ and friends first.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
