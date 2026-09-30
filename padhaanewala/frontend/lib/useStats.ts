"use client";

import { useEffect, useState } from "react";
import {
  EMPTY_STATS,
  fetchBackendHealth,
  fetchCatalogStats,
  type BackendHealth,
  type CatalogStats,
} from "@/lib/api";

export function useCatalogStats(
  fallback: Partial<CatalogStats> = {},
): CatalogStats {
  const [stats, setStats] = useState<CatalogStats>({
    ...EMPTY_STATS,
    ...fallback,
  });

  useEffect(() => {
    let active = true;
    fetchCatalogStats().then((s) => {
      if (active) setStats(s);
    });
    return () => {
      active = false;
    };
  }, []);

  return stats;
}

/**
 * Backend dependency health. `null` means the check has not answered yet, which
 * callers must render as "checking" — never as "healthy".
 */
export function useBackendHealth(): BackendHealth | null {
  const [health, setHealth] = useState<BackendHealth | null>(null);

  useEffect(() => {
    let active = true;
    fetchBackendHealth().then((h) => {
      if (active) setHealth(h);
    });
    return () => {
      active = false;
    };
  }, []);

  return health;
}