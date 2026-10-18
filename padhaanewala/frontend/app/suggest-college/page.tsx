import { redirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * `/suggest-college` now redirects to `/add-college`.
 *
 * The two paths were always the same workflow — a signed-in student (usually a
 * college owner) files a `college-submission` that a reviewer approves — and
 * keeping two routes would mean two headings, two copy blocks and one queue.
 * `/add-college` is the canonical page; the footer and any inbound link still
 * resolve here and land on it. The route itself is kept, not deleted: a dead
 * `/suggest-college` would break the footer link and every bookmark to it.
 *
 * `noindex` stays because a redirect target that is itself `noindex` should not
 * accumulate a stray entry while the 30x settles.
 */
export const metadata: Metadata = {
  title: "Add Your College",
  robots: { index: false, follow: false },
};

export default function SuggestCollegePage() {
  redirect("/add-college");
}
