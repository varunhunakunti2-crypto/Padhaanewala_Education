"use client";

import { useEffect } from "react";

/**
 * Remove a one-time `?token=` from the address bar after the page has read it.
 *
 * The server component reads the token from `searchParams` and passes it to the
 * client as a prop; only the browser can rewrite the URL, so this renders
 * nothing and does the rewrite in an effect. `history.replaceState` (rather
 * than `router.replace`) keeps the current entry and avoids a second render or
 * a navigation that could consume the token again.
 */
export function cleanedUrlWithoutToken(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has("token")) return null;
  url.searchParams.delete("token");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function TokenUrlCleanup() {
  useEffect(() => {
    const next = cleanedUrlWithoutToken(window.location.href);
    if (!next) return;
    window.history.replaceState(window.history.state, "", next);
  }, []);

  return null;
}
