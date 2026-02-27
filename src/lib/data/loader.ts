/**
 * Data loaders for P2 Meridian artifacts (pre-converted to JSON).
 *
 * All loaders read from public/data/ at build time (static import)
 * or at client time (fetch from CDN). These are the only data access
 * functions in the app — no direct Parquet reads.
 */

const DATA_BASE = "/data";

/**
 * Generic JSON fetcher with type safety.
 * Sanitizes Python/Pandas-style NaN, Infinity, -Infinity values
 * that are invalid in strict JSON but present in P2 Meridian artifacts.
 */
async function fetchJson<T>(path: string): Promise<T> {
  const url = `${DATA_BASE}/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load data: ${url} (${res.status})`);
  }
  const raw = await res.text();
  // Replace bare NaN / Infinity / -Infinity with null (JSON-safe)
  const sanitized = raw.replace(/\bNaN\b|-?\bInfinity\b/g, "null");
  return JSON.parse(sanitized) as T;
}

// ---------------------------------------------------------------------------
// Dashboard data loaders
// ---------------------------------------------------------------------------

export async function loadDashboardData<T>(
  dashboard: string,
  artifact: string
): Promise<T[]> {
  return fetchJson<T[]>(`dashboards/${dashboard}/${artifact}.json`);
}

// ---------------------------------------------------------------------------
// Dimension loaders
// ---------------------------------------------------------------------------

export async function loadDimension<T>(name: string): Promise<T[]> {
  return fetchJson<T[]>(`dims/${name}.json`);
}

// ---------------------------------------------------------------------------
// Model loaders
// ---------------------------------------------------------------------------

export async function loadModelData<T>(name: string): Promise<T[]> {
  return fetchJson<T[]>(`models/${name}.json`);
}

export async function loadModelJson<T>(name: string): Promise<T> {
  return fetchJson<T>(`models/${name}.json`);
}

// ---------------------------------------------------------------------------
// RAG loaders
// ---------------------------------------------------------------------------

import type { RagChunk, RagQaPair, RagCatalogEntry } from "@/types/p2-artifacts";

export async function loadRagChunks(): Promise<RagChunk[]> {
  return fetchJson<RagChunk[]>("rag/all_chunks.json");
}

export async function loadRagQaPairs(): Promise<RagQaPair[]> {
  return fetchJson<RagQaPair[]>("rag/qa_cache.json");
}

export async function loadRagCatalog(): Promise<RagCatalogEntry[]> {
  return fetchJson<RagCatalogEntry[]>("rag/catalog.json");
}

// ---------------------------------------------------------------------------
// Manifest / freshness
// ---------------------------------------------------------------------------

interface SyncManifest {
  synced_at: string;
  p2_root: string;
  files: Record<string, { size_bytes: number; modified: string }>;
}

export async function loadManifest(): Promise<SyncManifest> {
  return fetchJson<SyncManifest>("_manifest.json");
}
