"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Fuse from "fuse.js";
import Link from "next/link";
import { Search, ArrowRight, Building2, X } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { cn } from "@/lib/utils";
import { srsTierColor, srsTierBg } from "@/lib/utils/format";
import { loadEmployerSearch, type EmployerSearchEntry } from "@/lib/data/employer-shard";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_RESULTS = 5;
const DEBOUNCE_MS = 150;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmployerQuickCheck() {
  const [entries, setEntries] = useState<EmployerSearchEntry[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmployerSearchEntry[]>([]);
  const [selected, setSelected] = useState<EmployerSearchEntry | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadEmployerSearch()
      .then((data) => {
        if (!cancelled) {
          setEntries(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        keys: ["employer_name"],
        threshold: 0.3,
        distance: 100,
        minMatchCharLength: 2,
        includeScore: true,
      }),
    [entries]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setSelected(null);
      setActiveIndex(-1);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim().length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      debounceRef.current = setTimeout(() => {
        const hits = fuse.search(value, { limit: MAX_RESULTS });
        const items = hits.map((h) => h.item);
        setResults(items);
        setIsOpen(items.length > 0);
      }, DEBOUNCE_MS);
    },
    [fuse]
  );

  const handleSelect = useCallback((entry: EmployerSearchEntry) => {
    setSelected(entry);
    setQuery(entry.employer_name);
    setIsOpen(false);
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setSelected(null);
    inputRef.current?.focus();
  }, []);

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
            handleSelect(results[activeIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          break;
      }
    },
    [isOpen, activeIndex, results, handleSelect]
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

  return (
    <GlassCard padding="md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-blue-400" strokeWidth={2} />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Employer Check
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="eq-results"
          aria-label="Search employer by name"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={loading ? "Loading employers…" : "Type an employer name"}
          disabled={loading}
          className={cn(
            "w-full rounded-lg border border-[var(--border)] bg-[var(--background)]/50 py-2 pl-9 pr-8",
            "text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
            "transition-all duration-200 focus:border-blue-500/40 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
          )}
        />
        {query && (
          <button
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Dropdown */}
        {isOpen && (
          <ul
            ref={listRef}
            id="eq-results"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-xl shadow-lg py-1"
          >
            {results.map((r, i) => (
              <li
                key={r.employer_id}
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => handleSelect(r)}
                className={cn(
                  "flex cursor-pointer items-center justify-between px-3 py-2 text-xs transition-colors",
                  i === activeIndex ? "bg-blue-500/10" : "hover:bg-[var(--muted)]/50"
                )}
              >
                <span className="truncate font-medium text-[var(--foreground)]">
                  {r.employer_name}
                </span>
                {r.srs_score != null && (
                  <span className={cn("ml-2 shrink-0 text-[10px] font-semibold", srsTierColor(r.srs_tier))}>
                    {r.srs_tier} ({r.srs_score})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Selected Employer Result */}
      {selected && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--border)]/50 bg-[var(--muted)]/20 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-[var(--foreground)]">
              {selected.employer_name}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
              <span>{selected.total_filings.toLocaleString()} filings</span>
              {selected.srs_score != null && (
                <>
                  <span className="text-[var(--border)]">|</span>
                  <span className={cn("font-semibold", srsTierColor(selected.srs_tier))}>
                    SRS {selected.srs_score} {selected.srs_tier}
                  </span>
                </>
              )}
              {selected.latest_median_salary > 0 && (
                <>
                  <span className="text-[var(--border)]">|</span>
                  <span>${(selected.latest_median_salary / 1000).toFixed(0)}K median</span>
                </>
              )}
            </div>
          </div>
          <Link
            href={`/dashboard/employer?q=${encodeURIComponent(selected.employer_name)}`}
            className="ml-3 shrink-0 rounded-md bg-blue-500/10 px-2.5 py-1.5 text-[10px] font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
          >
            Full Report <ArrowRight className="ml-1 inline h-3 w-3" />
          </Link>
        </div>
      )}
    </GlassCard>
  );
}
