/**
 * RawFilingsTable — Per-case LCA filing records + annual H-1B petition history
 * for a specific employer.
 *
 * Tabs:
 *   1. LCA Filings   — per-case DOL disclosure, FY2022-2025
 *   2. Petition History — annual USCIS H-1B aggregate outcomes, FY2010-2023
 *
 * Features:
 *   - Sortable columns (click header)
 *   - Filters: job title search, city search, year selector, status pills
 *   - Pagination (25 rows / page)
 *   - Status colour badges
 *   - Lazy-loaded on first expand
 */
"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  X,
  FileText,
  Building2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import type { LcaFiling, H1bPetitionYear, LcaAnnualCount } from "@/lib/data/wage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortDir = "asc" | "desc" | null;

interface SortState {
  col: string;
  dir: SortDir;
}

interface RawFilingsTableProps {
  lcaFilings: LcaFiling[];
  h1bPetitions: H1bPetitionYear[];
  employerName: string;
  /** Total LCA rows in the 5-year window before the 5,000-row display cap */
  lcaTotal?: number;
  /** [minFY, maxFY] fiscal year range in the shard */
  lcaFyRange?: [number, number];
  /** Annual LCA filing counts for the last 10 fiscal years (FY desc) */
  lcaAnnual?: LcaAnnualCount[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100;

const STATUS_COLORS: Record<string, string> = {
  CERTIFIED:
    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  "CERTIFIED-EXPIRED":
    "bg-emerald-500/10 text-emerald-500/80 border border-emerald-500/20",
  "CERTIFIED-WITHDRAWN":
    "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  WITHDRAWN:
    "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  DENIED:
    "bg-rose-500/15 text-rose-400 border border-rose-500/25",
};

function statusBadge(status: string) {
  const cls =
    STATUS_COLORS[status?.toUpperCase()] ??
    "bg-[var(--foreground)]/10 text-[var(--muted-foreground)] border border-[var(--foreground)]/15";
  const label =
    status === "CERTIFIED-WITHDRAWN"
      ? "WITHDRAWN"
      : status === "CERTIFIED-EXPIRED"
      ? "CERTIFIED"
      : status;
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap",
        cls
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

function useSortToggle(initial: SortState) {
  const [sort, setSort] = useState<SortState>(initial);
  const toggle = useCallback((col: string) => {
    setSort((prev) => {
      if (prev.col !== col) return { col, dir: "desc" };
      if (prev.dir === "desc") return { col, dir: "asc" };
      return { col, dir: null };
    });
  }, []);
  return { sort, toggle };
}

function SortIcon({ col, sort }: { col: string; sort: SortState }) {
  if (sort.col !== col || sort.dir === null)
    return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
  return sort.dir === "asc" ? (
    <ChevronUp className="h-3 w-3 text-blue-400" />
  ) : (
    <ChevronDown className="h-3 w-3 text-blue-400" />
  );
}

function TH({
  col,
  children,
  className,
  sort,
  onToggle,
  onResetPage,
}: {
  col: string;
  children: React.ReactNode;
  className?: string;
  sort: SortState;
  onToggle: (col: string) => void;
  onResetPage: () => void;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-[var(--foreground)]/80 transition-colors",
        className
      )}
      onClick={() => {
        onToggle(col);
        onResetPage();
      }}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <SortIcon col={col} sort={sort} />
      </span>
    </th>
  );
}

// ---------------------------------------------------------------------------
// LCA Filings Tab
// ---------------------------------------------------------------------------

function LcaFilingsTab({
  filings,
  lcaTotal,
  lcaFyRange,
}: {
  filings: LcaFiling[];
  lcaTotal?: number;
  lcaFyRange?: [number, number];
}) {
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const { sort, toggle } = useSortToggle({ col: "received_date", dir: "desc" });

  // Available years
  const years = useMemo(() => {
    const ys = Array.from(new Set(filings.map((r) => r.fiscal_year)))
      .filter(Boolean)
      .sort((a, b) => b - a);
    return ys;
  }, [filings]);

  // Statuses
  const statuses = useMemo(() => {
    const ss = Array.from(new Set(filings.map((r) => r.case_status)))
      .filter(Boolean)
      .sort();
    return ss;
  }, [filings]);

  // Filtered
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return filings.filter((r) => {
      if (selectedYear !== "all" && r.fiscal_year !== selectedYear) return false;
      if (selectedStatus !== "all" && r.case_status !== selectedStatus) return false;
      if (q) {
        const target = `${r.job_title} ${r.worksite_city} ${r.worksite_state} ${r.soc_title}`.toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [filings, search, selectedYear, selectedStatus]);

  // Sorted
  const sorted = useMemo(() => {
    if (!sort.dir) return filtered;
    return [...filtered].sort((a, b) => {
      const key = sort.col as keyof LcaFiling;
      const av = a[key] ?? "";
      const bv = b[key] ?? "";
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const resetPage = () => setPage(0);

  const clearFilters = () => {
    setSearch("");
    setSelectedYear("all");
    setSelectedStatus("all");
    resetPage();
  };

  const hasActiveFilters =
    search !== "" || selectedYear !== "all" || selectedStatus !== "all";

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="Search job title or city…"
            className="w-full rounded-lg bg-[var(--foreground)]/[0.05] border border-[var(--foreground)]/[0.08] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/70 pl-9 pr-3 py-2 focus:outline-none focus:border-blue-500/50 focus:bg-[var(--foreground)]/[0.07] transition-all"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                resetPage();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]/70 hover:text-[var(--foreground)]/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Year selector */}
        <select
          value={selectedYear}
          onChange={(e) => {
            setSelectedYear(e.target.value === "all" ? "all" : Number(e.target.value));
            resetPage();
          }}
          className="rounded-lg bg-[var(--foreground)]/[0.05] border border-[var(--foreground)]/[0.08] text-sm text-[var(--foreground)] px-3 py-2 focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
        >
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              FY{y}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            resetPage();
          }}
          className="rounded-lg bg-[var(--foreground)]/[0.05] border border-[var(--foreground)]/[0.08] text-sm text-[var(--foreground)] px-3 py-2 focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
        >
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "CERTIFIED-WITHDRAWN" ? "Withdrawn" : s === "CERTIFIED-EXPIRED" ? "Certified-Exp." : s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--foreground)]/[0.08] text-xs text-[var(--muted-foreground)] px-3 py-2 hover:text-[var(--foreground)]/80 hover:border-[var(--foreground)]/20 transition-all"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}

        {/* Count / metadata */}
        <div className="ml-auto flex flex-col items-end gap-0.5">
          <span className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
            {filtered.length.toLocaleString()} of {filings.length.toLocaleString()} shown
          </span>
          {(lcaTotal !== undefined || lcaFyRange) && (
            <span className="text-[10px] text-[var(--muted-foreground)]/60 whitespace-nowrap">
              {lcaFyRange ? `FY${lcaFyRange[0]}–FY${lcaFyRange[1]} · ` : ""}
              {lcaTotal !== undefined && lcaTotal > filings.length
                ? `${lcaTotal.toLocaleString()} total`
                : "last 36 months"}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--foreground)]/[0.07]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--foreground)]/[0.06] bg-[var(--foreground)]/[0.02]">
              <TH col="job_title" sort={sort} onToggle={toggle} onResetPage={resetPage}>Job Title</TH>
              <TH col="soc_title" className="hidden lg:table-cell" sort={sort} onToggle={toggle} onResetPage={resetPage}>Occupation</TH>
              <TH col="worksite_city" sort={sort} onToggle={toggle} onResetPage={resetPage}>Location</TH>
              <TH col="wage_annual" sort={sort} onToggle={toggle} onResetPage={resetPage}>Base Salary</TH>
              <TH col="case_status" sort={sort} onToggle={toggle} onResetPage={resetPage}>Status</TH>
              <TH col="received_date" sort={sort} onToggle={toggle} onResetPage={resetPage}>Filed</TH>
              <TH col="decision_date" className="hidden xl:table-cell" sort={sort} onToggle={toggle} onResetPage={resetPage}>Decision</TH>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide whitespace-nowrap hidden xl:table-cell">
                FT
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]/70"
                >
                  No filings match your filters
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr
                  key={row.case_number || i}
                  className="border-b border-[var(--foreground)]/[0.04] hover:bg-[var(--foreground)]/[0.025] transition-colors"
                >
                  {/* Job Title */}
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <span className="font-medium text-[var(--foreground)] line-clamp-1 block">
                      {row.job_title || "-"}
                    </span>
                    {row.case_number && (
                      <span className="text-[10px] text-[var(--muted-foreground)]/60 font-mono">
                        {row.case_number}
                      </span>
                    )}
                  </td>

                  {/* Occupation */}
                  <td className="px-3 py-2.5 hidden lg:table-cell">
                    <span className="text-[var(--foreground)]/70 text-xs line-clamp-1">
                      {row.soc_title || "-"}
                    </span>
                  </td>

                  {/* Location */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-[var(--foreground)]/75 text-xs">
                      {[row.worksite_city, row.worksite_state]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </span>
                  </td>

                  {/* Salary */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="font-medium text-[var(--foreground)] tabular-nums">
                      {row.wage_annual > 0
                        ? formatCurrency(row.wage_annual)
                        : "-"}
                    </span>
                    {row.wage_annual_high && row.wage_annual_high > row.wage_annual && (
                      <span className="text-[10px] text-[var(--muted-foreground)]/80 block">
                        to {formatCurrency(row.wage_annual_high)}
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {statusBadge(row.case_status || "")}
                  </td>

                  {/* Filed */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-[var(--foreground)]/70 text-xs tabular-nums">
                      {row.received_date
                        ? new Date(row.received_date + "T00:00:00Z").toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" }
                          )
                        : "-"}
                    </span>
                  </td>

                  {/* Decision */}
                  <td className="px-3 py-2.5 whitespace-nowrap hidden xl:table-cell">
                    <span className="text-[var(--muted-foreground)] text-xs tabular-nums">
                      {row.decision_date && row.decision_date !== row.received_date
                        ? new Date(row.decision_date + "T00:00:00Z").toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" }
                          )
                        : "-"}
                    </span>
                  </td>

                  {/* Full-time */}
                  <td className="px-3 py-2.5 hidden xl:table-cell text-center">
                    <span
                      className={cn(
                        "text-[10px] font-semibold",
                        row.is_fulltime ? "text-emerald-400" : "text-[var(--muted-foreground)]"
                      )}
                    >
                      {row.is_fulltime ? "FT" : "PT"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-xs text-[var(--muted-foreground)]">
            Page {page + 1} of {totalPages} ({sorted.length.toLocaleString()} results)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg border border-[var(--foreground)]/[0.08] text-[var(--muted-foreground)] hover:text-[var(--foreground)]/80 hover:border-[var(--foreground)]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* Page numbers around current */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const p = start + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-medium border transition-all",
                    p === page
                      ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                      : "border-[var(--foreground)]/[0.08] text-[var(--muted-foreground)] hover:text-[var(--foreground)]/70 hover:border-[var(--foreground)]/20"
                  )}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded-lg border border-[var(--foreground)]/[0.08] text-[var(--muted-foreground)] hover:text-[var(--foreground)]/80 hover:border-[var(--foreground)]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// H-1B Petition History Tab — Combined LCA (DOL) + USCIS petition view
// ---------------------------------------------------------------------------

function PetitionHistoryTab({
  petitions,
  lcaAnnual,
}: {
  petitions: H1bPetitionYear[];
  lcaAnnual?: LcaAnnualCount[];
}) {
  // Build a unified year→data map spanning both sources
  const rows = useMemo(() => {
    const yearMap = new Map<
      number,
      { lca_count?: number; uscis?: H1bPetitionYear }
    >();

    // Populate LCA annual counts
    (lcaAnnual ?? []).forEach((r) => {
      yearMap.set(r.fiscal_year, { lca_count: r.count });
    });

    // Merge USCIS petition data
    petitions.forEach((p) => {
      const existing = yearMap.get(p.fiscal_year) ?? {};
      yearMap.set(p.fiscal_year, { ...existing, uscis: p });
    });

    // Sort descending
    return Array.from(yearMap.entries())
      .sort(([a], [b]) => b - a)
      .map(([fy, v]) => ({ fiscal_year: fy, ...v }));
  }, [petitions, lcaAnnual]);

  const hasLca = rows.some((r) => r.lca_count != null);
  const hasUscis = rows.some((r) => r.uscis != null);

  if (!hasLca && !hasUscis) {
    return (
      <div className="py-12 text-center text-sm text-[var(--muted-foreground)]/70">
        <Building2 className="h-8 w-8 mx-auto mb-3 opacity-20" />
        <p>No petition history available</p>
        <p className="text-xs mt-1 text-[var(--muted-foreground)]/50">
          USCIS discontinued per-employer H-1B data releases after FY2023
        </p>
      </div>
    );
  }

  // Totals
  const totalLca = rows.reduce((s, r) => s + (r.lca_count ?? 0), 0);
  const totalUscis = rows.reduce((s, r) => s + (r.uscis?.total_petitions ?? 0), 0);
  const totalUscisApp = rows.reduce(
    (s, r) => s + (r.uscis ? r.uscis.initial_approvals + r.uscis.continuing_approvals : 0),
    0
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Explainer banner */}
      <div className="rounded-xl border border-amber-500/[0.18] bg-amber-500/[0.06] px-4 py-3 flex gap-3 items-start">
        <span className="text-amber-400 text-base shrink-0 mt-0.5">ⓘ</span>
        <div className="text-xs text-[var(--muted-foreground)]/90 space-y-1">
          <p>
            <span className="text-[var(--foreground)]/70 font-semibold">LCA Filings (DOL)</span>
            {" "}Department of Labor Labor Condition Applications: one per worker per job, role, or location change.
            Full 10-year history.
          </p>
          <p>
            <span className="text-[var(--foreground)]/70 font-semibold">USCIS Petitions</span>
            {" "}Actual H-1B petitions adjudicated. Discontinued by USCIS after FY2023. Only a subset of LCA filings result in a USCIS petition action.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--foreground)]/[0.07]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--foreground)]/[0.06] bg-[var(--foreground)]/[0.02]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                Year
              </th>
              {hasLca && (
                <th className="px-4 py-3 text-right text-xs font-medium text-blue-400/80 uppercase tracking-wide">
                  LCA Filings
                  <span className="block text-[9px] text-[var(--muted-foreground)]/60 normal-case font-normal">DOL · all changes</span>
                </th>
              )}
              {hasUscis && (
                <>
                  <th className="px-4 py-3 text-right text-xs font-medium text-purple-400/80 uppercase tracking-wide hidden md:table-cell">
                    Initial App.
                    <span className="block text-[9px] text-[var(--muted-foreground)]/60 normal-case font-normal">USCIS new H-1B</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-purple-400/80 uppercase tracking-wide hidden md:table-cell">
                    Cont. App.
                    <span className="block text-[9px] text-[var(--muted-foreground)]/60 normal-case font-normal">USCIS extensions</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-purple-400/80 uppercase tracking-wide">
                    USCIS Total
                    <span className="block text-[9px] text-[var(--muted-foreground)]/60 normal-case font-normal">petitions adj.</span>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                    Approval %
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const approvalPct = row.uscis ? row.uscis.approval_rate * 100 : null;
              const isRecentNoUscis = row.fiscal_year >= 2024 && !row.uscis;
              return (
                <tr
                  key={row.fiscal_year}
                  className="border-b border-[var(--foreground)]/[0.04] hover:bg-[var(--foreground)]/[0.025] transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]/80">
                    FY{row.fiscal_year}
                  </td>
                  {hasLca && (
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-400/90">
                      {row.lca_count != null ? row.lca_count.toLocaleString() : "—"}
                    </td>
                  )}
                  {hasUscis && (
                    <>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-400/80 hidden md:table-cell">
                        {row.uscis ? row.uscis.initial_approvals.toLocaleString() : (isRecentNoUscis ? <span className="text-[var(--muted-foreground)]/40 text-xs">discontinued</span> : "—")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-400/50 hidden md:table-cell">
                        {row.uscis ? row.uscis.continuing_approvals.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-purple-400/80 font-medium">
                        {row.uscis
                          ? row.uscis.total_petitions.toLocaleString()
                          : isRecentNoUscis
                          ? <span className="text-[var(--muted-foreground)]/40 text-xs italic">n/a</span>
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {approvalPct != null ? (
                          <span
                            className={cn(
                              "text-xs font-semibold tabular-nums",
                              approvalPct >= 95
                                ? "text-emerald-400"
                                : approvalPct >= 80
                                ? "text-amber-400"
                                : "text-rose-400"
                            )}
                          >
                            {approvalPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[var(--muted-foreground)]/30 text-xs">—</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr className="border-t border-[var(--foreground)]/[0.08] bg-[var(--foreground)]/[0.02]">
                <td className="px-4 py-2.5 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                  All years
                </td>
                {hasLca && (
                  <td className="px-4 py-2.5 text-right tabular-nums text-sm font-semibold text-blue-400/80">
                    {totalLca.toLocaleString()}
                  </td>
                )}
                {hasUscis && (
                  <>
                    <td colSpan={2} className="hidden md:table-cell" />
                    <td className="px-4 py-2.5 text-right tabular-nums text-sm font-semibold text-purple-400/70">
                      {totalUscis.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-semibold text-[var(--muted-foreground)]">
                      {totalUscis > 0 ? ((totalUscisApp / totalUscis) * 100).toFixed(1) + "%" : "—"}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-[11px] text-[var(--muted-foreground)]/60">
        USCIS H-1B employer data hub was discontinued after FY2023. FY2024+ shows LCA filings only.{" "}
        LCA counts are typically higher than USCIS petitions because a single USCIS petition can cover multiple LCA filings (role/location/salary amendments).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

type Tab = "lca" | "petitions";

export function RawFilingsTable({
  lcaFilings,
  h1bPetitions,
  lcaAnnual,
  employerName,
  lcaTotal,
  lcaFyRange,
}: RawFilingsTableProps) {
  const [activeTab, setActiveTab] = useState<Tab>("lca");

  const tabs: { id: Tab; label: string; count: number }[] = [
    {
      id: "lca",
      label: "LCA Filings",
      count: lcaFilings.length,
    },
    {
      id: "petitions",
      label: "Petition History",
      // Show the max years covered between LCA annual summary and USCIS petitions
      count: Math.max((lcaAnnual ?? []).length, h1bPetitions.length),
    },
  ];

  return (
    <div className="rounded-2xl border border-[var(--foreground)]/[0.07] bg-[var(--foreground)]/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-0 gap-4 border-b border-[var(--foreground)]/[0.05]">
        <div className="flex items-center gap-2.5">
          <FileText className="h-4 w-4 text-blue-400/70" />
          <h3 className="text-sm font-semibold text-[var(--foreground)]/80">Filing Records: Last 36 Months</h3>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-3.5 py-2.5 text-xs font-medium rounded-none transition-all border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-blue-500 text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]/65"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    activeTab === tab.id
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-[var(--foreground)]/[0.07] text-[var(--muted-foreground)]/80"
                  )}
                >
                  {tab.count > 5000
                    ? "5000+"
                    : tab.id === "petitions"
                    ? `${tab.count}yr`
                    : tab.count.toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "lca" ? (
              <LcaFilingsTab filings={lcaFilings} lcaTotal={lcaTotal} lcaFyRange={lcaFyRange} />
            ) : (
              <PetitionHistoryTab petitions={h1bPetitions} lcaAnnual={lcaAnnual} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
