"use client";

import type { ReactNode } from "react";
import { AppProvider } from "@/lib/context/AppContext";
import { Toaster } from "@/components/ui/Toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      {children}
      <Toaster />
    </AppProvider>
  );
}