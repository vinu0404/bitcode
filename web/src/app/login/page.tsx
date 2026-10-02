"use client";

import { Suspense } from "react";
import AuthForm from "@/components/bc/AuthForm";
import { login } from "@/lib/api";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="login" action={login} />
    </Suspense>
  );
}
