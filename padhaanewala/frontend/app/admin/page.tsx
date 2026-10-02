import { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { RequireAdmin } from "@/components/layout/RequireAdmin";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Admin",
  description: "Padhaanewala admin console for managing colleges, students, leads, content and analytics.",
  path: "/admin",
  noindex: true,
});

export default function AdminPage() {
  return (
    <RequireAdmin>
      <main className="mx-auto max-w-7xl px-4 pt-28 pb-10 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36 lg:pb-14">
        <AdminDashboard />
      </main>
    </RequireAdmin>
  );
}
