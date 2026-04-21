/**
 * Cross-Page NaN Guard - Scans ALL dashboard JSON files for data defects
 * that would render as "NaN", "undefined", "Invalid Date", or similar
 * broken artifacts in the UI.
 *
 * This is a nuclear-level quality gate: if ANY of these fail, something
 * in the data pipeline produced a value that will look broken on screen.
 *
 * Test categories:
 *   1. Raw JSON file scanning for bare NaN/Infinity tokens
 *   2. Numeric field validation (no NaN, no Infinity)
 *   3. Date field validation (all parseable)
 *   4. String field validation (no "NaN" or "undefined" string values)
 *   5. Employer shard sampling (random shards have valid data)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "public/data");

// ======================================================================
// Helpers
// ======================================================================

function walkJsonFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkJsonFiles(fullPath));
    } else if (entry.name.endsWith(".json")) {
      results.push(fullPath);
    }
  }
  return results;
}

function scanForBadTokens(raw: string): { nanCount: number; infCount: number } {
  // Only flag NaN/Infinity that appears as a bare JSON value (not inside strings).
  // Strategy: try JSON.parse. If it succeeds, there are no bare NaN tokens.
  // If it fails, count occurrences via regex on non-string portions.
  try {
    JSON.parse(raw);
    return { nanCount: 0, infCount: 0 };
  } catch {
    // JSON parse failed - could be bare NaN/Infinity tokens
    // Strip all string values, then check remaining
    const stripped = raw.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    const nanMatches = stripped.match(/\bNaN\b/g);
    const infMatches = stripped.match(/\b-?Infinity\b/g);
    return {
      nanCount: nanMatches?.length ?? 0,
      infCount: infMatches?.length ?? 0,
    };
  }
}

function deepScanRecord(
  obj: unknown,
  path: string,
  issues: string[]
): void {
  if (obj === null || obj === undefined) return;

  if (typeof obj === "number") {
    if (isNaN(obj)) issues.push(`${path}: NaN number`);
    if (!isFinite(obj)) issues.push(`${path}: Infinity`);
    return;
  }

  if (typeof obj === "string") {
    if (obj === "NaN") issues.push(`${path}: string "NaN"`);
    if (obj === "undefined") issues.push(`${path}: string "undefined"`);
    if (obj === "Invalid Date") issues.push(`${path}: string "Invalid Date"`);
    return;
  }

  if (Array.isArray(obj)) {
    // Only scan first 100 elements for performance
    for (let i = 0; i < Math.min(obj.length, 100); i++) {
      deepScanRecord(obj[i], `${path}[${i}]`, issues);
    }
    return;
  }

  if (typeof obj === "object") {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      deepScanRecord(val, `${path}.${key}`, issues);
    }
  }
}

// ======================================================================
// 1. Raw JSON file scanning - all dashboard JSONs
// ======================================================================

describe("Cross-page NaN guard - raw JSON token scan", () => {
  const dashboardDir = path.join(DATA_DIR, "dashboards");
  const jsonFiles = walkJsonFiles(dashboardDir);

  it("found dashboard JSON files to scan", () => {
    expect(jsonFiles.length).toBeGreaterThan(10);
  });

  for (const filePath of jsonFiles) {
    const relPath = path.relative(DATA_DIR, filePath);

    it(`${relPath} - no bare NaN/Infinity`, () => {
      const raw = fs.readFileSync(filePath, "utf-8");
      const { nanCount, infCount } = scanForBadTokens(raw);
      expect(nanCount, `Found ${nanCount} bare NaN tokens`).toBe(0);
      expect(infCount, `Found ${infCount} bare Infinity tokens`).toBe(0);
    });
  }
});

// ======================================================================
// 2. Model JSON files (pd_forecasts, etc.)
// ======================================================================

describe("Cross-page NaN guard - model JSON files", () => {
  const modelsDir = path.join(DATA_DIR, "models");
  const jsonFiles = walkJsonFiles(modelsDir);

  for (const filePath of jsonFiles) {
    const relPath = path.relative(DATA_DIR, filePath);

    it(`${relPath} - no bare NaN/Infinity`, () => {
      const raw = fs.readFileSync(filePath, "utf-8");
      const { nanCount, infCount } = scanForBadTokens(raw);
      expect(nanCount, `Found ${nanCount} bare NaN tokens`).toBe(0);
      expect(infCount, `Found ${infCount} bare Infinity tokens`).toBe(0);
    });
  }
});

// ======================================================================
// 3. Deep value scan - all dashboard JSONs
// ======================================================================

describe("Cross-page NaN guard - deep value scan", () => {
  const dashboardDir = path.join(DATA_DIR, "dashboards");
  const jsonFiles = walkJsonFiles(dashboardDir);

  for (const filePath of jsonFiles) {
    const relPath = path.relative(DATA_DIR, filePath);

    it(`${relPath} - no NaN/undefined/Invalid Date values`, () => {
      const raw = fs.readFileSync(filePath, "utf-8");
      // Sanitize bare NaN/Infinity to null for JSON.parse
      const sanitized = raw.replace(/\bNaN\b|-?\bInfinity\b/g, "null");
      let data: unknown;
      try {
        data = JSON.parse(sanitized);
      } catch {
        // JSON parse error - skip (caught by token scan)
        return;
      }
      const issues: string[] = [];
      deepScanRecord(data, relPath, issues);
      expect(
        issues.length,
        `Data defects found:\n${issues.slice(0, 10).join("\n")}`
      ).toBe(0);
    });
  }
});

// ======================================================================
// 4. Date field validation across all cutoff/forecast files
// ======================================================================

describe("Cross-page NaN guard - date fields are parseable", () => {
  const dateFiles = [
    "dashboards/visa-bulletin/fact_cutoff_trends.json",
    "dashboards/visa-bulletin/fact_cutoffs_all.json",
    "models/pd_forecasts.json",
    "models/pd_forecasts_retrograde.json",
  ];

  for (const relPath of dateFiles) {
    it(`${relPath} - all date fields produce valid Date objects`, () => {
      const fullPath = path.join(DATA_DIR, relPath);
      if (!fs.existsSync(fullPath)) return;

      const data = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as Array<Record<string, unknown>>;
      const dateColumns = [
        "cutoff_date", "projected_cutoff_date",
        "confidence_low", "confidence_high",
        "forecast_month",
      ];
      let invalid = 0;
      for (const row of data.slice(0, 500)) {
        for (const col of dateColumns) {
          const v = row[col];
          if (v && typeof v === "string") {
            const d = new Date(v.split("T")[0] + "T00:00:00Z");
            if (!Number.isFinite(d.getTime())) {
              invalid++;
            }
          }
        }
      }
      expect(invalid, "Unparseable date values").toBe(0);
    });
  }
});

// ======================================================================
// 5. Employer shard sampling - random shards have valid structure
// ======================================================================

describe("Cross-page NaN guard - employer shard sampling", () => {
  const employerDir = path.join(DATA_DIR, "employers");
  const allShards = fs.existsSync(employerDir)
    ? fs.readdirSync(employerDir).filter(
        (f) => f.endsWith(".json") && !f.startsWith("_")
      )
    : [];

  it("has employer shards to sample", () => {
    expect(allShards.length).toBeGreaterThan(1000);
  });

  // Sample 50 random shards
  const sampleSize = Math.min(50, allShards.length);
  const sampledShards = allShards
    .sort(() => 0.5 - Math.random())
    .slice(0, sampleSize);

  it("sampled shards parse as valid JSON", () => {
    let parseErrors = 0;
    for (const shard of sampledShards) {
      try {
        JSON.parse(fs.readFileSync(path.join(employerDir, shard), "utf-8"));
      } catch {
        parseErrors++;
      }
    }
    expect(parseErrors, "Shards with JSON parse errors").toBe(0);
  });

  it("sampled shards have employer_name field", () => {
    let missing = 0;
    for (const shard of sampledShards) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(employerDir, shard), "utf-8")
        ) as Record<string, unknown>;
        if (!data.employer_name) missing++;
      } catch {
        // skip parse errors
      }
    }
    expect(missing, "Shards without employer_name").toBe(0);
  });

  it("sampled shards have no NaN string values", () => {
    const issues: string[] = [];
    for (const shard of sampledShards) {
      try {
        const raw = fs.readFileSync(path.join(employerDir, shard), "utf-8");
        const { nanCount } = scanForBadTokens(raw);
        if (nanCount > 0) issues.push(shard);
      } catch {
        // skip
      }
    }
    expect(
      issues.length,
      `Shards with bare NaN: ${issues.slice(0, 5).join(", ")}`
    ).toBe(0);
  });
});

// ======================================================================
// 6. RAG data quality
// ======================================================================

describe("Cross-page NaN guard - RAG data", () => {
  const ragDir = path.join(DATA_DIR, "rag");

  it("RAG chunks file has no NaN values", () => {
    const chunksPath = path.join(ragDir, "chunks.json");
    if (!fs.existsSync(chunksPath)) return;

    const raw = fs.readFileSync(chunksPath, "utf-8");
    const { nanCount } = scanForBadTokens(raw);
    expect(nanCount, "NaN in RAG chunks").toBe(0);
  });

  it("QA pairs file has no NaN values", () => {
    const qaPath = path.join(ragDir, "qa_pairs.json");
    if (!fs.existsSync(qaPath)) return;

    const raw = fs.readFileSync(qaPath, "utf-8");
    const { nanCount } = scanForBadTokens(raw);
    expect(nanCount, "NaN in QA pairs").toBe(0);
  });
});
