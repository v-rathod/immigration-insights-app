/**
 * Tests for RAG Search Engine and LLM Service.
 *
 * Covers:
 *   - RagSearchEngine: initialize, search, topic filtering, getTopics, getByTopic
 *   - LLM Service: getLlmAnswer, isLlmEnabled, mockLlmAnswer
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RagSearchEngine, type SearchResult } from "@/lib/search/rag-search";
import { getLlmAnswer, isLlmEnabled, detectLlmBackend } from "@/lib/search/llm-service";
import type { RagChunk, RagQaPair } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_CHUNKS: RagChunk[] = [
  {
    chunk_id: "c1",
    source_artifact: "pd_forecasts",
    topic: "pd_forecast",
    label: "Priority Date Forecast Model",
    text: "The priority date forecast model uses ARIMA time-series analysis to predict future cutoff date movements for each EB category and country.",
    metadata: {},
    generated_at: "2025-01-01",
  },
  {
    chunk_id: "c2",
    source_artifact: "salary_benchmarks",
    topic: "salary",
    label: "Salary Benchmarks Overview",
    text: "Salary benchmarks are computed from OEWS (Occupational Employment and Wage Statistics) data published by the Bureau of Labor Statistics.",
    metadata: {},
    generated_at: "2025-01-01",
  },
  {
    chunk_id: "c3",
    source_artifact: "employer_friendliness_scores",
    topic: "employer",
    label: "Sponsor Reliability Score Methodology",
    text: "The Sponsor Reliability Score (SRS) evaluates employers based on approval rates, denial rates, withdrawal patterns, and wage competitiveness across PERM and LCA filings.",
    metadata: {},
    generated_at: "2025-01-01",
  },
  {
    chunk_id: "c4",
    source_artifact: "worksite_geo_metrics",
    topic: "geographic",
    label: "Geographic Distribution of H-1B Worksites",
    text: "Geographic analysis shows California, Texas, and New York as the top three states for H-1B worksite locations.",
    metadata: {},
    generated_at: "2025-01-01",
  },
  {
    chunk_id: "c5",
    source_artifact: "pd_forecasts",
    topic: "pd_forecast",
    label: "EB2 India Backlog Depth",
    text: "The EB2 India category currently has an estimated backlog of over 10 years, with approximately 300,000 pending applicants.",
    metadata: {},
    generated_at: "2025-01-01",
  },
];

const MOCK_QA_PAIRS: RagQaPair[] = [
  {
    question: "How does the priority date forecast model work?",
    answer: "The priority date forecast model uses ARIMA time-series analysis on historical visa bulletin data to predict future cutoff date movements for each EB category and country of chargeability.",
    sources: ["pd_forecasts", "fact_cutoff_trends"],
    topic: "pd_forecast",
    confidence: "high",
    generated_at: "2025-01-01",
  },
  {
    question: "What is a Sponsor Reliability Score?",
    answer: "The Sponsor Reliability Score (SRS) is a composite metric that evaluates employer immigration friendliness based on approval rates, processing patterns, wage competitiveness, and historical compliance data.",
    sources: ["employer_friendliness_scores"],
    topic: "employer",
    confidence: "high",
    generated_at: "2025-01-01",
  },
  {
    question: "How are salary benchmarks calculated?",
    answer: "Salary benchmarks are derived from BLS OEWS data, comparing offered wages against prevailing wages at the SOC-area level, with percentile distributions (P10, P25, P50, P75, P90).",
    sources: ["salary_benchmarks", "fact_oews"],
    topic: "salary",
    confidence: "high",
    generated_at: "2025-01-01",
  },
];

// ---------------------------------------------------------------------------
// RagSearchEngine
// ---------------------------------------------------------------------------

describe("RagSearchEngine", () => {
  let engine: RagSearchEngine;

  beforeEach(async () => {
    engine = new RagSearchEngine();
    await engine.initialize(MOCK_CHUNKS, MOCK_QA_PAIRS);
  });

  // ── Initialization ──

  it("initializes and reports ready", () => {
    expect(engine.isReady).toBe(true);
  });

  it("is not ready before initialization", () => {
    const fresh = new RagSearchEngine();
    expect(fresh.isReady).toBe(false);
  });

  it("returns empty results when not initialized", () => {
    const fresh = new RagSearchEngine();
    expect(fresh.search("priority date")).toEqual([]);
  });

  // ── Search ──

  it("finds QA pairs by question text", () => {
    const results = engine.search("priority date forecast");
    expect(results.length).toBeGreaterThan(0);
    const qa = results.find((r) => r.type === "qa");
    expect(qa).toBeDefined();
    expect(qa!.title).toContain("priority date forecast");
  });

  it("finds chunks by label/text", () => {
    const results = engine.search("salary benchmarks OEWS");
    expect(results.length).toBeGreaterThan(0);
    const hasChunk = results.some((r) => r.type === "chunk");
    expect(hasChunk).toBe(true);
  });

  it("returns results sorted with QA first", () => {
    const results = engine.search("priority date");
    const qaIdx = results.findIndex((r) => r.type === "qa");
    const chunkIdx = results.findIndex((r) => r.type === "chunk");
    if (qaIdx >= 0 && chunkIdx >= 0) {
      expect(qaIdx).toBeLessThan(chunkIdx);
    }
  });

  it("limits results count", () => {
    const results = engine.search("immigration", { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("returns score between 0 and 1", () => {
    const results = engine.search("sponsor reliability score");
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it("returns proper SearchResult shape", () => {
    const results = engine.search("salary");
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(r).toHaveProperty("type");
    expect(r).toHaveProperty("score");
    expect(r).toHaveProperty("topic");
    expect(r).toHaveProperty("title");
    expect(r).toHaveProperty("content");
    expect(r).toHaveProperty("sources");
    expect(["qa", "chunk"]).toContain(r.type);
  });

  it("returns empty for gibberish query", () => {
    const results = engine.search("xyzpdq99");
    expect(results.length).toBe(0);
  });

  // ── Topic filtering ──

  it("filters results by topic", () => {
    const results = engine.search("score", { topic: "employer" });
    for (const r of results) {
      expect(r.topic).toBe("employer");
    }
  });

  it("returns empty when topic has no match", () => {
    const results = engine.search("priority date", { topic: "geographic" });
    // geographic topic doesn't mention priority dates
    expect(results.every((r) => r.topic === "geographic")).toBe(true);
  });

  // ── getTopics ──

  it("returns available topics with counts", () => {
    const topics = engine.getTopics();
    expect(topics.length).toBeGreaterThan(0);
    for (const t of topics) {
      expect(t).toHaveProperty("topic");
      expect(t).toHaveProperty("count");
      expect(t).toHaveProperty("label");
      expect(t.count).toBeGreaterThan(0);
    }
  });

  it("counts chunks per topic correctly", () => {
    const topics = engine.getTopics();
    const pdForecast = topics.find((t) => t.topic === "pd_forecast");
    expect(pdForecast?.count).toBe(2); // c1 and c5
    const salary = topics.find((t) => t.topic === "salary");
    expect(salary?.count).toBe(1);
  });

  it("sorts topics by count descending", () => {
    const topics = engine.getTopics();
    for (let i = 1; i < topics.length; i++) {
      expect(topics[i - 1].count).toBeGreaterThanOrEqual(topics[i].count);
    }
  });

  // ── getByTopic ──

  it("returns all chunks for a given topic", () => {
    const pdChunks = engine.getByTopic("pd_forecast");
    expect(pdChunks.length).toBe(2);
    expect(pdChunks.every((c) => c.topic === "pd_forecast")).toBe(true);
  });

  it("returns empty for topic with no chunks", () => {
    const result = engine.getByTopic("processing");
    expect(result.length).toBe(0);
  });

  // ── Source mapping ──

  it("maps QA sources correctly", () => {
    const results = engine.search("priority date forecast model");
    const qa = results.find((r) => r.type === "qa");
    expect(qa?.sources).toEqual(["pd_forecasts", "fact_cutoff_trends"]);
  });

  it("maps chunk source_artifact correctly", () => {
    const results = engine.search("geographic distribution H-1B");
    const chunk = results.find((r) => r.type === "chunk" && r.topic === "geographic");
    expect(chunk?.sources).toEqual(["worksite_geo_metrics"]);
  });
});

// ---------------------------------------------------------------------------
// LLM Service
// ---------------------------------------------------------------------------

describe("LLM Service", () => {
  beforeEach(() => {
    // Prevent Ollama network calls — simulate unavailable
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in tests"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects mock backend when Ollama is unavailable", async () => {
    const backend = await detectLlmBackend();
    expect(backend).toBe("mock");
    expect(isLlmEnabled()).toBe(false);
  });

  it("returns a natural off-topic response for empty context", async () => {
    const response = await getLlmAnswer({ query: "what is the weather today", context: [] });
    expect(response.isMock).toBe(true);
    expect(response.model).toBe("mock-local");
    expect(response.sources).toEqual([]);
    // Should mention immigration-related topics, not a hardcoded message
    expect(response.answer).toMatch(/immigration/i);
  });

  it("uses QA match for mock answer when available", async () => {
    const qaResult: SearchResult = {
      type: "qa",
      score: 0.9,
      topic: "pd_forecast",
      title: "How does the forecast work?",
      content: "The forecast model uses ARIMA.",
      sources: ["pd_forecasts"],
    };

    const response = await getLlmAnswer({
      query: "how does forecast work",
      context: [qaResult],
    });

    expect(response.isMock).toBe(true);
    expect(response.answer).toBe("The forecast model uses ARIMA.");
    expect(response.sources).toEqual(["pd_forecasts"]);
  });

  it("stitches chunk summaries for mock answer when no QA match", async () => {
    const chunkResults: SearchResult[] = [
      {
        type: "chunk",
        score: 0.8,
        topic: "salary",
        title: "Salary Data",
        content: "Salaries are based on BLS data. The median wage varies by occupation.",
        sources: ["salary_benchmarks"],
      },
      {
        type: "chunk",
        score: 0.7,
        topic: "salary",
        title: "Wage Analysis",
        content: "Wage competitiveness is measured at the SOC level. Percentiles range from P10 to P90.",
        sources: ["fact_oews"],
      },
    ];

    const response = await getLlmAnswer({
      query: "salary data",
      context: chunkResults,
    });

    expect(response.isMock).toBe(true);
    expect(response.model).toBe("mock-local");
    expect(response.answer).toContain("salary data");
    expect(response.sources.length).toBeGreaterThan(0);
  });

  it("skips low-score QA matches and uses chunks instead", async () => {
    const mixedResults: SearchResult[] = [
      {
        type: "qa",
        score: 0.3, // Below 0.6 threshold
        topic: "general",
        title: "Low confidence QA",
        content: "Some weak answer",
        sources: ["general"],
      },
      {
        type: "chunk",
        score: 0.8,
        topic: "employer",
        title: "Employer Data",
        content: "Employer data chunk. First sentence here. Second sentence follows.",
        sources: ["employer_scores"],
      },
    ];

    const response = await getLlmAnswer({
      query: "employer info",
      context: mixedResults,
    });

    expect(response.isMock).toBe(true);
    // Should NOT use the low-score QA answer
    expect(response.answer).not.toBe("Some weak answer");
  });

  it("deduplicates sources in stitched answer", async () => {
    const chunkResults: SearchResult[] = [
      {
        type: "chunk",
        score: 0.8,
        topic: "salary",
        title: "Chunk A",
        content: "Content A.",
        sources: ["salary_benchmarks"],
      },
      {
        type: "chunk",
        score: 0.7,
        topic: "salary",
        title: "Chunk B",
        content: "Content B.",
        sources: ["salary_benchmarks"], // Same source
      },
    ];

    const response = await getLlmAnswer({
      query: "salary",
      context: chunkResults,
    });

    // Sources should be deduplicated
    const unique = [...new Set(response.sources)];
    expect(response.sources.length).toBe(unique.length);
  });
});
