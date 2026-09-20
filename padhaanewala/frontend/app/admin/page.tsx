import { Metadata } from "next";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin",
  description: "Padhaanewala admin console for managing colleges, students, leads, content and analytics.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <RequireAuth>
        <AdminDashboard />
      </RequireAuth>
    </main>
  );
}