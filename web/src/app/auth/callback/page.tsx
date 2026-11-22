"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { EmptyState, TraceLoader } from "@/components/bc/States";
import { loginWithSupabase } from "@/lib/api";
import { describeError, type Described } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/bitcode";
  const [failure, setFailure] = useState<Described | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    // Strict mode runs effects twice; the Google token must only be exchanged once.
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const { data, error } = await supabase().auth.getSession();
        if (error || !data.session) throw new Error("no session");
        await loginWithSupabase(data.session.access_token);
        router.replace(safeNext);
      } catch (err) {
        setFailure(err instanceof Error && err.message === "no session" ? { kind: "error", title: "Google sign-in was cancelled", body: "No account was signed in. You can try again.", retryable: true } : describeError(err, "sign in with Google"));
      }
    })();
  }, [router, safeNext]);

  if (!failure) return <TraceLoader label="Signing you in" minHeight={320} />;
  return (
    <EmptyState
      tone="error"
      title={failure.title}
      body={failure.body}
      minHeight={320}
      action={
        <Link href={`/login?next=${encodeURIComponent(safeNext)}`} style={{ fontWeight: 600, color: "var(--ch3-text)" }}>
          Back to log in
        </Link>
      }
    />
  );
}

export default function AuthCallbackPage() {
  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--fg)", padding: 24 }}>
      <Suspense fallback={<TraceLoader label="Signing you in" minHeight={320} />}>
        <Callback />
      </Suspense>
    </main>
  );
}
