"use client";

import { useEffect, useState } from "react";

const KEY = "bitcode-theme";
const CHANGE_EVENT = "bitcode-theme-change";

export type Theme = "light" | "dark";

function storedChoice(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : null;
}

function systemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(): Theme {
  return storedChoice() ?? systemTheme();
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(KEY, theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Current resolved theme, reactive to both an explicit toggle and a live
 * OS-level preference change (for anyone who hasn't overridden it yet).
 *
 * The initial state is a fixed literal, deliberately NOT resolveTheme() —
 * calling it as a lazy initializer reads `window` during the client's
 * first render (which happens before hydration reconciles against the
 * server-rendered HTML), while the server had no `window` and can only
 * guess. Two different first-paint values on server vs. client is exactly
 * a React hydration mismatch. Matching the server's fixed guess here and
 * correcting to the real value in an effect (which never runs during SSR
 * and only runs client-side *after* hydration) avoids that by construction
 * — the theme-dependent CSS itself doesn't have this problem, since the
 * blocking <script> in layout.tsx's <head> stamps `data-theme` before any
 * paint; this hook only drives JS-rendered UI like the toggle's icon. */
export function useTheme(): Theme {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const update = () => setThemeState(resolveTheme());
    update();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    window.addEventListener(CHANGE_EVENT, update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener(CHANGE_EVENT, update);
    };
  }, []);

  return theme;
}
