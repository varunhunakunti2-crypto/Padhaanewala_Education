/**
 * Theme bootstrap. Externalised from `app/layout.tsx` in Phase 5.1.
 *
 * This must stay a *blocking* script and must stay the first thing in <body>:
 * it sets the `dark` class on <html> before the first paint, which is the whole
 * point. If it is deferred, moved below the fold, or fails to load, a dark-mode
 * visitor sees a white flash on every navigation.
 *
 * It lives in `public/` rather than inline for one reason: an inline <script>
 * requires `'unsafe-inline'` in script-src, and a file loaded from our own
 * origin does not. It is the only first-party script in the document, so
 * keeping it external means the Content-Security-Policy in `proxy.ts` has
 * nothing to allow *us*.
 *
 * Never add a nonce here. A nonce is only known per-request, so a nonce in the
 * policy would force every page to be dynamically rendered and would destroy
 * the ISR windows in `app/page.tsx` and the [slug] routes. The tradeoff is
 * recorded in proxy.ts.
 */
(function () {
  try {
    var stored = localStorage.getItem("cp_theme");
    var prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = stored === "dark" || (!stored && prefersDark);
    var root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  } catch {
    /* Private-mode Safari and cookie-blocking settings can throw on
       localStorage access. The page still renders; it just follows the OS. */
  }
})();
