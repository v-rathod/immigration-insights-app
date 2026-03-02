/**
 * Smart Sorting for Search Results
 *
 * Applies composite scoring to prioritize results by relevance, significance,
 * and data quality signals beyond simple text matching.
 */

import type { SponsorReliabilityScore } from "@/types/p2-artifacts";

/**
 * Result from Fuse.js search with attached metadata for re-sorting
 */
interface FuseResultWithScore<T> {
  item: T;
  refIndex: number;
  score?: number;
}

/**
 * Normalize a value to [0, 1] range
 */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Check if query is a prefix or exact match of the name (case-insensitive)
 */
function getNameMatchBonus(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  if (n === q) return 1.0; // Exact match = huge bonus
  if (n.startsWith(q)) return 0.7; // Prefix match = strong bonus
  if (n.includes(` ${q}`) || n.includes(`-${q}`)) return 0.5; // Word boundary = moderate bonus
  return 0;
}

/**
 * Smart sort for employer search results.
 *
 * Combines:
 * - Text relevance (Fuse score, inverted)
 * - Volume significance (n_36m normalized across cohort)
 * - Quality signal (SRS score normalized)
 * - Name match pattern (exact/prefix/word match)
 *
 * Weights:
 * - Text relevance: 40% (most important for UX)
 * - Name pattern match: 30% (exact match likely most relevant)
 * - Volume: 20% (popular employers more useful)
 * - Quality: 10% (SRS score as tiebreaker)
 */
export function sortEmployerResults(
  results: FuseResultWithScore<SponsorReliabilityScore>[],
  query: string
): SponsorReliabilityScore[] {
  if (results.length === 0) return [];

  // Find normalization bounds from current result set
  const cases = results.map((r) => r.item.n_36m);
  const maxCases = Math.max(...cases, 1);
  const scores = results
    .map((r) => r.item.srs)
    .filter((s) => s != null && !isNaN(s)) as number[];
  const maxScore = scores.length > 0 ? Math.max(...scores, 1) : 1;

  // Compute composite rank for each result
  const scored = results.map((result) => {
    // Text match score (Fuse score is 0 for perfect match, 1 for worst; invert it)
    const textRelevance = 1 - (result.score ?? 0.5);

    // Name pattern match bonus (0–1)
    const nameBonus = getNameMatchBonus(query, result.item.employer_name);

    // Volume normalization (0–1, higher = more cases)
    const volumeScore = normalize(result.item.n_36m, 0, maxCases);

    // Quality score normalization (0–1, higher = better SRS)
    const qualityScore = result.item.srs != null && !isNaN(result.item.srs)
      ? normalize(result.item.srs, 0, Math.max(maxScore, 100))
      : 0;

    // Composite score with weights
    const composite =
      textRelevance * 0.4 +
      nameBonus * 0.3 +
      volumeScore * 0.2 +
      qualityScore * 0.1;

    return {
      item: result.item,
      composite,
    };
  });

  // Sort by composite score (descending) and return items
  return scored
    .sort((a, b) => b.composite - a.composite)
    .map((s) => s.item);
}

/**
 * Smart sort for wage search results (job categories/roles).
 *
 * Combines:
 * - Text relevance (Fuse score)
 * - Demand/volume (number of filings for the job category)
 * - Salary level (median salary as significance signal)
 *
 * Weights:
 * - Text relevance: 50%
 * - Demand: 35%
 * - Salary level: 15%
 */
export function sortSocResults(
  results: FuseResultWithScore<{
    code: string;
    title: string;
    n_filings?: number;
    median_salary?: number;
  }>[],
  query: string
): Array<{
  code: string;
  title: string;
  n_filings?: number;
  median_salary?: number;
}> {
  if (results.length === 0) return [];

  // Find normalization bounds
  const filings = results
    .map((r) => r.item.n_filings ?? 0)
    .filter((f) => f > 0);
  const maxFilings = Math.max(...filings, 1);

  const salaries = results
    .map((r) => r.item.median_salary ?? 0)
    .filter((s) => s > 0);
  const maxSalary = Math.max(...salaries, 1);

  // Compute composite rank
  const scored = results.map((result) => {
    // Text relevance
    const textRelevance = 1 - (result.score ?? 0.5);

    // Demand score
    const demandScore = normalize(result.item.n_filings ?? 0, 0, maxFilings);

    // Salary significance (higher salary = more competitive role = more interesting)
    const salaryScore = normalize(
      result.item.median_salary ?? 0,
      0,
      maxSalary
    );

    // Composite
    const composite =
      textRelevance * 0.5 +
      demandScore * 0.35 +
      salaryScore * 0.15;

    return {
      item: result.item,
      composite,
    };
  });

  return scored
    .sort((a, b) => b.composite - a.composite)
    .map((s) => s.item);
}

/**
 * Smart sort for RAG search results.
 *
 * Prioritizes:
 * - Exact QA matches over chunk matches (higher inherent value)
 * - Within category, sort by relevance score
 * - Topics matching user intent (if available)
 *
 * Weights:
 * - Match type (QA vs chunk): 50%
 * - Relevance score: 40%
 * - Topic match: 10%
 */
export function sortRagResults(
  results: Array<{
    type: "qa" | "chunk";
    score?: number;
    topic?: string;
  }>,
  preferredTopic?: string
): Array<{
  type: "qa" | "chunk";
  score?: number;
  topic?: string;
}> {
  if (results.length === 0) return [];

  const scored = results.map((result) => {
    // Type priority: QA matches are inherently more valuable
    const typeScore = result.type === "qa" ? 1.0 : 0.5;

    // Relevance (invert Fuse score if present)
    const relevanceScore = result.score != null ? 1 - result.score : 0.5;

    // Topic match bonus
    const topicBonus =
      preferredTopic && result.topic === preferredTopic ? 0.5 : 0;

    // Composite
    const composite =
      typeScore * 0.5 +
      relevanceScore * 0.4 +
      topicBonus * 0.1;

    return {
      item: result,
      composite,
    };
  });

  return scored
    .sort((a, b) => b.composite - a.composite)
    .map((s) => s.item);
}
