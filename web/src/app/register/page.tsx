"use client";

import { Suspense } from "react";
import AuthForm from "@/components/bc/AuthForm";
import { register } from "@/lib/api";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="register" action={register} />
    </Suspense>
  );
}
