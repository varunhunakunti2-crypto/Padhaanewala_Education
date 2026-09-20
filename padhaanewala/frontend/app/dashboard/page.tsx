import type { Metadata } from "next";
import { RequireAuth } from "@/components/layout/RequireAuth";
import DashboardExplorer from "@/components/dashboard/DashboardExplorer";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your personal dashboard — saved colleges, application deadlines, scholarship alerts, recent activity and personalised recommendations.",
};

export default function Page() {
  return (
    <RequireAuth>
      <DashboardExplorer />
    </RequireAuth>
  );
}