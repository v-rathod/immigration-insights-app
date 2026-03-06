/**
 * EmployerProfile — Deep-dive card shown when a user selects an employer.
 *
 * Sections:
 *   1. Growth badges (CAGR 5yr, latest YoY, filing count, consecutive raises)
 *   2. Salary trend chart — 2016→2025 median with YoY% tooltip
 *   3. Top roles at this employer — searchable, with drill-down to 5-year percentile chart
 */
"use client";

import { useState, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Building2,
  Briefcase,
  Minus,
  Search,
  X,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCompact } from "@/lib/utils/format";
import { GlassCard } from "@/components/ui/glass-card";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { RolePercentileTrend } from "@/components/wage/RolePercentileTrend";
import {
  computeEmployerGrowth,
  getEmployerTrend,
  getEmployerRoles,
  getEmployerRoleTrendSeries,
  annotateWithYoy,
  loadEmployerFilings,
  WAGE_SANITY,
  type EmployerSalaryTrend,
  type EmployerWageRanking,
  type EmployerRoleTrend as EmployerRoleTrendType,
  type LcaFiling,
  type H1bPetitionYear,
} from "@/lib/data/wage";
import { RawFilingsTable } from "@/components/wage/RawFilingsTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployerProfileProps {
  employerName: string;
  trend: EmployerSalaryTrend[];
  rankings: EmployerWageRanking[];
  /** Employer-centric role profiles (top 500 employers × top-25 roles by filings).
   * When provided, these replace `rankings` for the "Top Roles" section.
   * Falls back to `rankings` if omitted (backwards-compatible). */
  roleProfiles?: EmployerWageRanking[];
  /** Multi-year percentile data for role drill-down charts. */
  roleTrends?: EmployerRoleTrendType[];
  visaType?: "H-1B" | "PERM";
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function SalaryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { yoy_pct?: number | null } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const salary = payload[0]?.value;
  const yoy = payload[0]?.payload?.yoy_pct;
  return (
    <div className="bg-[var(--card)] border border-white/[0.12] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-[var(--muted-foreground)] mb-1">FY {label}</p>
      <p className="font-mono font-bold text-white">{formatCurrency(salary)}</p>
      {yoy != null && (
        <p className={cn("mt-0.5 font-semibold", yoy >= 0 ? "text-emerald-400" : "text-rose-400")}>
          {yoy >= 0 ? "+" : ""}
          {yoy}% YoY
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Growth badge component
// ---------------------------------------------------------------------------

function GrowthBadge({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", color)} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          {label}
        </span>
      </div>
      <span className={cn("text-base font-bold font-mono", color)}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EmployerProfile({
  employerName,
  trend,
  rankings,
  roleProfiles,
  roleTrends,
  visaType = "H-1B",
}: EmployerProfileProps) {
  // ── Role search + selection state ─────────────────────────────────────────
  const [roleQuery, setRoleQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<{ soc_code: string; soc_title: string } | null>(null);

  // ── Collapsed section state (both off by default) ─────────────────────────
  const [topRolesOpen, setTopRolesOpen] = useState(false);
  const [filingsOpen, setFilingsOpen] = useState(false);

  // ── Filing Records: deferred load — only triggered on first open ──────────
  const [lcaFilings, setLcaFilings] = useState<LcaFiling[]>([]);
  const [h1bPetitions, setH1bPetitions] = useState<H1bPetitionYear[]>([]);
  const [lcaTotal, setLcaTotal] = useState<number>(0);
  const [lcaFyRange, setLcaFyRange] = useState<[number, number] | null>(null);
  const [filingsLoading, setFilingsLoading] = useState(false);
  const [filingsLoaded, setFilingsLoaded] = useState(false);

  // Derive employer_id from the trend data (included by sync script)
  const employerId = useMemo(() => {
    const row = trend.find((r) => r.employer_name === employerName && r.employer_id);
    return row?.employer_id ? String(row.employer_id) : null;
  }, [trend, employerName]);

  // Triggered only when user first opens the Filing Records panel
  const triggerLoadFilings = useCallback(() => {
    if (filingsLoaded || filingsLoading || !employerId) return;
    setFilingsLoading(true);
    loadEmployerFilings(employerId)
      .then((data) => {
        if (data) {
          setLcaFilings(data.lca || []);
          setH1bPetitions(data.h1b_petitions || []);
          setLcaTotal(data.lca_total ?? (data.lca?.length ?? 0));
          setLcaFyRange(data.lca_fy_range ?? null);
        }
        setFilingsLoaded(true);
      })
      .catch(() => setFilingsLoaded(true))
      .finally(() => setFilingsLoading(false));
  }, [employerId, filingsLoaded, filingsLoading]);

  const series = useMemo(() => {
    // Filter out years with implausible salary values before rendering the chart
    const validated = getEmployerTrend(trend, employerName, visaType).filter(
      (r) => r.median_salary >= WAGE_SANITY.SALARY_FLOOR && r.median_salary <= WAGE_SANITY.SALARY_CEILING
    );
    return annotateWithYoy(validated);
  }, [trend, employerName, visaType]);

  const stats = useMemo(
    () => computeEmployerGrowth(trend, employerName, visaType),
    [trend, employerName, visaType]
  );

  // Prefer employer_role_profiles (employer-centric, ranked by filing count) over
  // employer_wage_rankings (SOC-centric, ranked by salary) — the latter only includes
  // an employer where it ranks in the top-25 by salary for a SOC, which causes large
  // IT consulting firms to show just 1-2 roles despite having thousands of filings.
  const roles = useMemo(
    () => getEmployerRoles(
      roleProfiles && roleProfiles.length > 0 ? roleProfiles : rankings,
      employerName,
      visaType
    ).slice(0, 8),
    [roleProfiles, rankings, employerName, visaType]
  );

  // Filter roles by search query (case-insensitive substring match)
  const filteredRoles = useMemo(() => {
    if (!roleQuery.trim()) return roles;
    const q = roleQuery.toLowerCase();
    return roles.filter(
      (r) =>
        r.soc_title.toLowerCase().includes(q) ||
        r.soc_code.includes(q)
    );
  }, [roles, roleQuery]);

  // Get percentile trend data for the selected role
  const roleTrendSeries = useMemo(() => {
    if (!selectedRole || !roleTrends || roleTrends.length === 0) return [];
    return getEmployerRoleTrendSeries(roleTrends, employerName, selectedRole.soc_code, visaType);
  }, [roleTrends, employerName, selectedRole, visaType]);

  if (!stats || series.length === 0) {
    return (
      <GlassCard variant="elevated" padding="md">
        <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
          No trend data available for {employerName}
        </p>
      </GlassCard>
    );
  }

  const cagrColor =
    (stats.cagr_5yr ?? 0) >= 5
      ? "text-emerald-400"
      : (stats.cagr_5yr ?? 0) >= 2
      ? "text-blue-400"
      : "text-amber-400";

  const yoyColor =
    (stats.yoy_latest ?? 0) > 0
      ? "text-emerald-400"
      : (stats.yoy_latest ?? 0) < 0
      ? "text-rose-400"
      : "text-[var(--muted-foreground)]";

  const YoyIcon =
    (stats.yoy_latest ?? 0) > 0
      ? TrendingUp
      : (stats.yoy_latest ?? 0) < 0
      ? TrendingDown
      : Minus;

  return (
    <FadeIn>
      <div className="space-y-5">

        {/* ── Growth badge row ────────────────────────────────────────── */}
        <StaggerContainer>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StaggerItem>
              <GrowthBadge
                label="Median Salary"
                value={formatCurrency(stats.latest_median)}
                color="text-white"
                icon={Building2}
              />
            </StaggerItem>
            <StaggerItem>
              <GrowthBadge
                label="5-Yr Growth"
                value={
                  stats.cagr_5yr != null ? `${stats.cagr_5yr > 0 ? "+" : ""}${stats.cagr_5yr}%` : "—"
                }
                color={cagrColor}
                icon={TrendingUp}
              />
            </StaggerItem>
            <StaggerItem>
              <GrowthBadge
                label="Last YoY"
                value={
                  stats.yoy_latest != null
                    ? `${stats.yoy_latest > 0 ? "+" : ""}${stats.yoy_latest}%`
                    : "—"
                }
                color={yoyColor}
                icon={YoyIcon}
              />
            </StaggerItem>
            <StaggerItem>
              <GrowthBadge
                label="Raise Streak"
                value={stats.streak > 0 ? `${stats.streak}yr` : "—"}
                color={stats.streak >= 3 ? "text-amber-400" : "text-[var(--muted-foreground)]"}
                icon={Flame}
              />
            </StaggerItem>
          </div>
        </StaggerContainer>

        {/* ── Salary trend chart ──────────────────────────────────────── */}
        <GlassCard variant="elevated" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {visaType} Salary Trend
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Median annual salary · FY{series[0]?.fiscal_year}–FY{series[series.length - 1]?.fiscal_year}
                {" · "}
                {formatCompact(stats.total_filings)} filings (latest yr)
                {(series.length < 5 || stats.total_filings < 30) && (
                  <span className="ml-1 text-amber-400/80">· Limited data — treat with caution</span>
                )}
              </p>
            </div>
            {stats.cagr_5yr != null && (
              <div className={cn("text-xs font-mono font-bold px-3 py-1.5 rounded-full border", cagrColor, "border-current bg-current/10")}>
                {stats.cagr_5yr > 0 ? "+" : ""}{stats.cagr_5yr}% / yr avg
              </div>
            )}
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                <defs>
                  <linearGradient id="empGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,160,0.15)" vertical={true} />
                <XAxis
                  dataKey="fiscal_year"
                  tick={{ fill: "#9ca3af", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
                  axisLine={{ stroke: "rgba(128,128,160,0.2)" }}
                  tickLine={false}
                  label={{ value: "Fiscal Year", position: "insideBottom", offset: -12, fill: "#6b7280", fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
                  axisLine={{ stroke: "rgba(128,128,160,0.2)" }}
                  tickLine={false}
                  width={72}
                  tickFormatter={(v) => `$${Math.round(v / 1000)}K`}
                />
                <Tooltip content={<SalaryTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)" }} />
                {/* Median reference line */}
                <ReferenceLine
                  y={stats.latest_median}
                  stroke="rgba(59,130,246,0.25)"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="median_salary"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#empGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#3b82f6", stroke: "rgba(59,130,246,0.4)", strokeWidth: 8 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

{/* ── Expandable sections: side-by-side toggle headers ────────── */}
        {/* Both collapsed by default; Filing Records only fetches on first open */}
        <div className="space-y-3">

          {/* Toggle header bar — two buttons side by side */}
          <div className={cn("grid gap-3", roles.length > 0 && employerId ? "grid-cols-2" : "grid-cols-1")}>

            {/* Top Roles toggle */}
            {roles.length > 0 && (
              <button
                onClick={() => setTopRolesOpen((v) => !v)}
                className={cn(
                  "flex items-center justify-between gap-2 px-4 py-3 rounded-xl border transition-all text-left",
                  topRolesOpen
                    ? "border-blue-400/30 bg-blue-400/[0.06]"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                )}
                aria-expanded={topRolesOpen}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Briefcase className="h-4 w-4 text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">Top Roles</p>
                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                      {roles.length} roles · last 36 months · {visaType}
                    </p>
                  </div>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-[var(--muted-foreground)] shrink-0 transition-transform duration-200",
                  topRolesOpen && "rotate-180 text-blue-400"
                )} />
              </button>
            )}

            {/* Filing Records toggle */}
            {employerId && (
              <button
                onClick={() => {
                  const willOpen = !filingsOpen;
                  setFilingsOpen(willOpen);
                  if (willOpen) triggerLoadFilings();
                }}
                className={cn(
                  "flex items-center justify-between gap-2 px-4 py-3 rounded-xl border transition-all text-left",
                  filingsOpen
                    ? "border-purple-400/30 bg-purple-400/[0.06]"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                )}
                aria-expanded={filingsOpen}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <BarChart3 className="h-4 w-4 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">Filing Records</p>
                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                      {filingsLoaded
                        ? `${lcaFilings.length.toLocaleString()} LCA · ${h1bPetitions.length} H-1B yr${lcaTotal > lcaFilings.length ? ` · capped` : ""}`
                        : "LCA per-case + H-1B petitions"}
                    </p>
                  </div>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-[var(--muted-foreground)] shrink-0 transition-transform duration-200",
                  filingsOpen && "rotate-180 text-purple-400"
                )} />
              </button>
            )}
          </div>

          {/* ── Expanded: Top Roles ────────────────────────────────────── */}
          <AnimatePresence>
            {topRolesOpen && roles.length > 0 && (
              <motion.div
                key="top-roles-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden"
              >
                <GlassCard variant="elevated" padding="lg">
                  {/* Search */}
                  <div className="flex items-start sm:items-center justify-between gap-3 mb-4 flex-col sm:flex-row">
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Click any role to see 5-year salary distribution
                    </p>
                    <div className="relative w-full sm:w-56">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                      <input
                        type="text"
                        value={roleQuery}
                        onChange={(e) => setRoleQuery(e.target.value)}
                        placeholder="Search roles..."
                        aria-label="Search roles"
                        className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-white/[0.08] bg-white/[0.03] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-blue-400/40 transition-colors"
                      />
                      {roleQuery && (
                        <button
                          onClick={() => setRoleQuery("")}
                          aria-label="Clear role search"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredRoles.length === 0 && roleQuery && (
                      <p className="text-xs text-[var(--muted-foreground)] text-center py-4">
                        No roles matching &ldquo;{roleQuery}&rdquo;
                      </p>
                    )}
                    {filteredRoles.map((role, i) => {
                      const premium = role.wage_premium_pct ?? 0;
                      const premiumColor =
                        premium >= 20 ? "text-emerald-400" : premium >= 5 ? "text-blue-400" : "text-amber-400";
                      const isSelected = selectedRole?.soc_code === role.soc_code;
                      const hasTrendData = roleTrends && roleTrends.length > 0;

                      return (
                        <div key={`${role.soc_code}-${i}`}>
                          <motion.button
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.04 }}
                            onClick={() =>
                              setSelectedRole(isSelected ? null : { soc_code: role.soc_code, soc_title: role.soc_title })
                            }
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left cursor-pointer",
                              isSelected
                                ? "border-blue-400/30 bg-blue-400/[0.06]"
                                : "border-white/[0.04] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                            )}
                            aria-label={`View salary trends for ${role.soc_title}`}
                            aria-expanded={isSelected}
                          >
                            <span className="w-5 text-right text-[10px] font-mono text-[rgba(255,255,255,0.25)] shrink-0">
                              {i + 1}
                            </span>
                            <Briefcase className="h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{role.soc_title}</p>
                              <p className="text-[10px] text-[var(--muted-foreground)] font-mono truncate">
                                {role.soc_code}
                                {role.job_title_top ? ` · ${role.job_title_top}` : ""}
                                {role.worksite_state_top ? ` · ${role.worksite_state_top}` : ""}
                              </p>
                            </div>
                            <span className="hidden sm:block text-xs text-[var(--muted-foreground)] font-mono shrink-0 w-16 text-right">
                              {formatCompact(role.n_filings)} filings
                            </span>
                            <div className="hidden md:flex flex-col items-end">
                              <span className="text-[10px] text-[var(--muted-foreground)] font-mono mb-0.5">Last year</span>
                              <span className="text-xs font-mono font-semibold text-[rgba(255,255,255,0.6)]">
                                {(role as unknown as Record<string, unknown>).prior_year_median_salary
                                  ? formatCurrency((role as unknown as Record<string, unknown>).prior_year_median_salary as number)
                                  : "—"}
                              </span>
                            </div>
                            <span className="text-sm font-mono font-bold text-white shrink-0 w-24 text-right">
                              {formatCurrency(role.median_salary)}
                            </span>
                            <span className={cn("text-xs font-semibold shrink-0 w-16 text-right hidden sm:block", premiumColor)}>
                              {premium >= 0 ? "+" : ""}{Math.round(premium)}% mkt
                            </span>
                            {hasTrendData && (
                              <ChevronDown className={cn(
                                "h-3.5 w-3.5 text-[var(--muted-foreground)] shrink-0 transition-transform duration-200",
                                isSelected && "rotate-180 text-blue-400"
                              )} />
                            )}
                          </motion.button>

                          <AnimatePresence>
                            {isSelected && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                                className="overflow-hidden"
                              >
                                <div className="pt-3 pb-1">
                                  <RolePercentileTrend
                                    series={roleTrendSeries}
                                    employerName={employerName}
                                    socTitle={role.soc_title}
                                    socCode={role.soc_code}
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Expanded: Filing Records ──────────────────────────────────── */}
          <AnimatePresence>
            {filingsOpen && (
              <motion.div
                key="raw-filings-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden"
              >
                {filingsLoading ? (
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-10 text-center">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-purple-500/40 border-t-purple-500" />
                    <p className="mt-3 text-xs text-white/40">Loading filing records…</p>
                  </div>
                ) : filingsLoaded ? (
                  <RawFilingsTable
                    lcaFilings={lcaFilings}
                    h1bPetitions={h1bPetitions}
                    employerName={employerName}
                    lcaTotal={lcaTotal}
                    lcaFyRange={lcaFyRange ?? undefined}
                  />
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </FadeIn>
  );
}
