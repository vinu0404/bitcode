"use client";

import { useEffect, useState } from "react";

const KEY = "bitcode-theme";
const CHANGE_EVENT = "bitcode-theme-change";

// Ink is the product's default, whatever the OS says; paper is a choice.
export type Theme = "ink" | "paper";

export function resolveTheme(): Theme {
  if (typeof window === "undefined") return "ink";
  try {
    return localStorage.getItem(KEY) === "paper" ? "paper" : "ink";
  } catch {
    return "ink";
  }
}

export function setTheme(theme: Theme): void {
  if (theme === "paper") document.documentElement.setAttribute("data-theme", "paper");
  else document.documentElement.removeAttribute("data-theme");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode: the choice just will not persist */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Current theme for JS-rendered UI (Monaco theme, toggle icon).
 *
 * Starts at the fixed server value and corrects in an effect, so the first
 * client render matches the server HTML. The CSS itself is already right on
 * first paint: the blocking script in layout.tsx stamps `data-theme`. */
export function useTheme(): Theme {
  const [theme, setThemeState] = useState<Theme>("ink");
  useEffect(() => {
    const update = () => setThemeState(resolveTheme());
    update();
    window.addEventListener(CHANGE_EVENT, update);
    return () => window.removeEventListener(CHANGE_EVENT, update);
  }, []);
  return theme;
}
