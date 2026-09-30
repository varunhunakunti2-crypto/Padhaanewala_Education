import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password | Padhaanewala",
  description: "Request a password reset link for your Padhaanewala account.",
  // A per-account utility page: nothing here for a search index, and it should
  // not compete with the sign-in page it redirects people back to.
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
