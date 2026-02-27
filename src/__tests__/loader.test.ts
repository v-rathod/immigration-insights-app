import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally for loader tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mock setup
import {
  loadDashboardData,
  loadDimension,
  loadModelData,
  loadModelJson,
  loadRagChunks,
  loadRagQaPairs,
  loadRagCatalog,
  loadManifest,
} from "@/lib/data/loader";

describe("Data Loaders", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Helper: mock successful JSON response
  // Uses text() since the loader now reads raw text to sanitize NaN
  // ─────────────────────────────────────────────────────────────────────

  function mockSuccessResponse<T>(data: T) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(data)),
    });
  }

  function mockErrorResponse(status: number) {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // NaN sanitization
  // ═══════════════════════════════════════════════════════════════════

  describe("NaN sanitization", () => {
    it("replaces NaN with null in response text", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve('[{"value":NaN,"name":"test"},{"value":42}]'),
      });
      const result = await loadDashboardData<{ value: number | null; name?: string }>(
        "test",
        "data"
      );
      expect(result).toEqual([
        { value: null, name: "test" },
        { value: 42 },
      ]);
    });

    it("replaces Infinity and -Infinity with null", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve('[{"a":Infinity,"b":-Infinity}]'),
      });
      const result = await loadDashboardData<{ a: number | null; b: number | null }>(
        "test",
        "data"
      );
      expect(result).toEqual([{ a: null, b: null }]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Dashboard data
  // ═══════════════════════════════════════════════════════════════════

  describe("loadDashboardData", () => {
    it("fetches correct URL", async () => {
      mockSuccessResponse([{ id: 1 }]);
      await loadDashboardData("employer", "employer_friendliness_scores");
      expect(mockFetch).toHaveBeenCalledWith(
        "/data/dashboards/employer/employer_friendliness_scores.json"
      );
    });

    it("returns parsed data", async () => {
      const mockData = [{ score: 0.85 }];
      mockSuccessResponse(mockData);
      const result = await loadDashboardData("employer", "employer_friendliness_scores");
      expect(result).toEqual(mockData);
    });

    it("throws on HTTP error", async () => {
      mockErrorResponse(404);
      await expect(
        loadDashboardData("nonexistent", "data")
      ).rejects.toThrow("Failed to load data");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Dimensions
  // ═══════════════════════════════════════════════════════════════════

  describe("loadDimension", () => {
    it("fetches dimension file", async () => {
      mockSuccessResponse([{ soc_code: "15-1252" }]);
      await loadDimension("dim_soc");
      expect(mockFetch).toHaveBeenCalledWith("/data/dims/dim_soc.json");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Models
  // ═══════════════════════════════════════════════════════════════════

  describe("loadModelData", () => {
    it("fetches model data", async () => {
      mockSuccessResponse([{ category: "EB2" }]);
      const result = await loadModelData("pd_forecasts");
      expect(result).toEqual([{ category: "EB2" }]);
    });
  });

  describe("loadModelJson", () => {
    it("fetches model config", async () => {
      const config = { version: "2.1", method: "anchored_blend" };
      mockSuccessResponse(config);
      const result = await loadModelJson("pd_forecast_model");
      expect(result).toEqual(config);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RAG
  // ═══════════════════════════════════════════════════════════════════

  describe("loadRagChunks", () => {
    it("fetches RAG chunks", async () => {
      const chunks = [{ id: "1", topic: "employer", content: "test" }];
      mockSuccessResponse(chunks);
      const result = await loadRagChunks();
      expect(result).toEqual(chunks);
    });
  });

  describe("loadRagQaPairs", () => {
    it("fetches QA pairs", async () => {
      const qa = { pairs: [{ question: "Q?", answer: "A." }] };
      mockSuccessResponse(qa);
      const result = await loadRagQaPairs();
      expect(result).toEqual(qa);
    });
  });

  describe("loadRagCatalog", () => {
    it("fetches catalog", async () => {
      mockSuccessResponse([{ name: "fact_perm", rows: 1000 }]);
      const result = await loadRagCatalog();
      expect(result).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Manifest
  // ═══════════════════════════════════════════════════════════════════

  describe("loadManifest", () => {
    it("fetches manifest", async () => {
      const manifest = {
        synced_at: "2026-02-26T04:07:03.003096+00:00",
        p2_root: "/path/to/p2",
        files: {},
      };
      mockSuccessResponse(manifest);
      const result = await loadManifest();
      expect(result.synced_at).toBe("2026-02-26T04:07:03.003096+00:00");
    });
  });
});
