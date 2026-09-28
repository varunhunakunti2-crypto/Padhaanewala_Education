import type { Metadata } from "next";
import DashboardExplorer from "@/components/dashboard/DashboardExplorer";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { BETA_NOINDEX } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your account — the colleges you have saved and the updates we have sent you, in one place.",
  ...BETA_NOINDEX,
};

export default function Page() {
  return (
    <RequireAuth>
      <DashboardExplorer />
    </RequireAuth>
  );
}
