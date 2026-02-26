/**
 * Client-side RAG search using Fuse.js.
 *
 * Searches across 98 text chunks + 178 pre-computed Q&A pairs.
 * No server needed — everything runs in the browser.
 */

import Fuse, { type IFuseOptions } from "fuse.js";
import type { RagChunk, RagQaPair, RagTopic } from "@/types/p2-artifacts";

// ---------------------------------------------------------------------------
// Search configuration
// ---------------------------------------------------------------------------

const CHUNK_FUSE_OPTIONS: IFuseOptions<RagChunk> = {
  keys: [
    { name: "title", weight: 0.4 },
    { name: "content", weight: 0.5 },
    { name: "topic", weight: 0.1 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 3,
};

const QA_FUSE_OPTIONS: IFuseOptions<RagQaPair> = {
  keys: [
    { name: "question", weight: 0.6 },
    { name: "answer", weight: 0.3 },
    { name: "topic", weight: 0.1 },
  ],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 3,
};

// ---------------------------------------------------------------------------
// Search result types
// ---------------------------------------------------------------------------

export interface SearchResult {
  type: "qa" | "chunk";
  score: number;
  topic: RagTopic;
  title: string;
  content: string;
  sources: string[];
}

// ---------------------------------------------------------------------------
// RAG Search Engine
// ---------------------------------------------------------------------------

export class RagSearchEngine {
  private chunkIndex: Fuse<RagChunk> | null = null;
  private qaIndex: Fuse<RagQaPair> | null = null;
  private chunks: RagChunk[] = [];
  private qaPairs: RagQaPair[] = [];

  async initialize(chunks: RagChunk[], qaPairs: RagQaPair[]) {
    this.chunks = chunks;
    this.qaPairs = qaPairs;
    this.chunkIndex = new Fuse(chunks, CHUNK_FUSE_OPTIONS);
    this.qaIndex = new Fuse(qaPairs, QA_FUSE_OPTIONS);
  }

  get isReady(): boolean {
    return this.chunkIndex !== null && this.qaIndex !== null;
  }

  /**
   * Search across Q&A pairs and chunks.
   * Q&A matches are prioritized (they have pre-computed answers).
   */
  search(query: string, options?: { topic?: RagTopic; limit?: number }): SearchResult[] {
    if (!this.chunkIndex || !this.qaIndex) return [];

    const limit = options?.limit ?? 10;
    const results: SearchResult[] = [];

    // 1. Search Q&A pairs first (pre-computed answers are gold)
    const qaResults = this.qaIndex.search(query, { limit: 5 });
    for (const r of qaResults) {
      if (options?.topic && r.item.topic !== options.topic) continue;
      results.push({
        type: "qa",
        score: 1 - (r.score ?? 0),
        topic: r.item.topic as RagTopic,
        title: r.item.question,
        content: r.item.answer,
        sources: r.item.source_artifacts,
      });
    }

    // 2. Search chunks for additional context
    const chunkResults = this.chunkIndex.search(query, { limit: limit * 2 });
    for (const r of chunkResults) {
      if (options?.topic && r.item.topic !== options.topic) continue;
      results.push({
        type: "chunk",
        score: 1 - (r.score ?? 0),
        topic: r.item.topic as RagTopic,
        title: r.item.title,
        content: r.item.content,
        sources: r.item.source_artifacts,
      });
    }

    // Sort by score (highest first), QA pairs first at same score
    results.sort((a, b) => {
      if (a.type !== b.type) return a.type === "qa" ? -1 : 1;
      return b.score - a.score;
    });

    return results.slice(0, limit);
  }

  /**
   * Get all chunks for a specific topic.
   */
  getByTopic(topic: RagTopic): RagChunk[] {
    return this.chunks.filter((c) => c.topic === topic);
  }

  /**
   * Get all available topics with chunk counts.
   */
  getTopics(): { topic: RagTopic; count: number; label: string }[] {
    const topicLabels: Record<RagTopic, string> = {
      pd_forecast: "Priority Date Forecast",
      employer: "Employer Insights",
      salary: "Salary & Wages",
      visa_bulletin: "Visa Bulletin",
      geographic: "Geographic Trends",
      occupation: "Occupation Demand",
      processing: "Processing Times",
      visa_demand: "Visa Demand",
      filings: "Filing Trends",
      general: "General",
    };

    const counts = new Map<RagTopic, number>();
    for (const chunk of this.chunks) {
      const topic = chunk.topic as RagTopic;
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([topic, count]) => ({
        topic,
        count,
        label: topicLabels[topic] ?? topic,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
