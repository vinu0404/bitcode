import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Empty locally: a host-only cookie, which browsers share across ports, so
// the Bitronics site on one port and Bitcode on another see one session. In
// production set the shared parent domain (e.g. ".example.com") on both sites.
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN;

/** False when the env vars are unset: the Google button stays hidden and
 * single sign-on is off. */
export const googleEnabled = !!URL && !!KEY;

let client: SupabaseClient | null = null;

/** The Supabase session lives in a cookie named sb-<project>-auth-token, the
 * same cookie the Bitronics site writes, so a visitor already signed in
 * there is signed in here. Bitcode still issues and uses its own tokens for
 * its API; this session is only what gets exchanged for them. */
export function supabase(): SupabaseClient {
  client ??= createBrowserClient(URL!, KEY!, COOKIE_DOMAIN ? { cookieOptions: { domain: COOKIE_DOMAIN } } : undefined);
  return client;
}
