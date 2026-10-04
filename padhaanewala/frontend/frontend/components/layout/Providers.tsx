"use client";

import type { ReactNode } from "react";
import { AppProvider } from "@/lib/context/AppContext";
import { Toaster } from "@/components/ui/Toast";
import { AgeGate } from "@/components/compliance/AgeGate";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      {children}
      {/* Mounted here rather than per page: the DPDP s.9 gate has to cover
          every authenticated surface, and a page that forgot to include it is
          exactly the page that would collect personal data without consent. */}
      <AgeGate />
      <Toaster />
    </AppProvider>
  );
}