import type { Metadata } from "next";
import DashboardExplorer from "@/components/dashboard/DashboardExplorer";
import { RequireAuth } from "@/components/layout/RequireAuth";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your personal dashboard — saved colleges, application deadlines, scholarship alerts, recent activity and personalised recommendations.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <RequireAuth>
      <DashboardExplorer />
    </RequireAuth>
  );
}
