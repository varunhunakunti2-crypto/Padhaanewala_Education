import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { TokenUrlCleanup } from "@/components/auth/TokenUrlCleanup";
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

  // A missing token is an invalid-token state, not a reason to navigate away:
  // visitors who open this URL directly must still see the error on this page.
  return (
    <>
      <TokenUrlCleanup />
      <ResetPasswordForm token={token} />
    </>
  );
}
