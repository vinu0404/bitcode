"use client";

import Link from "next/link";
import { useEffect } from "react";
import ErrorScreen from "@/components/bc/ErrorScreen";
import Button from "@/components/ui/Button";

/** Catches a crash in any page below the root layout. Drafts live in
 * localStorage, so "your code is safe" is a promise this page can keep. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorScreen
      code="500 / SOMETHING TRIPPED"
      word="Short circuit."
      body="This page hit an error it could not recover from. Your code is saved on this device, so trying again is safe."
      detail={error.digest ? `Reference ${error.digest}` : undefined}
      actions={
        <>
          <Button variant="primary" size="lg" onClick={reset}>
            Try again
          </Button>
          <Link href="/bitcode">
            <Button variant="secondary" size="lg">
              Back to problems
            </Button>
          </Link>
        </>
      }
    />
  );
}
