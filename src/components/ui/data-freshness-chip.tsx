"use client";

/**
 * DataFreshnessChip — Reads synced_at from the data manifest and
 * renders a subtle "Data refreshed: <date>" indicator.
 *
 * Fetches once on mount; silently hides if the manifest is unavailable.
 */

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

interface Manifest {
  synced_at?: string;
}

function formatRefreshDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function DataFreshnessChip() {
  const [refreshed, setRefreshed] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/_manifest.json")
      .then<Manifest>((r) => r.json())
      .then((manifest) => {
        if (manifest?.synced_at) {
          setRefreshed(formatRefreshDate(manifest.synced_at));
        }
      })
      .catch(() => {
        // silently swallow — non-critical UI element
      });
  }, []);

  if (!refreshed) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[var(--muted-foreground)]">
      <RefreshCw className="h-2.5 w-2.5 opacity-60" strokeWidth={2} />
      Data refreshed&nbsp;
      <span className="text-[var(--foreground)]/60">{refreshed}</span>
    </span>
  );
}
