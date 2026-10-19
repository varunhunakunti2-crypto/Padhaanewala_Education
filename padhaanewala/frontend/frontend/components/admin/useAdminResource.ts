"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isForbidden } from "@/lib/api";

interface ResourceState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Minimal read-only resource hook for admin panels.
 *
 * The fetch runs inside the effect with an `ignore` flag so a response that
 * arrives after unmount (or after a newer request) is discarded. The panel
 * components can therefore render a real loading / error / empty state instead
 * of the previous behaviour of showing fabricated placeholder rows.
 *
 * `T` is the resolved shape, not necessarily an array: `GET /users` returns a
 * page envelope (`items` + `total`), and a hook hardcoded to `T[]` would force
 * that endpoint to flatten its own total away. Existing callers passing
 * `() => Promise<Row[]>` still infer `T = Row[]` unchanged.
 *
 * `reloadKey` re-runs the fetch when it changes, for panels whose query is
 * server-side (search / filters / paging). It is a single string rather than a
 * dependency array so it cannot be a fresh array identity on every render.
 *
 * The loader is handed an `AbortSignal` and should pass it through to
 * `apiFetch`. A panel whose query changes per keystroke — `StudentsSection`'s
 * search, the submission queue's status chips — then *cancels* the request it
 * superseded instead of leaving it to run to completion for nobody. `ignore`
 * only discards the result; the request itself still occupies the network and
 * the server. A loader that does not declare the parameter is unaffected (a
 * function with fewer parameters is assignable to this type), so adoption is
 * per-call-site rather than a flag day.
 */
export function useAdminResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  opts: {
    forbiddenMessage?: string;
    unreachableMessage?: string;
    reloadKey?: string;
  } = {},
): ResourceState<T> {
  const {
    forbiddenMessage = "You do not have permission to view this data.",
    unreachableMessage = "Could not reach the API.",
    reloadKey,
  } = opts;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Starts true so panels render a loading state on first paint without the
  // effect needing to synchronously set it (which causes a cascading render).
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);

  // Synced after commit rather than during render, so the ref is never written
  // as part of rendering.
  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(() => {
    setLoading(true);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let ignore = false;
    // Aborting is what stops a superseded request from still occupying the
    // network and the server. Created here so each effect run owns exactly one.
    const controller = new AbortController();

    loaderRef
      .current(controller.signal)
      .then((rows) => {
        if (ignore) return;
        setData(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        setError(isForbidden(err) ? forbiddenMessage : unreachableMessage);
      })
      .finally(() => {
        if (ignore) return;
        setLoading(false);
      });

    return () => {
      // Both statements run synchronously here, so `ignore` is already true by
      // the time the abort's rejection is handled as a microtask. That is what
      // stops a cancelled re-query from surfacing "Could not reach the API." on
      // the panel that cancelled it — dropping either half fails
      // `tests/admin-resource-abort.test.tsx`.
      ignore = true;
      controller.abort();
    };
  }, [nonce, forbiddenMessage, unreachableMessage, reloadKey]);

  return { data, error, loading, reload };
}
