import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { pageMetadata } from "@/lib/seo";

// A per-account utility page: nothing here for a search index, and it should
// not compete with the sign-in page it redirects people back to.
export const metadata: Metadata = pageMetadata({
  title: "Reset your password",
  description: "Request a password reset link for your Padhaanewala account.",
  path: "/forgot-password",
  noindex: true,
});

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
