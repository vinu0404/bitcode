"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthReady } from "./auth";

/** null while checking, then true. Redirects to login (and back here after)
 * when there is no session. */
export function useRequireAuth(): boolean | null {
  const ready = useAuthReady();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (ready === false) router.replace(`/login?next=${encodeURIComponent(pathname || "/bitcode")}`);
  }, [ready, router, pathname]);
  return ready === true ? true : null;
}
