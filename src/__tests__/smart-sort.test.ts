import { describe, it, expect } from "vitest";
import {
  sortEmployerResults,
  sortSocResults,
  sortWageEmployerResults,
  sortRagResults,
} from "@/lib/search/smart-sort";
import type { SponsorReliabilityScore } from "@/types/p2-artifacts";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Build a fake Fuse result item with a given score */
function fuseResult<T>(item: T, score: number, refIndex = 0) {
  return { item, score, refIndex };
}

/** Build a minimal SponsorReliabilityScore stub */
function employer(
  name: string,
  n_36m: number,
  srs: number | null = null,
  srs_tier: string = "Unrated"
): SponsorReliabilityScore {
  return {
    employer_name: name,
    employer_id: name.toLowerCase().replace(/\s/g, "_"),
    n_36m,
    srs: srs as number,
    srs_tier,
  } as SponsorReliabilityScore;
}

/* ------------------------------------------------------------------ */
/*  sortEmployerResults                                                */
/* ------------------------------------------------------------------ */

describe("sortEmployerResults", () => {
  it("returns empty array for empty input", () => {
    expect(sortEmployerResults([], "test")).toEqual([]);
  });

  it("ranks exact name match above partial match with same Fuse score", () => {
    const results = [
      fuseResult(employer("Google LLC", 100, 70), 0.1),
      fuseResult(employer("Google", 100, 70), 0.1), // exact match for query "google"
    ];
    const sorted = sortEmployerResults(results, "Google");
    // With identical volume/SRS, exact name match (1.0) beats prefix (0.7)
    expect(sorted[0].employer_name).toBe("Google");
  });

  it("ranks prefix match above substring match", () => {
    const results = [
      fuseResult(employer("My Infosys Corp", 300, 75), 0.05),
      fuseResult(employer("Infosys Limited", 300, 75), 0.05), // prefix
    ];
    const sorted = sortEmployerResults(results, "infosys");
    expect(sorted[0].employer_name).toBe("Infosys Limited");
  });

  it("boosts high-volume employer over low-volume with similar text scores", () => {
    const results = [
      fuseResult(employer("Tech Alpha Inc", 5, 60), 0.15),
      fuseResult(employer("Tech Beta Inc", 5000, 60), 0.15),
    ];
    const sorted = sortEmployerResults(results, "tech");
    expect(sorted[0].employer_name).toBe("Tech Beta Inc");
  });

  it("uses SRS as tiebreaker when other signals are equal", () => {
    const results = [
      fuseResult(employer("Acme Corp", 100, 40), 0.1),
      fuseResult(employer("Acme Inc", 100, 90), 0.1),
    ];
    const sorted = sortEmployerResults(results, "acme");
    expect(sorted[0].employer_name).toBe("Acme Inc"); // higher SRS
  });

  it("does NOT sort alphabetically — result order depends on composite score", () => {
    const results = [
      fuseResult(employer("Aardvark Corp", 10, 30), 0.3),
      fuseResult(employer("Zebra Tech", 5000, 95), 0.05),
    ];
    const sorted = sortEmployerResults(results, "z");
    // Zebra should rank first: better text match for "z", higher volume, higher SRS
    expect(sorted[0].employer_name).toBe("Zebra Tech");
  });

  it("handles employers with null/NaN SRS gracefully", () => {
    const results = [
      fuseResult(employer("Unrated Corp", 200, null, "Unrated"), 0.1),
      fuseResult(employer("Rated Corp", 200, 80, "Good"), 0.1),
    ];
    const sorted = sortEmployerResults(results, "corp");
    // Rated employer should rank higher due to quality tiebreaker
    expect(sorted[0].employer_name).toBe("Rated Corp");
  });

  // ── Named real-world scenario: searching "Optum" ──────────────────────────
  // This mirrors the actual SRS search page behavior. Optum Services is the
  // largest Optum entity by H-1B case volume and must rank #1.

  it("searching 'Optum' ranks 'Optum Services' first (volume + prefix match)", () => {
    // All three start with "optum" so they all get the same prefix-match bonus (0.7).
    // Volume (n_36m) is the main tiebreaker — Optum Services has the most filings.
    // Uses Fuse score 0.05 for all (same text quality), isolating the volume signal.
    const results = [
      fuseResult(employer("Optum Technology Solutions", 200, 70, "Good"), 0.05),
      fuseResult(employer("Optum Services", 5000, 85, "Good"), 0.05),
      fuseResult(employer("Optum Health", 50, null, "Unrated"), 0.05),
    ];
    const sorted = sortEmployerResults(results, "Optum");
    expect(sorted[0].employer_name).toBe("Optum Services");
  });

  it("searching 'Optum' — full expected ranking order (Services > Technology > Health)", () => {
    const results = [
      fuseResult(employer("Optum Technology Solutions", 200, 70, "Good"), 0.05),
      fuseResult(employer("Optum Services", 5000, 85, "Good"), 0.05),
      fuseResult(employer("Optum Health", 50, null, "Unrated"), 0.05),
    ];
    const sorted = sortEmployerResults(results, "Optum");
    // Expected: Optum Services (5000 cases) > Optum Technology (200) > Optum Health (50)
    expect(sorted[0].employer_name).toBe("Optum Services");
    expect(sorted[1].employer_name).toBe("Optum Technology Solutions");
    expect(sorted[2].employer_name).toBe("Optum Health");
  });

  it("searching 'Optum Ser' ranks 'Optum Services' first (stronger prefix match)", () => {
    // When query more closely matches 'Optum Services', the name-match bonus (0.7
    // for prefix) further amplifies its lead over other Optum variants.
    const results = [
      fuseResult(employer("Optum Services", 5000, 85, "Good"), 0.02),
      fuseResult(employer("Optum Technology Solutions", 200, 70, "Good"), 0.4),
      fuseResult(employer("Optum Health", 50, null, "Unrated"), 0.5),
    ];
    const sorted = sortEmployerResults(results, "Optum Ser");
    expect(sorted[0].employer_name).toBe("Optum Services");
  });

  it("returns all items (no filtering, only reordering)", () => {
    const results = [
      fuseResult(employer("A", 10, 20), 0.4),
      fuseResult(employer("B", 20, 30), 0.3),
      fuseResult(employer("C", 30, 40), 0.2),
    ];
    const sorted = sortEmployerResults(results, "test");
    expect(sorted).toHaveLength(3);
  });

  it("volume + quality can outweigh text relevance for extreme differences", () => {
    // Volume (20%) + quality (10%) can combine to overcome text gap
    // when the volume/quality difference is extreme
    const results = [
      fuseResult(employer("Poor Match", 10000, 100), 0.5),
      fuseResult(employer("Perfect Match", 1, 10), 0.0),
    ];
    const sorted = sortEmployerResults(results, "xyz");
    // Poor Match: text=0.5*0.4=0.2, vol=1.0*0.2=0.2, quality≈1.0*0.1=0.1 → 0.5
    // Perfect Match: text=1.0*0.4=0.4, vol≈0*0.2=0, quality≈0.1*0.1=0.01 → 0.41
    expect(sorted[0].employer_name).toBe("Poor Match");
  });
});

/* ------------------------------------------------------------------ */
/*  sortSocResults                                                     */
/* ------------------------------------------------------------------ */

describe("sortSocResults", () => {
  it("returns empty array for empty input", () => {
    expect(sortSocResults([], "test")).toEqual([]);
  });

  it("ranks high-demand role above low-demand with same text score", () => {
    const results = [
      fuseResult({ code: "15-1252", title: "Software Dev", n_filings: 100, median_salary: 100000 }, 0.1),
      fuseResult({ code: "15-1253", title: "Software QA", n_filings: 5000, median_salary: 100000 }, 0.1),
    ];
    const sorted = sortSocResults(results, "software");
    expect(sorted[0].code).toBe("15-1253"); // more filings
  });

  it("uses salary as tiebreaker", () => {
    const results = [
      fuseResult({ code: "A", title: "Role A", n_filings: 500, median_salary: 80000 }, 0.1),
      fuseResult({ code: "B", title: "Role B", n_filings: 500, median_salary: 150000 }, 0.1),
    ];
    const sorted = sortSocResults(results, "role");
    expect(sorted[0].code).toBe("B"); // higher salary
  });

  it("handles missing filings/salary gracefully", () => {
    const results = [
      fuseResult({ code: "X", title: "Unknown Role" }, 0.2),
      fuseResult({ code: "Y", title: "Known Role", n_filings: 100, median_salary: 90000 }, 0.2),
    ];
    const sorted = sortSocResults(results, "role");
    expect(sorted[0].code).toBe("Y");
  });

  it("does NOT produce alphabetical ordering", () => {
    const results = [
      fuseResult({ code: "A", title: "Alpha Role", n_filings: 10, median_salary: 50000 }, 0.3),
      fuseResult({ code: "Z", title: "Zulu Role", n_filings: 10000, median_salary: 200000 }, 0.05),
    ];
    const sorted = sortSocResults(results, "role");
    expect(sorted[0].title).toBe("Zulu Role"); // better text + demand + salary
  });
});

/* ------------------------------------------------------------------ */
/*  sortWageEmployerResults                                            */
/* ------------------------------------------------------------------ */

describe("sortWageEmployerResults", () => {
  it("returns empty array for empty input", () => {
    expect(sortWageEmployerResults([], "test")).toEqual([]);
  });

  it("ranks high-volume employer first with equal text scores", () => {
    const results = [
      fuseResult({ employer_name: "Small Co", total_filings: 10, latest_median_salary: 120000 }, 0.1),
      fuseResult({ employer_name: "Big Corp", total_filings: 50000, latest_median_salary: 120000 }, 0.1),
    ];
    const sorted = sortWageEmployerResults(results, "co");
    expect(sorted[0].employer_name).toBe("Big Corp");
  });

  it("uses salary as tiebreaker when volume is equal", () => {
    const results = [
      fuseResult({ employer_name: "Low Pay LLC", total_filings: 1000, latest_median_salary: 70000 }, 0.1),
      fuseResult({ employer_name: "High Pay LLC", total_filings: 1000, latest_median_salary: 200000 }, 0.1),
    ];
    const sorted = sortWageEmployerResults(results, "llc");
    expect(sorted[0].employer_name).toBe("High Pay LLC");
  });

  it("text relevance (45%) outweighs volume (40%) for moderate volume differences", () => {
    // With moderate (not extreme) volume differences, text relevance wins
    const results = [
      fuseResult({ employer_name: "Bad Text Match", total_filings: 300, latest_median_salary: 120000 }, 0.5),
      fuseResult({ employer_name: "Good Text Match", total_filings: 200, latest_median_salary: 100000 }, 0.0),
    ];
    const sorted = sortWageEmployerResults(results, "good");
    expect(sorted[0].employer_name).toBe("Good Text Match");
  });

  it("does NOT sort alphabetically", () => {
    const results = [
      fuseResult({ employer_name: "Amazon", total_filings: 50000, latest_median_salary: 180000 }, 0.1),
      fuseResult({ employer_name: "Babel Corp", total_filings: 5, latest_median_salary: 60000 }, 0.1),
    ];
    const sorted = sortWageEmployerResults(results, "a");
    // Amazon should be first (volume 50000 vs 5 dwarfs any other signal)
    expect(sorted[0].employer_name).toBe("Amazon");
  });
});

/* ------------------------------------------------------------------ */
/*  sortRagResults                                                     */
/* ------------------------------------------------------------------ */

describe("sortRagResults", () => {
  it("returns empty array for empty input", () => {
    expect(sortRagResults([])).toEqual([]);
  });

  it("ranks QA match above chunk match with same relevance", () => {
    const results = [
      { type: "chunk" as const, score: 0.1, topic: "general" },
      { type: "qa" as const, score: 0.1, topic: "general" },
    ];
    const sorted = sortRagResults(results);
    expect(sorted[0].type).toBe("qa");
  });

  it("applies topic match bonus when preferredTopic is set", () => {
    const results = [
      { type: "chunk" as const, score: 0.1, topic: "salary" },
      { type: "chunk" as const, score: 0.1, topic: "employer" },
    ];
    const sorted = sortRagResults(results, "employer");
    expect(sorted[0].topic).toBe("employer");
  });

  it("relevance outweighs topic bonus within same type", () => {
    const results = [
      { type: "chunk" as const, score: 0.5, topic: "employer" }, // matching topic but bad score
      { type: "chunk" as const, score: 0.01, topic: "salary" }, // wrong topic but great score
    ];
    const sorted = sortRagResults(results, "employer");
    // relevance weight (40%) × (1-0.01=0.99) vs topic bonus (10% × 0.5 = 0.05)
    expect(sorted[0].topic).toBe("salary");
  });

  it("QA type advantage (50% weight) beats chunk with better relevance", () => {
    // QA type score = 1.0 * 0.5 = 0.5 base
    // Chunk type score = 0.5 * 0.5 = 0.25 base
    // Even with perfect relevance on chunk, QA has 0.25 head start
    const results = [
      { type: "chunk" as const, score: 0.0, topic: "general" }, // perfect relevance (1.0 * 0.4 = 0.4)
      { type: "qa" as const, score: 0.3, topic: "general" },    // decent relevance (0.7 * 0.4 = 0.28)
    ];
    const sorted = sortRagResults(results);
    // QA: 1.0*0.5 + 0.7*0.4 = 0.78
    // Chunk: 0.5*0.5 + 1.0*0.4 = 0.65
    expect(sorted[0].type).toBe("qa");
  });

  it("handles results without score", () => {
    const results = [
      { type: "chunk" as const, topic: "general" },
      { type: "qa" as const, topic: "general" },
    ];
    const sorted = sortRagResults(results);
    expect(sorted[0].type).toBe("qa");
    expect(sorted).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/*  Cross-cutting: non-alphabetical guarantee                          */
/* ------------------------------------------------------------------ */

describe("non-alphabetical ordering guarantee", () => {
  it("sortEmployerResults does not produce A-Z employer_name ordering", () => {
    // Create employers in alphabetical order with varied signals
    const results = [
      fuseResult(employer("Apple Inc", 500, 70), 0.15),
      fuseResult(employer("Boeing Co", 1000, 85), 0.1),
      fuseResult(employer("Costco Wholesale", 200, 60), 0.2),
      fuseResult(employer("Dell Technologies", 3000, 90), 0.08),
      fuseResult(employer("Epic Systems", 800, 75), 0.12),
    ];
    const sorted = sortEmployerResults(results, "systems");
    const names = sorted.map((e) => e.employer_name);
    const alphabetical = [...names].sort();
    // Smart sort should NOT produce alphabetical order
    expect(names).not.toEqual(alphabetical);
  });

  it("sortSocResults does not produce A-Z title ordering", () => {
    const results = [
      fuseResult({ code: "1", title: "Accountant", n_filings: 200, median_salary: 70000 }, 0.2),
      fuseResult({ code: "2", title: "Baker", n_filings: 50, median_salary: 40000 }, 0.3),
      fuseResult({ code: "3", title: "Chef", n_filings: 10000, median_salary: 55000 }, 0.05),
      fuseResult({ code: "4", title: "Doctor", n_filings: 8000, median_salary: 250000 }, 0.08),
    ];
    const sorted = sortSocResults(results, "profession");
    const titles = sorted.map((r) => r.title);
    const alphabetical = [...titles].sort();
    expect(titles).not.toEqual(alphabetical);
  });
});
