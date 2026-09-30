"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isForbidden } from "@/lib/api";

interface ResourceState<T> {
  data: T[] | null;
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
 */
export function useAdminResource<T>(
  loader: () => Promise<T[]>,
  opts: { forbiddenMessage?: string; unreachableMessage?: string } = {},
): ResourceState<T> {
  const {
    forbiddenMessage = "You do not have permission to view this data.",
    unreachableMessage = "Could not reach the API.",
  } = opts;

  const [data, setData] = useState<T[] | null>(null);
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

    loaderRef
      .current()
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
      ignore = true;
    };
  }, [nonce, forbiddenMessage, unreachableMessage]);

  return { data, error, loading, reload };
}
