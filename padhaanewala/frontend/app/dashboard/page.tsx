import type { Metadata } from "next";
import DashboardExplorer from "@/components/dashboard/DashboardExplorer";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Dashboard",
  description:
    "Your account — the colleges you have saved and the updates we have sent you, in one place.",
  path: "/dashboard",
  noindex: true,
});

export default function Page() {
  return (
    <RequireAuth>
      <DashboardExplorer />
    </RequireAuth>
  );
}
