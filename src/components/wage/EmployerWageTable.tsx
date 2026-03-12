/**
 * EmployerWageTable — Ranked employer salary table with premium indicators.
 *
 * Sortable by median salary, wage premium %, or prevailing wage compliance.
 * Rows are clickable to expand an employer's multi-year salary sparkline.
 */
"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, TrendingUp, TrendingDown, Award, AlertTriangle, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import type { EmployerWageRanking, EmployerSalaryTrend } from "@/lib/data/wage";
import { WAGE_SANITY } from "@/lib/data/wage";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from "recharts";

type SortKey = "rank" | "median" | "premium" | "pw_ratio";

interface EmployerWageTableProps {
  rankings: EmployerWageRanking[];
  trends: EmployerSalaryTrend[];
  socCode: string;
  visaType: "H-1B" | "PERM";
  className?: string;
}

function SparklineTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { year: number } }> }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-black/80 px-2 py-1 text-xs">
      <span className="text-[var(--muted-foreground)]">FY{payload[0].payload.year}: </span>
      <span className="font-mono text-white">{formatCurrency(payload[0].value)}</span>
    </div>
  );
}

function MiniSparkline({ employerName, trends, visaType }: { employerName: string; trends: EmployerSalaryTrend[]; visaType: string }) {
  const data = useMemo(() =>
    trends
      .filter((t) => t.employer_name === employerName && t.visa_type === visaType)
      .sort((a, b) => a.fiscal_year - b.fiscal_year)
      // Exclude years with implausible salary values before computing trend
      .filter((t) => t.median_salary >= WAGE_SANITY.SALARY_FLOOR && t.median_salary <= WAGE_SANITY.SALARY_CEILING)
      .map((t) => ({ year: t.fiscal_year, salary: t.median_salary })),
    [employerName, trends, visaType]
  );

  if (data.length < 2) return <span className="text-xs text-[var(--muted-foreground)]">No history</span>;

  const first = data[0].salary;
  const last = data[data.length - 1].salary;
  const growth = first > 0 ? ((last - first) / first) * 100 : 0;
  const isUp = growth >= 0;

  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Tooltip content={<SparklineTooltip />} />
            <Line
              type="monotone"
              dataKey="salary"
              stroke={isUp ? "#10b981" : "#f43f5e"}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <span className={cn("text-xs font-mono font-semibold", isUp ? "text-emerald-400" : "text-rose-400")}>
        {isUp ? "+" : ""}{growth.toFixed(1)}%
      </span>
    </div>
  );
}

function SortHeader({
  label,
  sortK,
  className: hcn,
  currentSortKey,
  onSort,
}: {
  label: string;
  sortK: SortKey;
  className?: string;
  currentSortKey: SortKey;
  onSort: (k: SortKey) => void;
}) {
  return (
    <button
      onClick={() => onSort(sortK)}
      className={cn(
        "flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] hover:text-white transition-colors",
        currentSortKey === sortK && "text-blue-400",
        hcn
      )}
    >
      {label}
      <ArrowUpDown className={cn("h-3 w-3", currentSortKey === sortK && "text-blue-400")} />
    </button>
  );
}

export function EmployerWageTable({
  rankings,
  trends,
  socCode,
  visaType,
  className,
}: EmployerWageTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("median");
  const [sortDesc, setSortDesc] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const filtered = rankings.filter(
      (r) =>
        r.soc_code === socCode &&
        r.visa_type === visaType &&
        // Only show employers with enough cases to have a reliable median
        r.n_filings >= WAGE_SANITY.MIN_FILINGS_RANKING &&
        r.median_salary >= WAGE_SANITY.SALARY_FLOOR
    );
    return [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortKey === "rank" || sortKey === "median") diff = a.median_salary - b.median_salary;
      else if (sortKey === "premium") diff = a.wage_premium_pct - b.wage_premium_pct;
      else if (sortKey === "pw_ratio") diff = a.wage_vs_pw_pct - b.wage_vs_pw_pct;
      return sortDesc ? -diff : diff;
    });
  }, [rankings, socCode, visaType, sortKey, sortDesc]);

  if (rows.length === 0) {
    return (
      <div className={cn("flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8", className)}>
        <p className="text-sm text-[var(--muted-foreground)]">No employer data for this occupation</p>
      </div>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else { setSortKey(key); setSortDesc(true); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={cn("w-full", className)}
    >
      {/* Header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 px-4 py-2 border-b border-white/[0.06]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Employer</span>
        <SortHeader label="Median" sortK="median" className="justify-end" currentSortKey={sortKey} onSort={handleSort} />
        <SortHeader label="Above Market" sortK="premium" className="justify-end" currentSortKey={sortKey} onSort={handleSort} />
        <SortHeader label="vs. Min. Req." sortK="pw_ratio" className="justify-end" currentSortKey={sortKey} onSort={handleSort} />
        <div className="w-6" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/[0.04]">
        {rows.map((row, i) => {
          const isExpanded = expanded === row.employer_name;
          const isPremium = row.wage_premium_pct > 15;
          const isBelowPW = row.wage_vs_pw_pct < 5;

          return (
            <div key={`${row.employer_name}-${i}`}>
              {/* Main row */}
              <button
                onClick={() => setExpanded(isExpanded ? null : row.employer_name)}
                className="w-full grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
              >
                {/* Rank + Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-[rgba(255,255,255,0.25)] w-5 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {i === 0 && <Award className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                  <span className="text-sm font-medium text-[var(--foreground)] truncate">
                    {row.employer_name}
                  </span>
                  {isPremium && (
                    <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 shrink-0">
                      +High Pay
                    </span>
                  )}
                  {isBelowPW && (
                    <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                  )}
                </div>

                {/* Median salary */}
                <div className="text-right">
                  <span className="text-sm font-mono font-semibold text-white">
                    {formatCurrency(row.median_salary)}
                  </span>
                </div>

                {/* Premium % */}
                <div className="text-right">
                  <span className={cn(
                    "text-sm font-mono",
                    row.wage_premium_pct > 10 ? "text-emerald-400" :
                    row.wage_premium_pct > 0 ? "text-blue-300" : "text-[var(--muted-foreground)]"
                  )}>
                    {row.wage_premium_pct > 0 ? "+" : ""}{row.wage_premium_pct.toFixed(1)}%
                  </span>
                </div>

                {/* PW compliance ratio */}
                <div className="text-right">
                  <span className={cn(
                    "text-sm font-mono",
                    row.wage_vs_pw_pct >= 10 ? "text-emerald-400" :
                    row.wage_vs_pw_pct >= 0 ? "text-blue-300" : "text-amber-400"
                  )}>
                    {row.wage_vs_pw_pct >= 0 ? "+" : ""}{row.wage_vs_pw_pct.toFixed(1)}%
                  </span>
                </div>

                {/* Expand chevron */}
                <ChevronDown className={cn(
                  "h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-200",
                  isExpanded && "rotate-180"
                )} />
              </button>

              {/* Expanded row */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-2 bg-white/[0.01]">
                      <div className="grid sm:grid-cols-2 gap-4">
                        {/* Salary trend sparkline */}
                        <div>
                          <p className="text-xs text-[var(--muted-foreground)] mb-2 uppercase tracking-wider">Salary Trend</p>
                          <MiniSparkline employerName={row.employer_name} trends={trends} visaType={visaType} />
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "25th pct", value: formatCurrency(row.p25_salary) },
                            { label: "75th pct", value: formatCurrency(row.p75_salary) },
                            { label: "Filings", value: formatNumber(row.n_filings) },
                            { label: "State", value: row.worksite_state_top ?? "—" },
                            { label: "Required Min.", value: formatCurrency(row.prevailing_wage_median) },
                            { label: "Market Median", value: formatCurrency(row.oews_national_median) },
                          ].map(({ label, value }) => (
                            <div key={label} className="rounded-lg bg-white/[0.02] px-2.5 py-1.5">
                              <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">{label}</p>
                              <p className="text-xs font-mono font-semibold text-[var(--foreground)]">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-xs text-[var(--muted-foreground)]">
          Showing {rows.length} employers · FY2025 · {visaType}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />+High Pay = &gt;15% above market
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />Near minimum required wage
          </span>
        </div>
      </div>
    </motion.div>
  );
}
