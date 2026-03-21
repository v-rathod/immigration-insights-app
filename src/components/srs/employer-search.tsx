/**
 * EmployerSearch — Fuzzy search autocomplete for employer lookup.
 *
 * Uses Fuse.js to search across 70K+ employer names with debounced input.
 * Renders a glassmorphic dropdown with highlighted matches.
 */
"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Fuse from "fuse.js";
import { Search, X, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { sortEmployerResults } from "@/lib/search/smart-sort";
import type { SponsorReliabilityScore } from "@/types/p2-artifacts";
import { srsTierColor, srsTierBg } from "@/lib/utils/format";

interface EmployerSearchProps {
  employers: SponsorReliabilityScore[];
  onSelect: (employer: SponsorReliabilityScore) => void;
  selectedId?: string;
  placeholder?: string;
  className?: string;
  /** When true, hides case count and SRS tier from results (used in Insights). */
  compact?: boolean;
  /** Pre-populate search box with employer name (e.g., from URL parameter) */
  initialValue?: string;
}

const MAX_RESULTS = 12;
const DEBOUNCE_MS = 150;

export function EmployerSearch({
  employers,
  onSelect,
  selectedId,
  placeholder = "Search 70,000+ employers…",
  className,
  compact = false,
  initialValue,
}: EmployerSearchProps) {
  const [query, setQuery] = useState(initialValue ?? "");
  const [results, setResults] = useState<SponsorReliabilityScore[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Build Fuse index (memoized — only recomputes if employers array changes)
  const fuse = useMemo(
    () =>
      new Fuse(employers, {
        keys: ["employer_name"],
        threshold: 0.3,
        distance: 100,
        minMatchCharLength: 2,
        includeScore: true,
        shouldSort: true,
      }),
    [employers]
  );

  // Debounced search
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setActiveIndex(-1);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.trim().length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      debounceRef.current = setTimeout(() => {
        // Search with Fuse (keep scores for sorting)
        const hits = fuse.search(value, { limit: MAX_RESULTS * 2 }); // Get more, then trim after sort
        
        // Apply smart sorting that combines text relevance + volume + quality
        const sorted = sortEmployerResults(hits, value).slice(0, MAX_RESULTS);

        // Compute dropdown position before setIsOpen so both land in the same render batch.
        // Use inputRef (the <input> element) for exact bottom-of-field coordinate.
        if (sorted.length > 0 && compact && inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
          // Re-measure after paint to catch any position change from ongoing animations
          requestAnimationFrame(() => {
            if (inputRef.current) {
              const r = inputRef.current.getBoundingClientRect();
              setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
            }
          });
        }

        setResults(sorted);
        setIsOpen(sorted.length > 0);
      }, DEBOUNCE_MS);
    },
    [fuse]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && results[activeIndex]) {
            onSelect(results[activeIndex]);
            setQuery(results[activeIndex].employer_name);
            setIsOpen(false);
          }
          break;
        case "Escape":
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, activeIndex, results, onSelect]
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("li");
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }, []);

  // Track dropdown position for fixed positioning (compact mode escapes overflow-hidden)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // SSR guard — portals require document.body (not available on server)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  /** Compute and set dropdown position from the input element (viewport-relative for fixed). */
  const updateDropdownPos = useCallback(() => {
    if (compact && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, [compact]);

  // Keep dropdown position in sync with scroll / resize (without rerender spam)
  useEffect(() => {
    if (!compact) return;
    const onScroll = () => { if (isOpen) updateDropdownPos(); };
    const onResize = () => { if (isOpen) updateDropdownPos(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [compact, isOpen, updateDropdownPos]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
          strokeWidth={1.5}
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="employer-search-results"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `employer-option-${activeIndex}` : undefined
          }
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              updateDropdownPos();
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 pl-10 pr-10",
            "text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
            "backdrop-blur-xl transition-all duration-200",
            "focus:border-[var(--accent-blue)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/20",
            "hover:border-white/[0.15]"
          )}
        />
        {query && (
          <button
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown — non-compact: absolute inline; compact: portal into body to escape
           any ancestor CSS transform (Framer Motion FadeIn sets transform: translateY(0) which
           hijacks position:fixed without a portal). */}
      {isOpen && !compact && (
        <ul
          ref={listRef}
          id="employer-search-results"
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-full z-50 mt-2 max-h-[400px] overflow-y-auto",
            "rounded-xl border border-white/[0.08] bg-[var(--background)]/95 backdrop-blur-2xl",
            "shadow-2xl shadow-black/20",
            "py-1"
          )}
        >
          {results.map((employer, i) => {
            const isSelected = employer.employer_id === selectedId;
            return (
              <li
                key={`${employer.employer_id}-${employer.scope}`}
                id={`employer-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => {
                  onSelect(employer);
                  setQuery(employer.employer_name);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
                  i === activeIndex
                    ? "bg-[var(--accent-blue)]/10"
                    : "hover:bg-white/[0.03]",
                  isSelected && "bg-[var(--accent-blue)]/5"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    employer.srs_tier !== "Unrated"
                      ? srsTierBg(employer.srs_tier)
                      : "bg-zinc-500/10"
                  )}
                >
                  <Building2
                    className={cn(
                      "h-4 w-4",
                      employer.srs_tier !== "Unrated"
                        ? srsTierColor(employer.srs_tier)
                        : "text-zinc-400"
                    )}
                    strokeWidth={1.5}
                  />
                </div>

                {/* Name + meta */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--foreground)]">
                    {employer.employer_name}
                  </div>
                  {!compact && (
                    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span>{(employer.n_36m ?? 0).toLocaleString()} cases</span>
                      {employer.srs != null && !isNaN(employer.srs) && (
                        <>
                          <span className="text-white/10">•</span>
                          <span className={srsTierColor(employer.srs_tier)}>
                            {employer.srs_tier} ({employer.srs})
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Compact mode dropdown — portalled into document.body so position:fixed reads the
           actual viewport, not the nearest CSS-transform ancestor (Framer Motion FadeIn). */}
      {isOpen && compact && mounted && dropdownPos &&
        createPortal(
          <ul
            ref={listRef}
            id="employer-search-results"
            role="listbox"
            className={cn(
              "fixed z-[9999] max-h-[360px] overflow-y-auto",
              "rounded-xl border border-white/[0.08] bg-[var(--background)]/95 backdrop-blur-2xl",
              "shadow-2xl shadow-black/20",
              "py-1"
            )}
            style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          >
            {results.map((employer, i) => {
              const isSelected = employer.employer_id === selectedId;
              return (
                <li
                  key={`${employer.employer_id}-${employer.scope}`}
                  id={`employer-option-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => {
                    onSelect(employer);
                    setQuery(employer.employer_name);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
                    i === activeIndex
                      ? "bg-[var(--accent-blue)]/10"
                      : "hover:bg-white/[0.03]",
                    isSelected && "bg-[var(--accent-blue)]/5"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      employer.srs_tier !== "Unrated"
                        ? srsTierBg(employer.srs_tier)
                        : "bg-zinc-500/10"
                    )}
                  >
                    <Building2
                      className={cn(
                        "h-4 w-4",
                        employer.srs_tier !== "Unrated"
                          ? srsTierColor(employer.srs_tier)
                          : "text-zinc-400"
                      )}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">
                      {employer.employer_name}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </div>
  );
}
