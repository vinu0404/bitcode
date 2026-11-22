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

// The cookie the Bitronics site (and this one) writes for a Supabase session.
// Checked first so a visitor without one costs nothing: no client, no request.
const SUPABASE_COOKIE = /(?:^|;\s*)sb-[^=;]*-auth-token/;

let ssoInFlight: Promise<boolean> | null = null;

/** Single sign-on: when there is no Bitcode session but a Supabase session
 * cookie exists, exchange it for Bitcode tokens once. Concurrent callers
 * (React strict mode, several components) share one exchange. Never throws;
 * any failure just means "not signed in". */
function trySingleSignOn(): Promise<boolean> {
  ssoInFlight ??= (async () => {
    if (!SUPABASE_COOKIE.test(document.cookie)) return false;
    try {
      const { googleEnabled, supabase } = await import("./supabase");
      if (!googleEnabled) return false;
      const { data } = await supabase().auth.getSession();
      if (!data.session) return false;
      const { loginWithSupabase } = await import("./api");
      await loginWithSupabase(data.session.access_token);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    ssoInFlight = null;
  });
  return ssoInFlight;
}

/**
 * `isLoggedIn()` reads localStorage, which doesn't exist during SSR; the
 * server always renders as logged out, but the client's first render can
 * see a real token immediately, and React's hydration requires the first
 * client render to match the server exactly. Calling `isLoggedIn()`
 * straight in a render body (e.g. as a `useQuery({ enabled })` argument,
 * or an `if (!isLoggedIn())` redirect check) is exactly the
 * hydration-mismatch bug this hook exists to avoid.
 *
 * Returns `null` until mounted (render a loading state for this), then
 * `true`/`false` for the real, client-only answer; a plain boolean can't
 * tell "not checked yet" apart from "checked, logged out". It stays `null`
 * while a single sign-on exchange with an existing Supabase session runs.
 */
export function useAuthReady(): boolean | null {
  const [state, setState] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    if (isLoggedIn()) setState(true);
    else trySingleSignOn().then((ok) => live && setState(ok));
    return () => {
      live = false;
    };
  }, []);
  return state;
}
