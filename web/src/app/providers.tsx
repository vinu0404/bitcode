"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  // reducedMotion="user" makes every framer-motion animation in the app
  // respect prefers-reduced-motion automatically — no per-component checks.
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
        {children}
      </MotionConfig>
    </QueryClientProvider>
  );
}
