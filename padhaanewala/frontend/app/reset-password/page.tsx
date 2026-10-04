import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { pageMetadata } from "@/lib/seo";

// A one-shot credential must not be indexed or archived.
export const metadata: Metadata = pageMetadata({
  title: "Choose a new password",
  description: "Set a new password for your Padhaanewala account.",
  path: "/reset-password",
  noindex: true,
});

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const params = await searchParams;
  const raw = params.token;
  const token = typeof raw === "string" && raw.length > 0 ? raw : null;

  // Without a token there is nothing to submit, so send the visitor somewhere
  // useful rather than rendering a form that can only fail.
  if (!token) {
    redirect("/forgot-password");
  }

  return <ResetPasswordForm token={token} />;
}
