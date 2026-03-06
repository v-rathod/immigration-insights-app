/**
 * Ask — RAG-powered Q&A Search
 *
 * 3-tier answer architecture:
 *   Tier 1: Pre-computed QA cache (182 pairs, Fuse.js fuzzy match) — $0
 *   Tier 2: Chunk retrieval (100 chunks, keyword search) — $0
 *   Tier 3: LLM synthesis (mock locally, GPT-4o-mini in prod) — ~$0.0006/query
 *
 * Route: /ask
 */
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MessageSquare,
  BookOpen,
  Sparkles,
  Tag,
  ChevronRight,
  X,
  Loader2,
  FileText,
  ArrowRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/ui";
import { loadRagChunks, loadRagQaPairs } from "@/lib/data/loader";
import { RagSearchEngine, type SearchResult } from "@/lib/search/rag-search";
import { getLlmAnswer, detectLlmBackend, type LlmResponse, type LlmBackend } from "@/lib/search/llm-service";
import type { RagTopic } from "@/types/p2-artifacts";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EASE = [0.25, 0.1, 0.25, 1] as const;

const TOPIC_META: Record<
  RagTopic,
  { label: string; icon: string; color: string }
> = {
  pd_forecast: { label: "Priority Date Forecast", icon: "📅", color: "blue" },
  employer: { label: "Employer Insights", icon: "🏢", color: "purple" },
  salary: { label: "Salary & Wages", icon: "💰", color: "emerald" },
  visa_bulletin: { label: "Visa Bulletin", icon: "📋", color: "cyan" },
  geographic: { label: "Geographic Trends", icon: "🗺️", color: "amber" },
  occupation: { label: "Occupation Demand", icon: "💼", color: "rose" },
  processing: { label: "Processing Times", icon: "⏱️", color: "orange" },
  visa_demand: { label: "Visa Demand", icon: "📊", color: "pink" },
  filings: { label: "Filing Trends", icon: "📈", color: "teal" },
  general: { label: "General", icon: "ℹ️", color: "gray" },
};

const SUGGESTED_QUESTIONS = [
  "How does the priority date forecast model work?",
  "What is a Sponsor Reliability Score?",
  "Which EB category has the fastest movement?",
  "How are salary benchmarks calculated?",
  "What data sources does NorthStar use?",
  "How long is the EB2 India backlog?",
];

const TOPIC_COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  pink: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  teal: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  gray: "bg-white/5 text-[var(--muted-foreground)] border-white/10",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AskPage() {
  // Data state
  const [engine] = useState(() => new RagSearchEngine());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<RagTopic | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // LLM state
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmResponse, setLlmResponse] = useState<LlmResponse | null>(null);
  const [llmBackend, setLlmBackend] = useState<LlmBackend | null>(null);

  // Expanded result
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Topics
  const topics = useMemo(
    () => (ready ? engine.getTopics() : []),
    [ready, engine]
  );

  // Load data + detect LLM backend on mount
  useEffect(() => {
    Promise.all([loadRagChunks(), loadRagQaPairs()])
      .then(([chunks, qaPairs]) => {
        engine.initialize(chunks, qaPairs);
        setReady(true);
      })
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : "Failed to load knowledge base"
        )
      );
    detectLlmBackend().then(setLlmBackend);
  }, [engine]);

  // Search handler
  const doSearch = useCallback(
    (q: string, topic?: RagTopic | null) => {
      if (!engine.isReady) return;
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setHasSearched(false);
        setLlmResponse(null);
        return;
      }
      const r = engine.search(trimmed, {
        topic: topic ?? undefined,
        limit: 8,
      });
      setResults(r);
      setHasSearched(true);
      setLlmResponse(null);
      setExpandedIdx(null);
      analytics.ragQuestionAsked({
        topic: topic ?? "general",
        resultCount: r.length,
        usedLlm: false,
        llmBackend: undefined,
      });

      // Auto-trigger AI answer when search yields no results
      if (r.length === 0) {
        setLlmLoading(true);
        getLlmAnswer({ query: trimmed, context: [] })
          .then((resp) => setLlmResponse(resp))
          .finally(() => setLlmLoading(false));
      }
    },
    [engine]
  );

  // Debounced input handler
  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        doSearch(value, activeTopic);
      }, 200);
    },
    [doSearch, activeTopic]
  );

  // Topic filter handler
  const handleTopicClick = useCallback(
    (topic: RagTopic) => {
      const next = activeTopic === topic ? null : topic;
      setActiveTopic(next);
      if (query.trim().length >= 2) {
        doSearch(query, next);
      }
    },
    [activeTopic, query, doSearch]
  );

  // Suggested question click
  const handleSuggestion = useCallback(
    (q: string) => {
      setQuery(q);
      doSearch(q, activeTopic);
      inputRef.current?.focus();
    },
    [doSearch, activeTopic]
  );

  // LLM answer request — always callable, even with zero results
  const handleGetAiAnswer = useCallback(async () => {
    if (llmLoading || query.trim().length < 2) return;
    analytics.llmAnswerRequested(llmBackend ?? "unknown");
    setLlmLoading(true);
    try {
      const response = await getLlmAnswer({ query, context: results });
      setLlmResponse(response);
      analytics.ragQuestionAsked({
        topic: activeTopic ?? "general",
        resultCount: results.length,
        usedLlm: true,
        llmBackend: llmBackend ?? "mock",
      });
    } finally {
      setLlmLoading(false);
    }
  }, [query, results, llmLoading, activeTopic, llmBackend]);

  // Clear search
  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setLlmResponse(null);
    setExpandedIdx(null);
    inputRef.current?.focus();
  }, []);

  // Loading state
  if (!ready && !loadError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="h-8 w-8 rounded-full border-2 border-t-transparent border-[var(--accent-blue)]"
        />
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
          <p className="text-sm text-rose-400">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-400 shrink-0">
            <MessageSquare
              className="h-4.5 w-4.5 text-white"
              strokeWidth={2}
            />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
              Ask NorthStar
            </h1>
            <p className="text-xs text-[var(--muted-foreground)]">
              Search {topics.reduce((s, t) => s + t.count, 0)} knowledge chunks
              across {topics.length} topics •{" "}
              <span className="text-[var(--foreground)]/60">182 pre-computed Q&A pairs</span>
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Search Bar */}
      <FadeIn delay={0.05}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[var(--muted-foreground)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Ask about priority dates, employers, salaries, visa bulletins..."
            aria-label="Search the knowledge base"
            className={cn(
              "w-full rounded-2xl border bg-white/[0.03] backdrop-blur-xl",
              "pl-11 pr-10 py-3.5 text-sm text-[var(--foreground)]",
              "placeholder:text-[var(--muted-foreground)]/50",
              "focus:outline-none focus:ring-2 focus:ring-[var(--accent-purple)]/50 focus:border-[var(--accent-purple)]/30",
              "transition-all duration-200",
              query
                ? "border-[var(--accent-purple)]/30"
                : "border-white/[0.08]"
            )}
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </FadeIn>

      {/* Topic Filter Pills */}
      <FadeIn delay={0.08}>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => {
            const meta = TOPIC_META[t.topic];
            const isActive = activeTopic === t.topic;
            return (
              <button
                key={t.topic}
                onClick={() => handleTopicClick(t.topic)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all duration-200",
                  isActive
                    ? TOPIC_COLOR_MAP[meta.color]
                    : "bg-white/[0.03] text-[var(--muted-foreground)] border-white/[0.06] hover:bg-white/[0.06] hover:text-[var(--foreground)]"
                )}
              >
                <span className="text-[11px]">{meta.icon}</span>
                {meta.label}
                <span className="text-[10px] opacity-60">({t.count})</span>
              </button>
            );
          })}
        </div>
      </FadeIn>

      {/* Suggested Questions (shown before first search) */}
      {!hasSearched && (
        <FadeIn delay={0.12}>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Try asking
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  className="group flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left text-sm text-[var(--muted-foreground)] hover:bg-white/[0.05] hover:text-[var(--foreground)] hover:border-white/[0.12] transition-all duration-200"
                >
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--accent-purple)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="line-clamp-1">{q}</span>
                </button>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Search Results */}
      {hasSearched && (
        <div className="space-y-4">
          {/* Result count + AI button */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--muted-foreground)]">
              {results.length === 0
                ? "No results found"
                : `${results.length} result${results.length !== 1 ? "s" : ""} found`}
              {results.filter((r) => r.type === "qa").length > 0 && (
                <span className="ml-2 text-[var(--accent-purple)]">
                  • {results.filter((r) => r.type === "qa").length} exact match{results.filter((r) => r.type === "qa").length !== 1 ? "es" : ""}
                </span>
              )}
            </p>
            {!llmResponse && (
              <button
                onClick={handleGetAiAnswer}
                disabled={llmLoading}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/20",
                  "text-purple-300 hover:from-purple-500/30 hover:to-pink-500/30",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {llmLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {llmLoading ? "Generating..." : "Get AI Answer"}
              </button>
            )}
          </div>

          {/* LLM Response Card */}
          <AnimatePresence>
            {llmResponse && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5 p-5 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span className="text-xs font-semibold text-purple-300">
                    AI Answer
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--muted-foreground)]/60">
                    {llmResponse.isMock ? "Mock • Local" : llmResponse.model}
                  </span>
                </div>
                <div className="text-sm text-[var(--foreground)]/90 leading-relaxed whitespace-pre-line">
                  {llmResponse.answer}
                </div>
                {llmResponse.sources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-[var(--muted-foreground)]/60 uppercase tracking-wide">
                      Sources:
                    </span>
                    {llmResponse.sources.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-[var(--muted-foreground)]"
                      >
                        <FileText className="h-2.5 w-2.5" />
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result Cards */}
          <div className="space-y-2">
            {results.map((result, idx) => (
              <ResultCard
                key={`${result.type}-${idx}`}
                result={result}
                index={idx}
                isExpanded={expandedIdx === idx}
                onToggle={() =>
                  setExpandedIdx(expandedIdx === idx ? null : idx)
                }
              />
            ))}
          </div>

          {/* No results — show loading or nudge (AI answer auto-triggers) */}
          {results.length === 0 && !llmResponse && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] py-12 text-center">
              {llmLoading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="h-8 w-8 rounded-full border-2 border-t-transparent border-purple-500 mb-3"
                  />
                  <p className="text-sm text-purple-300">
                    Generating a response…
                  </p>
                </>
              ) : (
                <>
                  <Sparkles
                    className="h-10 w-10 text-white/10 mb-3"
                    strokeWidth={1}
                  />
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No exact matches. Try browsing a topic above
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* How It Works */}
      <FadeIn delay={hasSearched ? 0.05 : 0.18}>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4 text-xs text-[var(--muted-foreground)] space-y-2">
          <h3 className="font-semibold text-[var(--foreground)] text-sm mb-1.5">
            How It Works
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">
                  Exact Match
                </p>
                <p className="text-[var(--muted-foreground)]/70 mt-0.5">
                  182 pre-computed Q&A pairs are fuzzy-matched first. Instant, free.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-bold shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">
                  Context Retrieval
                </p>
                <p className="text-[var(--muted-foreground)]/70 mt-0.5">
                  100 knowledge chunks searched by topic + keywords. No cost.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 text-[10px] font-bold shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-[var(--foreground)]">
                  AI Synthesis
                </p>
                <p className="text-[var(--muted-foreground)]/70 mt-0.5">
                  LLM generates answers from retrieved context.
                  {llmBackend === "groq" && (
                    <span className="text-emerald-400"> Groq connected.</span>
                  )}
                  {llmBackend === "openai" && (
                    <span className="text-emerald-400"> OpenAI connected.</span>
                  )}
                  {llmBackend === "ollama" && (
                    <span className="text-emerald-400"> Ollama connected.</span>
                  )}
                  {llmBackend === "mock" && (
                    <span> Mock mode: add API key for real AI.</span>
                  )}
                  {!llmBackend && (
                    <span> Detecting…</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result Card Component
// ---------------------------------------------------------------------------

function ResultCard({
  result,
  index,
  isExpanded,
  onToggle,
}: {
  result: SearchResult;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const meta = TOPIC_META[result.topic];
  const scorePercent = Math.round(result.score * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04, ease: EASE }}
    >
      <button
        onClick={onToggle}
        className={cn(
          "w-full text-left rounded-xl border p-4 transition-all duration-200",
          "hover:bg-white/[0.03]",
          isExpanded
            ? "border-white/[0.12] bg-white/[0.03]"
            : "border-white/[0.06] bg-white/[0.01]"
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {/* Type badge */}
            <div
              className={cn(
                "flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-semibold uppercase tracking-wide shrink-0 mt-0.5",
                result.type === "qa"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-blue-500/10 text-blue-400"
              )}
            >
              {result.type === "qa" ? (
                <BookOpen className="h-3 w-3" />
              ) : (
                <FileText className="h-3 w-3" />
              )}
              {result.type === "qa" ? "Q&A" : "Chunk"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--foreground)] line-clamp-1">
                {result.title}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-2">
                {result.content.slice(0, 150)}
                {result.content.length > 150 ? "..." : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                TOPIC_COLOR_MAP[meta.color]
              )}
            >
              {meta.icon} {meta.label}
            </span>
            <span className="text-[10px] font-mono text-[var(--muted-foreground)]/60">
              {scorePercent}%
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-200",
                isExpanded && "rotate-90"
              )}
            />
          </div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                <div className="text-xs text-[var(--foreground)]/80 leading-relaxed whitespace-pre-line max-h-[300px] overflow-y-auto">
                  {result.content}
                </div>
                {result.sources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Tag className="h-3 w-3 text-[var(--muted-foreground)]/50" />
                    {result.sources.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-[var(--muted-foreground)]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}
