/**
 * Data normalization integrity tests for P3 Compass.
 *
 * These tests read the actual synced JSON files in public/data/ and verify
 * that employer name normalization from P2 has been applied correctly:
 *
 * - No ALL-CAPS raw employer names (e.g., "GOOGLE INC", "GOOGLE LLC")
 * - Known duplicate variants are collapsed into one canonical entry
 * - Canonical names follow Title Case format
 *
 * Run after `npm run sync-data` to catch regressions when P2 artifacts change.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Resolve from project root (vitest runs from package.json directory)
const PUBLIC_DATA = join(process.cwd(), "public", "data");

function loadJson(relativePath: string): unknown[] {
  const fullPath = join(PUBLIC_DATA, relativePath);
  try {
    const raw = readFileSync(fullPath, "utf-8");
    return JSON.parse(raw) as unknown[];
  } catch {
    return []; // File doesn't exist yet — skip by returning empty
  }
}

/** Names known to be raw/un-normalized Google variants. */
const RAW_GOOGLE_VARIANTS = new Set([
  "GOOGLE INC",
  "Google Inc.",
  "GOOGLE INC.",
  "GOOGLE INC,",
  "Google LLC",
  "GOOGLE LLC",
  "GOOGLE LLC,",
]);

/** Checks if a string is ALL-CAPS (len > 3, no lowercase). */
function isAllCaps(name: string): boolean {
  return name.length > 3 && name === name.toUpperCase() && /[A-Z]/.test(name);
}

// ─── employer_salary_trend.json ──────────────────────────────────────────────

describe("public/data/dashboards/wage/employer_salary_trend.json", () => {
  const data = loadJson("dashboards/wage/employer_salary_trend.json") as Array<{
    employer_name?: string;
  }>;

  it("has data (sync has been run)", () => {
    expect(data.length).toBeGreaterThan(0);
  });

  it("does not contain raw Google variants", () => {
    const googleEntries = data
      .map((r) => r.employer_name ?? "")
      .filter((n) => n.toLowerCase().includes("google"));
    const rawVariants = googleEntries.filter((n) => RAW_GOOGLE_VARIANTS.has(n));
    expect(rawVariants).toStrictEqual([]);
  });

  it("contains the canonical 'Google' entry", () => {
    const names = data.map((r) => r.employer_name ?? "");
    const hasGoogle = names.includes("Google");
    // Only assert if any google entry exists at all
    if (names.some((n) => n.toLowerCase().includes("google"))) {
      expect(hasGoogle).toBe(true);
    }
  });

  it("top 50 employers by filings are not ALL-CAPS", () => {
    // Group by employer_name and find the top 50
    const counts: Record<string, number> = {};
    for (const row of data) {
      const name = row.employer_name ?? "";
      counts[name] = (counts[name] ?? 0) + 1;
    }
    const top50 = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([name]) => name);

    const allCapsNames = top50.filter(isAllCaps);
    expect(allCapsNames).toStrictEqual([]);
  });
});

// ─── employer_wage_rankings.json ─────────────────────────────────────────────

describe("public/data/dashboards/wage/employer_wage_rankings.json", () => {
  const data = loadJson("dashboards/wage/employer_wage_rankings.json") as Array<{
    employer_name?: string;
  }>;

  it("has data (sync has been run)", () => {
    expect(data.length).toBeGreaterThan(0);
  });

  it("does not contain raw Google variants", () => {
    const googleEntries = data
      .map((r) => r.employer_name ?? "")
      .filter((n) => n.toLowerCase().includes("google"));
    const rawVariants = googleEntries.filter((n) => RAW_GOOGLE_VARIANTS.has(n));
    expect(rawVariants).toStrictEqual([]);
  });

  it("top 100 employer names are not ALL-CAPS", () => {
    const allCapsNames = data
      .slice(0, 100)
      .map((r) => r.employer_name ?? "")
      .filter(isAllCaps);
    expect(allCapsNames).toStrictEqual([]);
  });
});

// ─── dim_employer.json ───────────────────────────────────────────────────────

describe("public/data/dims/dim_employer.json", () => {
  const data = loadJson(
    "dims/dim_employer.json"
  ) as Array<{ employer_name?: string; employer_id?: string }>;

  it("has data", () => {
    // dim_employer is large (240K+ entries) — just verify it loaded
    expect(data.length).toBeGreaterThan(100);
  });

  it("contains canonical Google entry", () => {
    const names = data.map((r) => r.employer_name ?? "");
    expect(names).toContain("Google");
  });

  it("sample of first 200 names are not ALL-CAPS", () => {
    const sample = data.slice(0, 200).map((r) => r.employer_name ?? "");
    const allCapsNames = sample.filter(isAllCaps);
    expect(allCapsNames).toStrictEqual([]);
  });

  it("employer_id values are unique strings", () => {
    const ids = data.map((r) => r.employer_id ?? "");
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(data.length);
  });
});

// ─── Canonical name contract: no known raw variants in any wage file ─────────

describe("Cross-file canonical employer name contract", () => {
  const salaryTrend = loadJson(
    "dashboards/wage/employer_salary_trend.json"
  ) as Array<{ employer_name?: string }>;
  const wageRankings = loadJson(
    "dashboards/wage/employer_wage_rankings.json"
  ) as Array<{ employer_name?: string }>;

  /** Returns all employer names across all provided datasets. */
  function allNames(
    datasets: Array<Array<{ employer_name?: string }>>
  ): string[] {
    return datasets.flatMap((d) => d.map((r) => r.employer_name ?? ""));
  }

  it("no dataset contains 'INFOSYS LIMITED' — should be 'Infosys'", () => {
    const names = allNames([salaryTrend, wageRankings]);
    expect(names).not.toContain("INFOSYS LIMITED");
  });

  it("no dataset contains 'TATA CONSULTANCY SERVICES LIMITED'", () => {
    const names = allNames([salaryTrend, wageRankings]);
    expect(names).not.toContain("TATA CONSULTANCY SERVICES LIMITED");
  });

  it("no dataset contains 'COGNIZANT TECHNOLOGY SOLUTIONS'", () => {
    const names = allNames([salaryTrend, wageRankings]);
    const allCapsVariant = names.filter(
      (n) => n.toUpperCase() === "COGNIZANT TECHNOLOGY SOLUTIONS"
    );
    expect(allCapsVariant).toStrictEqual([]);
  });

  it("no dataset contains 'AMAZON WEB SERVICES INC'", () => {
    const names = allNames([salaryTrend, wageRankings]);
    expect(names).not.toContain("AMAZON WEB SERVICES INC");
  });
});
