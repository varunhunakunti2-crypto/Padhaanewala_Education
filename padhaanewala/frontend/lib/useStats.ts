"use client";

import { useEffect, useState } from "react";
import { EMPTY_STATS, fetchCatalogStats, type CatalogStats } from "@/lib/api";

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