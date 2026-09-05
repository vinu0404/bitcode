"use client";

import { useEffect, useState } from "react";

const ACCESS_KEY = "bitcode_access_token";
const REFRESH_KEY = "bitcode_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}

/**
 * `isLoggedIn()` reads localStorage, which doesn't exist during SSR — the
 * server always renders as logged out, but the client's first render can
 * see a real token immediately, and React's hydration requires the first
 * client render to match the server exactly. Calling `isLoggedIn()`
 * straight in a render body (e.g. as a `useQuery({ enabled })` argument,
 * or an `if (!isLoggedIn())` redirect check) is exactly the
 * hydration-mismatch bug this hook exists to avoid.
 *
 * Returns `null` until mounted (render a loading state for this), then
 * `true`/`false` for the real, client-only answer — a plain boolean can't
 * tell "not checked yet" apart from "checked, logged out".
 */
export function useAuthReady(): boolean | null {
  const [state, setState] = useState<boolean | null>(null);
  useEffect(() => setState(isLoggedIn()), []);
  return state;
}
