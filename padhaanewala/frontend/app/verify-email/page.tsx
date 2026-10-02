import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { VerifyEmailPanel } from "@/components/auth/VerifyEmailPanel";
import { pageMetadata } from "@/lib/seo";

// A one-shot confirmation link must not be indexed or archived.
export const metadata: Metadata = pageMetadata({
  title: "Confirming your email",
  description: "Confirming the email address on your Padhaanewala account.",
  path: "/verify-email",
  noindex: true,
});

export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const params = await searchParams;
  const raw = params.token;
  // `searchParams` values can be string | string[]; a duplicated key is not a
  // token we issued, so take it as absent rather than guessing.
  const token = typeof raw === "string" && raw.length > 0 ? raw : null;

  if (!token) {
    redirect("/login");
  }

  return <VerifyEmailPanel token={token} />;
}
