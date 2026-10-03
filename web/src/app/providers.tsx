"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { useState } from "react";
import ConnectionBanner from "@/components/bc/ConnectionBanner";
import { ToastProvider } from "@/components/bc/Toasts";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  // reducedMotion="user": every framer-motion animation respects
  // prefers-reduced-motion with no per-component checks.
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
        <ToastProvider>
          <ConnectionBanner />
          {children}
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
