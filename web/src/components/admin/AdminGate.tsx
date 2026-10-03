"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, TraceLoader } from "@/components/bc/States";
import Button from "@/components/ui/Button";
import { getMe } from "@/lib/api";
import { useRequireAuth } from "@/lib/useRequireAuth";

/** Admin pages render only for admins; everyone else gets a clear way out
 * instead of a page of failed requests. The API enforces this regardless. */
export default function AdminGate({ children }: { children: ReactNode }) {
  const authed = useRequireAuth();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, enabled: authed === true, staleTime: 5 * 60_000 });
  if (authed === null || me.isLoading) return <TraceLoader label="Checking access" />;
  if (me.data?.role !== "admin") {
    return (
      <EmptyState
        tone="error"
        title="Admins only"
        body="This area is for publishing problems. Your account does not have access."
        action={
          <Link href="/bitcode">
            <Button variant="secondary" size="sm">
              Go to problems
            </Button>
          </Link>
        }
      />
    );
  }
  return <>{children}</>;
}
