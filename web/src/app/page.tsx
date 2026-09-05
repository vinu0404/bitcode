"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthReady } from "@/lib/auth";

// The problem list is the real home — matches the convention every
// practice-site visitor already has (Jakob's Law). Dashboard and Profile
// are their own destinations now, reached from the nav, not bolted onto
// this one.
export default function RootRedirect() {
  const router = useRouter();
  const loggedIn = useAuthReady();

  useEffect(() => {
    if (loggedIn === true) router.replace("/problems");
    else if (loggedIn === false) router.replace("/login");
  }, [loggedIn, router]);

  return <p style={{ color: "var(--text-dim)" }}>Loading…</p>;
}
