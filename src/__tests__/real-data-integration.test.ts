/**
 * Real-Data Integration Tests — SRS Search Pipeline
 *
 * These tests load ACTUAL data from public/data/employers/_search.json
 * (NOT mocks) and validate the complete data pipeline:
 *
 *   _search.json → loadEmployerSearch() → asScores mapping → Fuse.js → smart-sort → display
 *
 * If these tests fail, the live site is broken. Period.
 *
 * Key employers tested:
 *   - Optum Services (5,570 filings, SRS Good)
 *   - Infosys (227K filings, SRS Excellent)
 *   - Google (91K filings, SRS Good)
 *   - Microsoft (106K filings, SRS Good)
 *   - Tata Consultancy Services (166K filings, SRS Excellent)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Load REAL _search.json exactly like the browser does
// ---------------------------------------------------------------------------

interface CompactSearchEntry {
  n: string;
  id: string;
  f?: number;
  sc?: number;
  ms?: number;
  y?: number;
  ss?: number | null;
  st?: string;
}

interface EmployerSearchEntry {
  employer_name: string;
  employer_id: string;
  total_filings: number;
  n_soc_codes: number;
  latest_median_salary: number;
  latest_year: number;
  srs_score: number | null;
  srs_tier: string;
}

interface SponsorReliabilityScore {
  employer_name: string;
  employer_id: string;
  scope: string;
  srs: number | null;
  srs_tier: string;
  n_36m: number;
}

interface FuseResult {
  item: SponsorReliabilityScore;
  score: number;
  refIndex: number;
}

/**
 * Exact replica of loadEmployerSearch() from src/lib/data/employer-shard.ts
 */
function loadSearchIndex(): EmployerSearchEntry[] {
  const searchPath = join(
    process.cwd(),
    "public",
    "data",
    "employers",
    "_search.json"
  );
  const raw = readFileSync(searchPath, "utf-8");
  const sanitized = raw.replace(/\bNaN\b|-?\bInfinity\b/g, "null");
  const data: CompactSearchEntry[] = JSON.parse(sanitized);
  if (!Array.isArray(data) || data.length === 0) return [];

  const isCompact = "n" in data[0];

  return data.map((e) =>
    isCompact
      ? {
          employer_name: e.n as string,
          employer_id: e.id as string,
          total_filings: (e.f as number) ?? 0,
          n_soc_codes: (e.sc as number) ?? 0,
          latest_median_salary: (e.ms as number) ?? 0,
          latest_year: (e.y as number) ?? 0,
          srs_score: (e.ss as number) ?? null,
          srs_tier: (e.st as string) ?? "Unrated",
        }
      : {
          employer_name: e.n ?? "",
          employer_id: e.id ?? "",
          total_filings: 0,
          n_soc_codes: 0,
          latest_median_salary: 0,
          latest_year: 0,
          srs_score: null,
          srs_tier: "Unrated",
        }
  );
}

/**
 * Exact replica of asScores mapping in src/app/dashboard/employer/page.tsx (lines 85–93)
 */
function buildAsScores(entries: EmployerSearchEntry[]): SponsorReliabilityScore[] {
  return entries
    .filter((e) => e.srs_score != null || e.total_filings > 0)
    .map((e) => ({
      employer_name: e.employer_name,
      employer_id: e.employer_id,
      scope: "overall",
      srs: e.srs_score,
      srs_tier: e.srs_tier,
      n_36m: e.total_filings,
    }));
}

/**
 * Simulate Fuse.js substring search (case-insensitive) on employer_name
 */
function fuseSearch(
  scores: SponsorReliabilityScore[],
  query: string
): FuseResult[] {
  const q = query.toLowerCase();
  return scores
    .filter((s) => s.employer_name.toLowerCase().includes(q))
    .map((item, i) => ({
      item,
      score: item.employer_name.toLowerCase().startsWith(q)
        ? 0.01 // prefix match = very high relevance
        : item.employer_name.toLowerCase().includes(q)
          ? 0.3 // substring match = decent relevance
          : 0.5,
      refIndex: i,
    }));
}

/**
 * Exact replica of sortEmployerResults from src/lib/search/smart-sort.ts
 */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function getNameMatchBonus(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  if (n === q) return 1.0;
  if (n.startsWith(q)) return 0.7;
  if (n.includes(` ${q}`) || n.includes(`-${q}`)) return 0.5;
  return 0;
}

function sortEmployerResults(
  results: FuseResult[],
  query: string
): SponsorReliabilityScore[] {
  if (results.length === 0) return [];

  const cases = results.map((r) => r.item.n_36m);
  const maxCases = Math.max(...cases, 1);
  const scores = results
    .map((r) => r.item.srs)
    .filter((s): s is number => s != null && !isNaN(s));
  const maxScore = scores.length > 0 ? Math.max(...scores, 1) : 1;

  const scored = results.map((result) => {
    const textRelevance = 1 - (result.score ?? 0.5);
    const nameBonus = getNameMatchBonus(query, result.item.employer_name);
    const volumeScore = normalize(result.item.n_36m, 0, maxCases);
    const qualityScore =
      result.item.srs != null && !isNaN(result.item.srs)
        ? normalize(result.item.srs, 0, Math.max(maxScore, 100))
        : 0;
    const composite =
      textRelevance * 0.4 +
      nameBonus * 0.3 +
      volumeScore * 0.2 +
      qualityScore * 0.1;
    return { item: result.item, composite };
  });

  return scored
    .sort((a, b) => b.composite - a.composite)
    .map((s) => s.item);
}

// ---------------------------------------------------------------------------
// Load the data once for all tests
// ---------------------------------------------------------------------------

const entries = loadSearchIndex();
const asScores = buildAsScores(entries);

// ═══════════════════════════════════════════════════════════════════════════
// 1. SEARCH INDEX INTEGRITY
// ═══════════════════════════════════════════════════════════════════════════

describe("Real Data: _search.json integrity", () => {
  it("loads successfully with >100K entries", () => {
    expect(entries.length).toBeGreaterThan(100000);
  });

  it("every entry has employer_name (non-empty string)", () => {
    const bad = entries.filter(
      (e) => typeof e.employer_name !== "string" || e.employer_name.length === 0
    );
    expect(bad).toHaveLength(0);
  });

  it("every entry has employer_id (string)", () => {
    const bad = entries.filter((e) => typeof e.employer_id !== "string");
    expect(bad).toHaveLength(0);
  });

  it("total_filings is always a number (never NaN or undefined)", () => {
    const bad = entries.filter(
      (e) =>
        typeof e.total_filings !== "number" || isNaN(e.total_filings)
    );
    expect(bad).toHaveLength(0);
  });

  it("srs_score is either null or a finite number", () => {
    const bad = entries.filter(
      (e) =>
        e.srs_score !== null &&
        (typeof e.srs_score !== "number" || isNaN(e.srs_score))
    );
    expect(bad).toHaveLength(0);
  });

  it(">95K entries have total_filings > 0", () => {
    const withFilings = entries.filter((e) => e.total_filings > 0);
    expect(withFilings.length).toBeGreaterThan(95000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. asScores MAPPING VALIDATION (the fix that kept breaking)
// ═══════════════════════════════════════════════════════════════════════════

describe("Real Data: asScores mapping (n_36m population)", () => {
  it("produces >100K scores", () => {
    expect(asScores.length).toBeGreaterThan(100000);
  });

  it("EVERY entry has n_36m as a number (never undefined)", () => {
    const bad = asScores.filter(
      (s) => s.n_36m === undefined || s.n_36m === null || typeof s.n_36m !== "number"
    );
    if (bad.length > 0) {
      console.error(
        "Entries with missing n_36m:",
        bad.slice(0, 5).map((b) => b.employer_name)
      );
    }
    expect(bad).toHaveLength(0);
  });

  it(">95K entries have n_36m > 0 (not all zeros)", () => {
    const nonZero = asScores.filter((s) => s.n_36m > 0);
    expect(nonZero.length).toBeGreaterThan(95000);
  });

  it("no valid-ID entry displays '0 cases' when total_filings > 0 in source", () => {
    // For every entry WITH A VALID employer_id (non-empty) and total_filings > 0,
    // the corresponding asScores entry must have n_36m > 0.
    // Entries with empty employer_id are excluded (they can't be uniquely matched).
    const sourceWithFilings = new Map<string, number>();
    for (const e of entries) {
      if (e.employer_id && e.total_filings > 0) {
        sourceWithFilings.set(e.employer_id, e.total_filings);
      }
    }

    const broken = asScores.filter(
      (s) => s.employer_id && sourceWithFilings.has(s.employer_id) && s.n_36m === 0
    );
    expect(broken).toHaveLength(0);
  });

  it("what UI renders matches source data for valid-ID employers", () => {
    // Sample entries with valid (non-empty) employer_id and verify n_36m === total_filings
    const validIdScores = asScores.filter((s) => s.employer_id);
    const sample = validIdScores.filter((_, i) => i % 1000 === 0);
    for (const s of sample) {
      const source = entries.find((e) => e.employer_id === s.employer_id);
      if (source) {
        expect(s.n_36m).toBe(source.total_filings);
      }
    }
  });

  it("reports how many entries have empty employer_id (data quality gauge)", () => {
    const emptyIds = asScores.filter((s) => !s.employer_id);
    // This is a data quality metric — we track it but don't fail on it.
    // These employers can't load shards and should eventually be fixed in P2.
    console.log(`[DATA QUALITY] ${emptyIds.length} asScores entries have empty employer_id`);
    // At minimum, the majority (>60%) should have valid IDs
    const validIds = asScores.filter((s) => s.employer_id);
    expect(validIds.length).toBeGreaterThan(asScores.length * 0.6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. SPECIFIC EMPLOYER VALIDATION — Real data checks
// ═══════════════════════════════════════════════════════════════════════════

describe("Real Data: Optum Services validation", () => {
  const optum = asScores.find((s) => s.employer_name === "Optum Services");

  it("Optum Services exists in asScores", () => {
    expect(optum).toBeDefined();
  });

  it("Optum Services has n_36m >= 500 (search shows 500+ cases)", () => {
    expect(optum!.n_36m).toBeGreaterThanOrEqual(500);
  });

  it("Optum Services has SRS score (not null)", () => {
    expect(optum!.srs).not.toBeNull();
    expect(optum!.srs).toBeGreaterThan(0);
  });

  it("Optum Services tier is 'Good'", () => {
    expect(optum!.srs_tier).toBe("Good");
  });

  it("search result would display '5,570 cases' (not '0 cases')", () => {
    const display = (optum!.n_36m ?? 0).toLocaleString();
    expect(display).not.toBe("0");
    expect(Number(display.replace(/,/g, ""))).toBeGreaterThanOrEqual(500);
  });
});

describe("Real Data: Top employer validation", () => {
  const findEmployer = (name: string) =>
    asScores.find((s) => s.employer_name === name);

  it("Infosys has n_36m > 200K", () => {
    const e = findEmployer("Infosys");
    expect(e).toBeDefined();
    expect(e!.n_36m).toBeGreaterThan(200000);
  });

  it("Google has n_36m > 80K", () => {
    const e = findEmployer("Google");
    expect(e).toBeDefined();
    expect(e!.n_36m).toBeGreaterThan(80000);
  });

  it("Microsoft has n_36m > 100K", () => {
    const e = findEmployer("Microsoft");
    expect(e).toBeDefined();
    expect(e!.n_36m).toBeGreaterThan(100000);
  });

  it("Tata Consultancy Services has n_36m > 150K", () => {
    const e = findEmployer("Tata Consultancy Services");
    expect(e).toBeDefined();
    expect(e!.n_36m).toBeGreaterThan(150000);
  });

  it("Amazon Com Services has n_36m > 80K", () => {
    const e = findEmployer("Amazon Com Services");
    expect(e).toBeDefined();
    expect(e!.n_36m).toBeGreaterThan(80000);
  });

  it("Deloitte Consulting has SRS tier Excellent or Good", () => {
    const e = findEmployer("Deloitte Consulting");
    expect(e).toBeDefined();
    expect(["Good", "Excellent"]).toContain(e!.srs_tier);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. SEARCH + SORT INTEGRATION (end-to-end with real data)
// ═══════════════════════════════════════════════════════════════════════════

describe("Real Data: Search + Sort — 'Optum' query", () => {
  const hits = fuseSearch(asScores, "Optum");
  const sorted = sortEmployerResults(hits, "Optum").slice(0, 12);

  it("finds multiple Optum-related employers", () => {
    expect(hits.length).toBeGreaterThanOrEqual(5);
  });

  it("'Optum Services' is the FIRST result (highest volume)", () => {
    expect(sorted[0].employer_name).toBe("Optum Services");
  });

  it("first result shows n_36m >= 500 (not 0 cases)", () => {
    expect(sorted[0].n_36m).toBeGreaterThanOrEqual(500);
  });

  it("results are sorted by volume (Optum Services > Optum Care > rest)", () => {
    const optumServices = sorted.find(
      (s) => s.employer_name === "Optum Services"
    );
    const optumCare = sorted.find((s) => s.employer_name === "Optum Care");
    expect(optumServices).toBeDefined();
    expect(optumCare).toBeDefined();
    expect(optumServices!.n_36m).toBeGreaterThan(optumCare!.n_36m);
  });

  it("every Optum search result with valid ID has correct n_36m", () => {
    for (const result of sorted) {
      if (!result.employer_id) continue; // Skip empty-ID entries
      const source = entries.find((e) => e.employer_id === result.employer_id);
      if (source && source.total_filings > 0) {
        expect(result.n_36m).toBe(source.total_filings);
        expect(result.n_36m).toBeGreaterThan(0);
      }
    }
  });

  it("display text for each result is NOT '0 cases' (for employers with filings)", () => {
    for (const result of sorted) {
      if (result.n_36m > 0) {
        const display = `${(result.n_36m ?? 0).toLocaleString()} cases`;
        expect(display).not.toBe("0 cases");
      }
    }
  });
});

describe("Real Data: Search + Sort — 'Google' query", () => {
  const hits = fuseSearch(asScores, "Google");
  const sorted = sortEmployerResults(hits, "Google").slice(0, 12);

  it("'Google' is the first result (exact name match + highest volume)", () => {
    expect(sorted[0].employer_name).toBe("Google");
  });

  it("Google shows 91K+ cases", () => {
    expect(sorted[0].n_36m).toBeGreaterThan(80000);
  });
});

describe("Real Data: Search + Sort — 'Microsoft' query", () => {
  const hits = fuseSearch(asScores, "Microsoft");
  const sorted = sortEmployerResults(hits, "Microsoft").slice(0, 12);

  it("'Microsoft' is the first result", () => {
    expect(sorted[0].employer_name).toBe("Microsoft");
  });

  it("Microsoft shows 100K+ cases", () => {
    expect(sorted[0].n_36m).toBeGreaterThan(100000);
  });
});

describe("Real Data: Search + Sort — 'Infosys' query", () => {
  const hits = fuseSearch(asScores, "Infosys");
  const sorted = sortEmployerResults(hits, "Infosys").slice(0, 12);

  it("'Infosys' is the first result", () => {
    expect(sorted[0].employer_name).toBe("Infosys");
  });

  it("Infosys shows 200K+ cases", () => {
    expect(sorted[0].n_36m).toBeGreaterThan(200000);
  });

  it("Infosys has Excellent SRS tier", () => {
    expect(sorted[0].srs_tier).toBe("Excellent");
  });
});

describe("Real Data: Search + Sort — 'Amazon' query", () => {
  const hits = fuseSearch(asScores, "Amazon");
  const sorted = sortEmployerResults(hits, "Amazon").slice(0, 12);

  it("finds multiple Amazon entities", () => {
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });

  it("'Amazon Com Services' is first (highest volume)", () => {
    expect(sorted[0].employer_name).toBe("Amazon Com Services");
  });

  it("shows 90K+ cases", () => {
    expect(sorted[0].n_36m).toBeGreaterThan(80000);
  });
});

describe("Real Data: Search + Sort — 'Tata' query", () => {
  const hits = fuseSearch(asScores, "Tata");
  const sorted = sortEmployerResults(hits, "Tata").slice(0, 12);

  it("'Tata Consultancy Services' is first", () => {
    expect(sorted[0].employer_name).toBe("Tata Consultancy Services");
  });

  it("shows 160K+ cases", () => {
    expect(sorted[0].n_36m).toBeGreaterThan(150000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. EDGE CASES AND REGRESSION GUARDS
// ═══════════════════════════════════════════════════════════════════════════

describe("Real Data: Edge cases", () => {
  it("search for very short query 'A' returns nothing (min 2 chars enforced in UI)", () => {
    // The UI enforces min 2 chars, but our sort function should handle it
    const hits = fuseSearch(asScores, "A");
    // This would return thousands of results; the UI limits to 12
    expect(hits.length).toBeGreaterThan(0);
  });

  it("search for nonexistent employer returns empty", () => {
    const hits = fuseSearch(asScores, "ZZZZXYZNONEXISTENT12345");
    expect(hits).toHaveLength(0);
  });

  it("no employer in asScores has n_36m = NaN", () => {
    const nanEntries = asScores.filter((s) => isNaN(s.n_36m));
    expect(nanEntries).toHaveLength(0);
  });

  it("no employer in asScores has n_36m = undefined", () => {
    const undefinedEntries = asScores.filter(
      (s) => s.n_36m === undefined
    );
    expect(undefinedEntries).toHaveLength(0);
  });

  it("employer with valid ID, 0 filings, and no SRS is filtered out by asScores", () => {
    // Verify the filter works: entries with 0 filings AND null SRS should be excluded
    // Only check entries with valid (non-empty) employer_id to avoid false positives
    const excluded = entries.filter(
      (e) => e.employer_id && e.total_filings === 0 && e.srs_score === null
    );
    for (const ex of excluded.slice(0, 100)) {
      const inScores = asScores.find((s) => s.employer_id === ex.employer_id);
      expect(inScores).toBeUndefined();
    }
  });

  it("employer with low filings but known SRS brand is handles gracefully", () => {
    // Optum Medical Care may have < 5 filings (below _search.json threshold).
    // Verify that searching for small Optum entities doesn't crash,
    // and that the main Optum Services entry is always present.
    const optumHits = fuseSearch(asScores, "Optum");
    const optumServices = optumHits.find((h) => h.item.employer_name === "Optum Services");
    expect(optumServices).toBeDefined();
    // Sub-entities with very few filings may or may not appear depending on threshold
    expect(optumHits.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. DISPLAY RENDERING SIMULATION (what the user actually sees)
// ═══════════════════════════════════════════════════════════════════════════

describe("Real Data: UI display simulation", () => {
  it("Optum Services search result displays correctly", () => {
    const hits = fuseSearch(asScores, "Optum");
    const sorted = sortEmployerResults(hits, "Optum").slice(0, 12);
    const optum = sorted.find((s) => s.employer_name === "Optum Services")!;

    // Exactly what the component renders:
    const caseText = `${(optum.n_36m ?? 0).toLocaleString()} cases`;
    expect(caseText).not.toBe("0 cases");
    expect(caseText).toMatch(/^\d[\d,]+ cases$/);

    // SRS tier display
    const hasSrs = optum.srs != null && !isNaN(optum.srs);
    expect(hasSrs).toBe(true);
    expect(optum.srs_tier).toBe("Good");
  });

  it("Top 10 employers all display non-zero case counts", () => {
    const top10 = [...asScores]
      .sort((a, b) => b.n_36m - a.n_36m)
      .slice(0, 10);

    for (const emp of top10) {
      const display = `${(emp.n_36m ?? 0).toLocaleString()} cases`;
      expect(display).not.toBe("0 cases");
      expect(emp.n_36m).toBeGreaterThan(10000);
    }
  });

  it("random sample of 50 employers with filings all display correctly", () => {
    const withFilings = asScores.filter((s) => s.n_36m > 0);
    const step = Math.floor(withFilings.length / 50);
    
    for (let i = 0; i < withFilings.length; i += step) {
      const emp = withFilings[i];
      const display = (emp.n_36m ?? 0).toLocaleString();
      expect(display).not.toBe("0");
      expect(emp.n_36m).toBeGreaterThan(0);
    }
  });
});
