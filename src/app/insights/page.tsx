/**
 * My Insights — Personalized Immigration Dashboard
 *
 * Collects 7 profile fields inline (persisted to localStorage) and renders
 * 3 smart insight panels that unlock progressively as fields are filled:
 *
 *   A. Green Card Forecast   — priority date + category + country → PDI chart + predictions
 *   B. Sponsor Intelligence  — employer name → SRS gauge + metrics + trend
 *   C. Salary Compass        — salary + employer/job title → percentile + benchmark
 *
 * No separate /setup page — this IS the setup and the insights in one flow.
 *
 * Route: /insights
 */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Calendar,
  Building2,
  DollarSign,
  MapPin,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Target,
  Shield,
  TrendingUp,
  CheckCircle,
  Clock,
  Zap,
  ArrowUpRight,
  Info,
  Edit3,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMonthYear, formatCurrency } from "@/lib/utils/format";
import { GlassCard, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui";
import { PriorityDateChart } from "@/components/pdi/priority-date-chart";
import {
  EmployerSearch,
  SrsScoreGauge,
  EmployerDetailCard,
  SrsTrendChart,
} from "@/components/srs";
import {
  loadPdForecasts,
  loadPdForecastsRetrograde,
  loadCutoffTrends,
  getForecastSeries,
  getHistoricalSeries,
  computePdi,
  extrapolateForChart,
  COUNTRY_LABELS,
} from "@/lib/data/pdi";
import {
  loadSrsScoresML,
  loadEmployerRiskFeatures,
  getEmployerRisk,
} from "@/lib/data/srs";
import {
  loadEmployerSearch,
  loadEmployerShard,
  extractSrsFromShard,
  extractMonthlyMetrics,
  extractWageRoles,
  type EmployerSearchEntry,
} from "@/lib/data/employer-shard";
import {
  loadSalaryBenchmarksNational,
  getNationalBenchmark,
  computePercentile,
} from "@/lib/data/wage";
import type { EmployerWageRanking } from "@/lib/data/wage";
import { secureGet, secureSet } from "@/lib/security";
import type { PdForecast, PdForecastRetrograde } from "@/types/p2-artifacts";
import type { CutoffTrendRecord } from "@/lib/data/pdi";
import type {
  SponsorReliabilityScore,
  SponsorReliabilityScoreML,
  EmployerMonthlyMetric,
  EmployerRiskFeature,
} from "@/types/p2-artifacts";
import type { SalaryBenchmark } from "@/lib/data/wage";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
const STORAGE_KEY = "user_profile";

const PRIMARY_EB_CATEGORIES = ["EB1", "EB2", "EB3"] as const;
const EXTENDED_EB_CATEGORIES = ["EB3-Other", "EB4", "EB5"] as const;
const EB_CATEGORIES = [...PRIMARY_EB_CATEGORIES, ...EXTENDED_EB_CATEGORIES] as const;
const PRIMARY_COUNTRIES = [
  { code: "IND", label: "India" },
  { code: "CHN", label: "China" },
] as const;
const EXTENDED_COUNTRIES = [
  { code: "ROW", label: "ROW" },
  { code: "PHL", label: "PHL" },
  { code: "MEX", label: "MEX" },
] as const;
const DISPLAY_COUNTRIES = [...PRIMARY_COUNTRIES, ...EXTENDED_COUNTRIES] as const;

/** Title-level prefixes to ignore when matching job titles to SOC categories */
const TITLE_LEVEL_WORDS = new Set([
  "sr", "senior", "jr", "junior", "lead", "staff", "principal",
  "associate", "mid", "entry", "the", "and", "for", "of",
  "i", "ii", "iii", "iv", "v", "1", "2", "3",
]);

/** Common job title word → SOC title synonyms for better matching */
const TITLE_SYNONYMS: Record<string, string[]> = {
  "dev":        ["developer", "software"],
  "devops":     ["software", "systems", "administrator"],
  "sde":        ["software", "developer"],
  "swe":        ["software", "engineer"],
  "qa":         ["quality", "assurance", "tester"],
  "ml":         ["machine", "learning"],
  "ai":         ["artificial", "intelligence"],
  "dba":        ["database", "administrator"],
  "pm":         ["project", "management"],
  "ba":         ["business", "analyst"],
  "ux":         ["user", "experience", "designer"],
  "ui":         ["user", "interface", "designer"],
  "frontend":   ["web", "developer"],
  "backend":    ["software", "developer"],
  "fullstack":  ["software", "developer", "web"],
  "infra":      ["systems", "infrastructure"],
  "cloud":      ["systems", "network"],
  "cyber":      ["information", "security"],
  "sec":        ["security", "information"],
  "ops":        ["operations", "systems"],
  "accounting": ["accountant", "auditor"],
  "hr":         ["human", "resources"],
  "marketing":  ["market", "research"],
  "sales":      ["sales", "representative"],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserProfile {
  priorityDate: string;       // YYYY-MM-DD
  category: string;           // "EB2" etc.
  country: string;            // "IND" etc.
  employerName: string;       // free text
  wageOffered: string;        // numeric string (keep as string for input compatibility)
  jobTitle: string;
  yearsOfExperience: string;  // numeric string
}

const DEFAULT_PROFILE: UserProfile = {
  priorityDate: "",
  category: "EB2",
  country: "IND",
  employerName: "",
  wageOffered: "",
  jobTitle: "",
  yearsOfExperience: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadProfile(): UserProfile {
  try {
    const parsed = secureGet<Partial<UserProfile>>(STORAGE_KEY);
    if (!parsed || typeof parsed !== "object") return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveProfile(profile: UserProfile) {
  try {
    secureSet<UserProfile>(STORAGE_KEY, profile);
    analytics.insightProfileSaved({
      fieldsFilled: [
        profile.priorityDate,
        profile.country,
        profile.category,
        profile.employerName,
        profile.jobTitle,
        profile.wageOffered,
        profile.yearsOfExperience,
      ].filter(Boolean).length,
      hasPriorityDate: !!profile.priorityDate,
      hasCountry:      !!profile.country,
      hasCategory:     !!profile.category,
      hasEmployer:     !!profile.employerName,
      hasJobTitle:     !!profile.jobTitle,
      hasWage:         !!profile.wageOffered,
      // Exact values
      priorityDate:      profile.priorityDate    || undefined,
      country:           profile.country         || undefined,
      category:          profile.category        || undefined,
      employerName:      profile.employerName    || undefined,
      jobTitle:          profile.jobTitle        || undefined,
      wageOffered:       profile.wageOffered     || undefined,
      yearsOfExperience: profile.yearsOfExperience || undefined,
    });
  } catch {
    // ignore storage errors
  }
}

function isProfileFilled(p: UserProfile): boolean {
  return !!(p.priorityDate || p.employerName || p.wageOffered);
}

/**
 * Smart benchmark matching — splits job title into significant words (skipping
 * level prefixes like Sr/Senior/Lead/Staff), expands abbreviations via synonyms,
 * and scores each SOC benchmark by how many words match its title.
 * Returns null if nothing matches (avoids false fallback to unrelated categories).
 */
function findBestBenchmark(
  nationalBenchmarks: SalaryBenchmark[],
  jobTitle: string
): SalaryBenchmark | null {
  if (!jobTitle.trim()) return null;
  const rawWords = jobTitle
    .toLowerCase()
    .split(/[\s,/\-]+/)
    .filter((w) => w.length > 1 && !TITLE_LEVEL_WORDS.has(w));
  if (rawWords.length === 0) return null;

  // Expand synonyms: if a word has known synonyms, add them as additional search terms
  const expandedWords = new Set<string>();
  for (const w of rawWords) {
    expandedWords.add(w);
    const syns = TITLE_SYNONYMS[w];
    if (syns) for (const s of syns) expandedWords.add(s);
  }
  const words = Array.from(expandedWords);

  // Score each benchmark: how many significant words appear in its SOC title
  // Bonus for exact whole-word matches (not just substring)
  const scored = nationalBenchmarks
    .map((b) => {
      const titleLower = b.soc_title.toLowerCase();
      const titleWords = titleLower.split(/[\s,/\-]+/);
      let score = 0;
      for (const w of words) {
        if (titleWords.includes(w)) {
          score += 2; // exact word match
        } else if (titleLower.includes(w)) {
          score += 1; // substring match
        }
      }
      return { b, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.b ?? null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Country picker: shows India/China primary + expandable More for ROW/PHL/MEX */
function CountryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const isExtended = EXTENDED_COUNTRIES.some((c) => c.code === value);
  const extendedLabel = EXTENDED_COUNTRIES.find((c) => c.code === value)?.label;

  const showExtendedRow = showMore || isExtended;

  return (
    <div className="space-y-0.5">
      {/* Row 1: always exactly 3 items — India | China | More/Less toggle */}
      <div className="flex gap-0.5">
        {PRIMARY_COUNTRIES.map(({ code, label }) => (
          <SmallPill key={code} active={value === code} onClick={() => onChange(code)} color="purple">
            {label}
          </SmallPill>
        ))}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className={cn(
            "flex-1 min-w-0 px-1 py-0.5 rounded-full text-[10px] font-medium border transition-all duration-150 truncate",
            isExtended
              ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
              : showMore
              ? "text-[var(--muted-foreground)] border-white/[0.12] hover:border-white/[0.22] hover:text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] border-white/[0.06] hover:border-white/[0.18] hover:text-[var(--foreground)]"
          )}
          aria-label={showMore ? "Hide more countries" : "More countries"}
        >
          {isExtended ? extendedLabel : (showMore ? "Less" : "More")}
        </button>
      </div>

      {/* Row 2: ROW | PHL | MEX — animates in when expanded */}
      <AnimatePresence>
        {showExtendedRow && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex gap-0.5 pt-0.5">
              {EXTENDED_COUNTRIES.map(({ code, label }) => (
                <SmallPill
                  key={code}
                  active={value === code}
                  onClick={() => { onChange(code); setShowMore(false); }}
                  color="purple"
                >
                  {label}
                </SmallPill>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** EB Category picker: shows EB1/EB2/EB3 + expandable More for EB3-Other/EB4/EB5 */
function EbCategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (cat: string) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const isExtended = EXTENDED_EB_CATEGORIES.includes(value as typeof EXTENDED_EB_CATEGORIES[number]);

  return (
    <div className="flex flex-wrap gap-1">
      {PRIMARY_EB_CATEGORIES.map((cat) => (
        <Pill key={cat} active={value === cat} onClick={() => onChange(cat)} color="blue">
          {cat}
        </Pill>
      ))}
      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all duration-150",
          isExtended
            ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
            : "text-[var(--muted-foreground)] border-white/[0.06] hover:border-white/[0.18] hover:text-[var(--foreground)]"
        )}
        aria-label={showMore ? "Hide extended EB categories" : "Show extended EB categories"}
      >
        {isExtended ? value : (showMore ? "Less" : "More")}
      </button>
      <AnimatePresence>
        {(showMore || isExtended) &&
          EXTENDED_EB_CATEGORIES.map((cat) => (
            <motion.div
              key={cat}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.12 }}
            >
              <Pill active={value === cat} onClick={() => { onChange(cat); setShowMore(false); }} color="blue">
                {cat}
              </Pill>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}

/** Pill selector button — matches PDI/SRS page aesthetic */
function Pill({
  active,
  onClick,
  children,
  color = "blue",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: "blue" | "purple" | "emerald";
}) {
  const activeClasses = {
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    purple: "bg-violet-500/20 text-violet-300 border-violet-500/40",
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
        active
          ? activeClasses[color]
          : "text-[var(--muted-foreground)] border-white/[0.08] hover:border-white/[0.18] hover:text-[var(--foreground)]"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Compact pill for the CountryPicker 3-column rows.
 * Slightly tighter than Pill so all three fit in a narrow field.
 */
function SmallPill({
  active,
  onClick,
  children,
  color = "blue",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: "blue" | "purple" | "emerald";
}) {
  const activeClasses = {
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    purple: "bg-violet-500/20 text-violet-300 border-violet-500/40",
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 min-w-0 px-1 py-0.5 rounded-full text-[10px] font-medium border transition-all truncate",
        active
          ? activeClasses[color]
          : "text-[var(--muted-foreground)] border-white/[0.08] hover:border-white/[0.18] hover:text-[var(--foreground)]"
      )}
    >
      {children}
    </button>
  );
}

/** Label + small icon for form rows */
function FormLabel({ icon: Icon, children }: { icon: typeof Calendar; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </label>
  );
}

/** Tier step indicator for progressive form */
function TierLabel({ number, label, unlocks }: { number: number; label: string; unlocks: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-400">
        {number}
      </span>
      <span className="text-xs font-semibold text-[var(--foreground)]">{label}</span>
      <span className="text-[10px] text-[var(--muted-foreground)]">· unlocks {unlocks}</span>
    </div>
  );
}

/** Padlock-style empty-state CTA */
function PanelCTA({ icon: Icon, title, body }: { icon: typeof Target; title: string; body: string }) {
  return (
    <GlassCard padding="sm" className="border-dashed border-violet-500/[0.15]">
      <div className="flex flex-col items-center py-3 text-center gap-1.5">
        <div className="h-8 w-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Icon className="h-4 w-4 text-violet-400/70" />
        </div>
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        <p className="text-xs text-[var(--muted-foreground)] max-w-xs leading-relaxed">{body}</p>
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Panel A: Green Card Forecast
// ---------------------------------------------------------------------------

type GCForecastMode = "optimistic" | "mcra";

function GreenCardPanel({
  profile,
  forecasts,
  retroForecasts,
  trends,
}: {
  profile: UserProfile;
  forecasts: PdForecast[];
  retroForecasts: PdForecastRetrograde[];
  trends: CutoffTrendRecord[];
}) {
  const [forecastMode, setForecastMode] = useState<GCForecastMode>("optimistic");
  const multiplier = 1.0;
  const activeForecastSource: PdForecast[] =
    forecastMode === "mcra" ? retroForecasts : forecasts;

  const hasPd = !!profile.priorityDate;
  const hasData = forecasts.length > 0;

  const dffSeries = useMemo(
    () => (hasData ? getForecastSeries(activeForecastSource, "DFF", profile.category, profile.country) : []),
    [activeForecastSource, profile.category, profile.country, hasData]
  );
  const fadSeries = useMemo(
    () => (hasData ? getForecastSeries(activeForecastSource, "FAD", profile.category, profile.country) : []),
    [activeForecastSource, profile.category, profile.country, hasData]
  );

  const dffPdi = useMemo(() => {
    if (!hasPd || dffSeries.length === 0) return null;
    return computePdi(activeForecastSource, "DFF", profile.category, profile.country, profile.priorityDate, multiplier);
  }, [activeForecastSource, profile.category, profile.country, profile.priorityDate, dffSeries.length, multiplier, hasPd]);

  const fadPdi = useMemo(() => {
    if (!hasPd || fadSeries.length === 0) return null;
    return computePdi(activeForecastSource, "FAD", profile.category, profile.country, profile.priorityDate, multiplier);
  }, [activeForecastSource, profile.category, profile.country, profile.priorityDate, fadSeries.length, multiplier, hasPd]);

  const dffExtrapolation = useMemo(() => {
    if (!hasPd || dffSeries.length === 0) return [];
    const ts = new Date(profile.priorityDate).getTime();
    return isNaN(ts) ? [] : extrapolateForChart(dffSeries, ts, 120, multiplier);
  }, [profile.priorityDate, dffSeries, multiplier, hasPd]);

  const fadExtrapolation = useMemo(() => {
    if (!hasPd || fadSeries.length === 0) return [];
    const ts = new Date(profile.priorityDate).getTime();
    return isNaN(ts) ? [] : extrapolateForChart(fadSeries, ts, 120, multiplier);
  }, [profile.priorityDate, fadSeries, multiplier, hasPd]);

  const dffTrends = useMemo(
    () => getHistoricalSeries(trends, "DFF", profile.category, profile.country),
    [trends, profile.category, profile.country]
  );
  const fadTrends = useMemo(
    () => getHistoricalSeries(trends, "FAD", profile.category, profile.country),
    [trends, profile.category, profile.country]
  );

  const hasChartData = dffSeries.length > 0 || fadSeries.length > 0;

  // --- Section header ---
  const sectionHeader = (
    <div className="flex items-center gap-3 mb-1">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shrink-0">
        <Calendar className="h-4 w-4 text-white" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Green Card Forecast</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          When your priority date may become current ·{" "}
          {COUNTRY_LABELS[profile.country] ?? profile.country} · {profile.category}
        </p>
      </div>
    </div>
  );

  if (!hasPd) {
    return (
      <FadeIn>
        <div className="space-y-3">
          {sectionHeader}
          <PanelCTA
            icon={Calendar}
            title="Enter your priority date above"
            body="Add your priority date in the profile card to see when the cutoff date may reach your PD (with DFF and FAD timeline projections)."
          />
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <div className="space-y-4">
        {sectionHeader}

        {/* Forecast mode toggle: Optimistic / Risk-Adjusted */}
        <div className="flex items-center gap-2 justify-end flex-wrap">
          <span className="text-[10px] text-[var(--muted-foreground)]">Forecast mode:</span>
          <button
            onClick={() => setForecastMode("optimistic")}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
              forecastMode === "optimistic"
                ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                : "text-[var(--muted-foreground)] border-white/[0.08]"
            )}
          >
            <Zap className="h-3 w-3 inline mr-1" />
            Optimistic
          </button>
          <button
            onClick={() => setForecastMode("mcra")}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
              forecastMode === "mcra"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "text-[var(--muted-foreground)] border-white/[0.08]"
            )}
          >
            Risk-Adjusted
          </button>
        </div>

        {/* Chart */}
        {hasChartData && (
          <PriorityDateChart
            dffForecast={dffSeries}
            fadForecast={fadSeries}
            dffTrends={dffTrends}
            fadTrends={fadTrends}
            priorityDate={profile.priorityDate}
            dffExtrapolation={dffExtrapolation}
            fadExtrapolation={fadExtrapolation}
          />
        )}

        {/* Prediction cards */}
        {(dffPdi || fadPdi) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dffPdi && (
              <GlassCard variant="elevated" padding="md">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Date for Filing (DFF)
                    </p>
                    {dffPdi.found && dffPdi.monthsUntilCurrent === 0 ? (
                      <>
                        <p className="text-xl font-mono font-bold text-emerald-400">Current!</p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          Your priority date is already current for filing
                        </p>
                      </>
                    ) : dffPdi.found && dffPdi.currentMonth ? (
                      <>
                        <p className="text-xl font-mono font-bold text-[var(--foreground)]">
                          {formatMonthYear(dffPdi.currentMonth)}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          ~{dffPdi.monthsUntilCurrent} months from now
                          {dffPdi.extrapolated && (
                            <span className="ml-1 text-amber-400/80">(extrapolated)</span>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-[var(--muted-foreground)]">No data available</p>
                    )}
                  </div>
                </div>
              </GlassCard>
            )}
            {fadPdi && (
              <GlassCard variant="elevated" padding="md">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Final Action Date (FAD)
                    </p>
                    {fadPdi.found && fadPdi.monthsUntilCurrent === 0 ? (
                      <>
                        <p className="text-xl font-mono font-bold text-emerald-400">Current!</p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          Your priority date is already current for approval
                        </p>
                      </>
                    ) : fadPdi.found && fadPdi.currentMonth ? (
                      <>
                        <p className="text-xl font-mono font-bold text-[var(--foreground)]">
                          {formatMonthYear(fadPdi.currentMonth)}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          ~{fadPdi.monthsUntilCurrent} months from now
                          {fadPdi.extrapolated && (
                            <span className="ml-1 text-amber-400/80">(extrapolated)</span>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-[var(--muted-foreground)]">No data available</p>
                    )}
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        )}

      </div>
    </FadeIn>
  );
}

// ---------------------------------------------------------------------------
// Panel B: Sponsor Intelligence
// ---------------------------------------------------------------------------

// Inner component — avoids IIFE-in-JSX pattern and correctly maps gauge props
function SponsorScoreContent({
  employer,
  risk,
}: {
  employer: SponsorReliabilityScore & { srs_ml?: number };
  risk: EmployerRiskFeature | undefined;
}) {
  const isRated =
    employer.srs != null &&
    !isNaN(Number(employer.srs)) &&
    employer.srs_tier !== "Unrated";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="space-y-4"
    >
      {isRated ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlassCard variant="elevated" padding="lg">
            <SrsScoreGauge
              score={employer.srs ?? null}
              tier={employer.srs_tier}
              subscores={{
                outcome: employer.outcome_subscore,
                wage: employer.wage_subscore,
                sustainability: employer.sustainability_subscore,
              }}
              mlScore={employer.srs_ml ?? undefined}
            />
          </GlassCard>
          <GlassCard variant="elevated" padding="lg">
            <EmployerDetailCard employer={employer} risk={risk} />
          </GlassCard>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
            <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Sponsor Reliability Score not available
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                <span className="font-medium text-[var(--foreground)]">{employer.employer_name}</span>{" "}
                has insufficient H-1B sponsorship history to compute a reliability score.
                Filing detail and approval rates may still be available below.
              </p>
            </div>
          </div>
          <GlassCard variant="elevated" padding="lg">
            <EmployerDetailCard employer={employer} risk={risk} />
          </GlassCard>
        </div>
      )}
    </motion.div>
  );
}

function SponsorPanel({
  profile,
  overallScores,
  mlScores,
  riskFeatures,
  onEmployerSelect,
  selectedEmployer,
  selectedMetrics,
  selectedRisk,
}: {
  profile: UserProfile;
  overallScores: SponsorReliabilityScore[];
  mlScores: SponsorReliabilityScoreML[];
  riskFeatures: EmployerRiskFeature[];
  onEmployerSelect: (e: SponsorReliabilityScore) => void;
  selectedEmployer: (SponsorReliabilityScore & { srs_ml?: number }) | null;
  selectedMetrics: EmployerMonthlyMetric[];
  selectedRisk: EmployerRiskFeature | undefined;
}) {
  const sectionHeader = (
    <div className="flex items-center gap-3 mb-1">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-400 shrink-0">
        <Shield className="h-4 w-4 text-white" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Sponsor Intelligence</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          {profile.employerName
            ? `Showing data for: ${profile.employerName}`
            : "Enter your employer in Your Profile above"}
        </p>
      </div>
    </div>
  );

  return (
    <FadeIn>
      <div className="space-y-4">
        {sectionHeader}

        {/* Score + details — hidden until employer selected (Smart Visibility) */}
        {!selectedEmployer ? (
          <PanelCTA
            icon={Shield}
            title="Set your employer"
            body="Enter your employer in Your Profile above to see their Sponsor Reliability Score, approval rates, wage competitiveness, and risk signals."
          />
        ) : (
          <SponsorScoreContent employer={selectedEmployer} risk={selectedRisk} />
        )}

        {/* Trend chart */}
        {selectedEmployer && selectedMetrics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
          >
            <SrsTrendChart employerName={selectedEmployer.employer_name} metrics={selectedMetrics} />
          </motion.div>
        )}
      </div>
    </FadeIn>
  );
}

// ---------------------------------------------------------------------------
// Panel C: Salary Compass
// ---------------------------------------------------------------------------

type SalaryCompareMode = "employer" | "industry";

/**
 * Match user's job title to the best employer wage role using the same
 * word-overlap algorithm as findBestBenchmark but against employer's SOC roles.
 */
function findBestEmployerRole(
  roles: EmployerWageRanking[],
  jobTitle: string,
  nationalBenchmarks: SalaryBenchmark[],
): EmployerWageRanking | null {
  if (roles.length === 0) return null;

  // If job title given, score by word overlap
  if (jobTitle.trim()) {
    const words = jobTitle
      .toLowerCase()
      .split(/[\s,/\-]+/)
      .filter((w) => w.length > 2 && !TITLE_LEVEL_WORDS.has(w));
    if (words.length > 0) {
      const scored = roles
        .map((r) => ({
          r,
          score: words.filter((w) => r.soc_title.toLowerCase().includes(w)).length,
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || b.r.n_filings - a.r.n_filings);
      if (scored[0]) return scored[0].r;
    }
  }

  // Fallback: try matching SOC code from national best-match
  const nationalMatch = jobTitle.trim()
    ? findBestBenchmark(nationalBenchmarks, jobTitle)
    : null;
  if (nationalMatch) {
    const byCode = roles.find((r) => r.soc_code === nationalMatch.soc_code);
    if (byCode) return byCode;
  }

  return null;
}

/** Convert an EmployerWageRanking into a SalaryBenchmark shape for reuse. */
function roleAsBenchmark(role: EmployerWageRanking): SalaryBenchmark {
  return {
    soc_code: role.soc_code,
    soc_title: role.soc_title,
    area_code: "employer",
    area_title: role.employer_name,
    p10: role.p10_salary ?? Math.round(role.p25_salary * 0.85),
    p25: role.p25_salary,
    median: role.median_salary,
    p75: role.p75_salary,
    p90: role.p90_salary ?? Math.round(role.p75_salary * 1.15),
  };
}

function SalaryPanel({
  profile,
  benchmarks,
  employerWageRoles,
  employerName,
}: {
  profile: UserProfile;
  benchmarks: SalaryBenchmark[];
  employerWageRoles: EmployerWageRanking[];
  employerName: string | null;
}) {
  const wage = Number(profile.wageOffered);
  const hasWage = wage > 0;
  const hasEmployerData = employerWageRoles.length > 0 && !!employerName;

  // User can explicitly pick a mode; null = auto-detect from data availability
  const [compareModeOverride, setCompareModeOverride] = useState<SalaryCompareMode | null>(null);
  const compareMode: SalaryCompareMode = compareModeOverride ?? (hasEmployerData ? "employer" : "industry");

  const sectionHeader = (
    <div className="flex items-center gap-3 mb-1">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-400 shrink-0">
        <DollarSign className="h-4 w-4 text-white" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Salary Compass</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          How your offered wage compares to{" "}
          {compareMode === "employer" && employerName
            ? `peers at ${employerName}`
            : "industry benchmarks"}
        </p>
      </div>
    </div>
  );

  if (!hasWage) {
    return (
      <FadeIn>
        <div className="space-y-3">
          {sectionHeader}
          <PanelCTA
            icon={DollarSign}
            title="Enter your offered salary"
            body="Add your annual wage offer in the profile card to see how it compares to market percentiles for your role and location."
          />
        </div>
      </FadeIn>
    );
  }

  const nationalBenchmarks = benchmarks.filter((b) => b.area_code === "99");

  // Resolve benchmark based on mode
  let benchmark: SalaryBenchmark | null = null;
  let matchLabel = "";
  let matchContext = "";

  if (compareMode === "employer" && hasEmployerData) {
    const role = findBestEmployerRole(employerWageRoles, profile.jobTitle, nationalBenchmarks);
    if (role) {
      benchmark = roleAsBenchmark(role);
      matchLabel = "Role match at your employer";
      matchContext = `${role.soc_title} · ${role.n_filings} filings · FY${role.fiscal_year}`;
    }
  }

  // Industry mode or employer mode with no match
  if (!benchmark) {
    benchmark = profile.jobTitle.trim()
      ? findBestBenchmark(nationalBenchmarks, profile.jobTitle)
      : (nationalBenchmarks[0] ?? null);
    if (benchmark) {
      matchLabel = profile.jobTitle.trim() ? "Closest role match" : "National reference";
      matchContext = benchmark.soc_title;
    }
    // If we fell through from employer mode, switch labels to indicate fallback
    if (compareMode === "employer" && benchmark) {
      matchLabel = "Industry data (no employer data for this role)";
    }
  }

  const percentileInfo = benchmark ? computePercentile(benchmark, wage) : null;

  // No benchmark match — helpful no-data state
  if (!benchmark) {
    return (
      <FadeIn>
        <div className="space-y-3">
          {sectionHeader}
          <GlassCard variant="elevated" padding="lg">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Your Offered Salary
                </p>
                <p className="text-3xl font-mono font-bold text-[var(--foreground)]">{formatCurrency(wage)}</p>
                {profile.jobTitle && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{profile.jobTitle}</p>
                )}
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--muted-foreground)]">
                  No salary benchmark found for{" "}
                  <span className="text-[var(--foreground)] font-semibold">&ldquo;{profile.jobTitle}&rdquo;</span>.
                  Try a standard job title (e.g. &ldquo;Software Engineer&rdquo; or &ldquo;Data Scientist&rdquo;).
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <div className="space-y-4">
        {sectionHeader}

        {/* Compare mode toggle — only shown when employer data is available */}
        {hasEmployerData && (
          <div className="flex items-center gap-2 justify-end flex-wrap" role="radiogroup" aria-label="Salary comparison mode">
            <span className="text-[10px] text-[var(--muted-foreground)]">Compare to:</span>
            <button
              role="radio"
              aria-checked={compareMode === "employer"}
              onClick={() => setCompareModeOverride("employer")}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                compareMode === "employer"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "text-[var(--muted-foreground)] border-white/[0.08] hover:border-white/[0.18] hover:text-[var(--foreground)]"
              )}
            >
              <Building2 className="h-3 w-3 inline mr-1" />
              Your Employer
            </button>
            <button
              role="radio"
              aria-checked={compareMode === "industry"}
              onClick={() => setCompareModeOverride("industry")}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                compareMode === "industry"
                  ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                  : "text-[var(--muted-foreground)] border-white/[0.08] hover:border-white/[0.18] hover:text-[var(--foreground)]"
              )}
            >
              <TrendingUp className="h-3 w-3 inline mr-1" />
              Industry Average
            </button>
          </div>
        )}

        <GlassCard variant="elevated" padding="lg">
          <div className="space-y-6">
            {/* Offered wage headline */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Your Offered Salary
                </p>
                <p className="text-3xl font-mono font-bold text-[var(--foreground)]">
                  {formatCurrency(wage)}
                </p>
                {profile.jobTitle && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{profile.jobTitle}</p>
                )}
              </div>
              {percentileInfo && (
                <div className={cn(
                  "px-4 py-2 rounded-xl border text-sm font-semibold",
                  percentileInfo.pct >= 75
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : percentileInfo.pct >= 50
                    ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                    : percentileInfo.pct >= 25
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                )}>
                  {percentileInfo.label}
                </div>
              )}
            </div>

            {/* Benchmark bar */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                {matchLabel} ·{" "}
                <span className="text-[var(--foreground)]">{matchContext}</span>
              </p>

              {/* Visual percentile ruler */}
              <div className="relative">
                <div className="flex h-6 w-full rounded-lg overflow-hidden">
                  <div className="h-full flex-1" style={{ background: "linear-gradient(90deg, rgba(251,113,133,0.5) 0%, rgba(251,146,60,0.45) 20%, rgba(96,165,250,0.45) 50%, rgba(52,211,153,0.5) 80%, rgba(16,185,129,0.6) 100%)" }} />
                </div>
                {/* Wage marker */}
                {(() => {
                  const { p10, p90 } = benchmark;
                  const clampedPct = Math.min(100, Math.max(0, ((wage - p10) / (p90 - p10)) * 100));
                  return (
                    <motion.div
                      initial={{ left: "50%" }}
                      animate={{ left: `${clampedPct}%` }}
                      transition={{ duration: 0.7, ease: EASE }}
                      className="absolute top-[-4px] -translate-x-1/2 flex flex-col items-center"
                      style={{ left: `${clampedPct}%` }}
                    >
                      <div className="w-0.5 h-8 bg-white/90 rounded-full" />
                      <div className="w-2 h-2 rounded-full bg-white mt-[-4px]" />
                    </motion.div>
                  );
                })()}
              </div>

              {/* Range labels */}
              <div className="grid grid-cols-5 gap-1 text-center">
                {[
                  { label: "p10", val: benchmark.p10, color: "text-rose-400" },
                  { label: "p25", val: benchmark.p25, color: "text-amber-400" },
                  { label: "Median", val: benchmark.median, color: "text-blue-400" },
                  { label: "p75", val: benchmark.p75, color: "text-emerald-400" },
                  { label: "p90", val: benchmark.p90, color: "text-emerald-400" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="space-y-0.5">
                    <p className={cn("text-[11px] font-mono font-semibold", color)}>
                      {formatCurrency(val)}
                    </p>
                    <p className="text-[9px] text-[var(--muted-foreground)]">{label}</p>
                  </div>
                ))}
              </div>

              {/* vs median */}
              <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <span className={cn(
                  "font-semibold font-mono",
                  wage >= benchmark.median ? "text-emerald-400" : "text-rose-400"
                )}>
                  {wage >= benchmark.median ? "+" : ""}
                  {formatCurrency(wage - benchmark.median)}
                </span>
                <span>vs median ({formatCurrency(benchmark.median)})</span>
              </div>
            </div>

            {/* Experience note */}
            {profile.yearsOfExperience && (
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                <Clock className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                <p className="text-xs text-[var(--muted-foreground)]">
                  <span className="font-semibold text-[var(--foreground)]">
                    {profile.yearsOfExperience} years
                  </span>{" "}
                  of experience noted, senior-level candidates typically land p75+
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </FadeIn>
  );
}

// ---------------------------------------------------------------------------
// Profile Form Card
// ---------------------------------------------------------------------------

function ProfileCard({
  profile,
  onChange,
  isEditing,
  onToggleEdit,
  overallScores,
  onEmployerSelect,
}: {
  profile: UserProfile;
  onChange: (updates: Partial<UserProfile>) => void;
  isEditing: boolean;
  onToggleEdit: () => void;
  overallScores: SponsorReliabilityScore[];
  onEmployerSelect: (e: SponsorReliabilityScore) => void;
}) {
  const filled = isProfileFilled(profile);

  return (
    <GlassCard variant="elevated" padding="md">
      {/* Card header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Your Profile</h2>
          {filled && !isEditing && (
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              Saved
            </span>
          )}
        </div>
        <button
          onClick={onToggleEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all text-[var(--muted-foreground)] border-white/[0.08] hover:text-[var(--foreground)] hover:border-white/[0.18]"
          aria-label={isEditing ? "Collapse profile" : "Edit profile"}
        >
          {isEditing ? (
            <>
              <Save className="h-3 w-3" />
              Done
            </>
          ) : (
            <>
              <Edit3 className="h-3 w-3" />
              Edit
            </>
          )}
          {isEditing ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isEditing && (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            {/* ── Compact row: PD(narrow fixed) | EB | Country | Employer (full-width mobile, grows desktop) ── */}
            <div className="grid grid-cols-3 sm:grid-cols-[112px_1fr_1fr_2fr] gap-x-2.5 gap-y-2.5">
              {/* Priority Date */}
              <div>
                <FormLabel icon={Calendar}>Priority Date</FormLabel>
                <input
                  type="date"
                  value={profile.priorityDate}
                  onChange={(e) => onChange({ priorityDate: e.target.value })}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  aria-label="Priority date"
                />
              </div>

              {/* EB Category — EB1/EB2/EB3 + expandable More */}
              <div>
                <FormLabel icon={Briefcase}>EB Category</FormLabel>
                <EbCategoryPicker
                  value={profile.category}
                  onChange={(cat) => onChange({ category: cat })}
                />
              </div>

              {/* Country — India/China + expandable More */}
              <div>
                <FormLabel icon={MapPin}>Country</FormLabel>
                <CountryPicker
                  value={profile.country}
                  onChange={(code) => onChange({ country: code })}
                />
              </div>

              {/* Employer — full width on mobile, 2fr on desktop */}
              <div className="col-span-3 sm:col-span-1">
                <FormLabel icon={Building2}>Employer</FormLabel>
                <EmployerSearch
                  employers={overallScores}
                  onSelect={(e) => {
                    onChange({ employerName: e.employer_name });
                    onEmployerSelect(e);
                  }}
                  placeholder={profile.employerName || "Search employers…"}
                  compact
                />
              </div>
            </div>

            {/* ── Tier 3: Salary & Role (reveals when employer is set) ─ */}
            <AnimatePresence>
              {!!profile.employerName && (
                <motion.div
                  key="tier3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="h-px bg-white/[0.06] my-3" />
                  <div className="space-y-2">
                    <TierLabel number={3} label="Salary & Role" unlocks="Salary Compass" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
                      {/* Annual Salary */}
                      <div>
                        <FormLabel icon={DollarSign}>Annual Salary Offered (USD)</FormLabel>
                        <input
                          type="number"
                          value={profile.wageOffered}
                          onChange={(e) => onChange({ wageOffered: e.target.value })}
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                          placeholder="e.g. 145000"
                          min="0"
                          aria-label="Annual salary"
                        />
                      </div>

                      {/* Job Title */}
                      <div>
                        <FormLabel icon={Briefcase}>Job Title</FormLabel>
                        <input
                          type="text"
                          value={profile.jobTitle}
                          onChange={(e) => onChange({ jobTitle: e.target.value })}
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                          placeholder="e.g. Software Engineer"
                          aria-label="Job title"
                        />
                      </div>

                      {/* Years of Experience */}
                      <div>
                        <FormLabel icon={Clock}>Years of Experience</FormLabel>
                        <input
                          type="number"
                          value={profile.yearsOfExperience}
                          onChange={(e) => onChange({ yearsOfExperience: e.target.value })}
                          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                          placeholder="e.g. 8"
                          min="0"
                          max="50"
                          aria-label="Years of experience"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hint when Tier 3 is hidden */}
            {!profile.employerName && (
              <p className="mt-2 text-center text-[10px] text-[var(--muted-foreground)]">
                Select an employer above to add salary and role details
              </p>
            )}

            <p className="mt-2 text-[10px] text-[var(--muted-foreground)] flex items-center gap-1.5">
              <ArrowUpRight className="h-3 w-3" />
              Saved automatically · stays in your browser, never sent to any server
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed summary */}
      {!isEditing && filled && (
        <div className="flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
          {profile.priorityDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              PD: <span className="text-[var(--foreground)] font-mono ml-1">{profile.priorityDate}</span>
            </span>
          )}
          {profile.category && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {profile.category}
            </span>
          )}
          {profile.country && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {COUNTRY_LABELS[profile.country] ?? profile.country}
            </span>
          )}
          {profile.employerName && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {profile.employerName}
            </span>
          )}
          {profile.wageOffered && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {formatCurrency(Number(profile.wageOffered))}
            </span>
          )}
        </div>
      )}

      {!isEditing && !filled && (
        <p className="text-xs text-[var(--muted-foreground)]">
          Fill in your details to see personalized immigration data.
        </p>
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InsightsPage() {
  // Profile state
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(true); // open by default on first visit

  // PDI data
  const [forecasts, setForecasts] = useState<PdForecast[]>([]);
  const [retroForecasts, setRetroForecasts] = useState<PdForecastRetrograde[]>([]);
  const [trends, setTrends] = useState<CutoffTrendRecord[]>([]);

  // SRS data
  const [overallScores, setOverallScores] = useState<SponsorReliabilityScore[]>([]);
  const [searchEntries, setSearchEntries] = useState<EmployerSearchEntry[]>([]);
  const [mlScores, setMlScores] = useState<SponsorReliabilityScoreML[]>([]);
  const [riskFeatures, setRiskFeatures] = useState<EmployerRiskFeature[]>([]);
  const [selectedEmployer, setSelectedEmployer] = useState<
    (SponsorReliabilityScore & { srs_ml?: number }) | null
  >(null);
  const [selectedMetrics, setSelectedMetrics] = useState<EmployerMonthlyMetric[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<EmployerRiskFeature | undefined>();

  // Wage data
  const [benchmarks, setBenchmarks] = useState<SalaryBenchmark[]>([]);
  const [employerWageRoles, setEmployerWageRoles] = useState<EmployerWageRanking[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved profile on mount
  useEffect(() => {
    const saved = loadProfile();
    setProfile(saved);
    if (isProfileFilled(saved)) setIsEditing(false);
  }, []);

  // Load session PDI filters (from Visa Bulletin page) on mount
  useEffect(() => {
    try {
      const sessionFilters = secureGet<{ category?: string; country?: string; priorityDate?: string }>("session_pdi_filters");
      if (sessionFilters) {
        const updates: Partial<UserProfile> = {};
        if (sessionFilters.category) updates.category = sessionFilters.category;
        if (sessionFilters.country) updates.country = sessionFilters.country;
        if (sessionFilters.priorityDate) updates.priorityDate = sessionFilters.priorityDate;
        if (Object.keys(updates).length > 0) {
          setProfile((prev) => ({ ...prev, ...updates }));
        }
      }
    } catch {}
  }, []);

  // Sync profile changes back to session PDI filters
  useEffect(() => {
    try {
      const sessionFilters = secureGet<{ category?: string; country?: string; priorityDate?: string }>("session_pdi_filters") || {};
      if (profile.category) sessionFilters.category = profile.category;
      if (profile.country) sessionFilters.country = profile.country;
      if (profile.priorityDate) sessionFilters.priorityDate = profile.priorityDate;
      if (Object.keys(sessionFilters).length > 0) {
        secureSet("session_pdi_filters", sessionFilters);
      }
    } catch {}
  }, [profile.category, profile.country, profile.priorityDate]);

  // Auto-restore saved employer selection once SRS scores are available
  // Auto-match employer from profile name (via search entries)
  useEffect(() => {
    if (overallScores.length === 0 || selectedEmployer) return;
    if (!profile.employerName) return;
    const needle = profile.employerName.toLowerCase();
    const match = overallScores.find((s) => s.employer_name.toLowerCase() === needle);
    if (match) {
      // Load the shard for full details
      loadEmployerShard(match.employer_id)
        .then((shard) => {
          if (shard) {
            const fullSrs = extractSrsFromShard(shard);
            const mlMatch = mlScores.find((m) => m.employer_id === match.employer_id);
            setSelectedEmployer({ ...(fullSrs ?? match), srs_ml: mlMatch?.srs_ml });
            setSelectedMetrics(extractMonthlyMetrics(shard));
            setSelectedRisk(getEmployerRisk(riskFeatures, match.employer_id));
            setEmployerWageRoles(extractWageRoles(shard));
          } else {
            const mlMatch = mlScores.find((m) => m.employer_id === match.employer_id);
            setSelectedEmployer({ ...match, srs_ml: mlMatch?.srs_ml });
            setEmployerWageRoles([]);
          }
        })
        .catch(() => {
          const mlMatch = mlScores.find((m) => m.employer_id === match.employer_id);
          setSelectedEmployer({ ...match, srs_ml: mlMatch?.srs_ml });
          setEmployerWageRoles([]);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overallScores]);

  // Load all data sources on mount
  useEffect(() => {
    Promise.all([
      loadPdForecasts(),
      loadPdForecastsRetrograde(),
      loadCutoffTrends(),
      loadEmployerSearch(),
      loadSrsScoresML(),
      loadEmployerRiskFeatures(),
      loadSalaryBenchmarksNational(),
    ])
      .then(([fc, retroFc, tr, entries, ml, risks, bench]) => {
        setForecasts(fc);
        setRetroForecasts(retroFc);
        setTrends(tr);
        setSearchEntries(entries);
        // Build lightweight SponsorReliabilityScore[] for EmployerSearch component.
        // n_36m is populated from total_filings so smart-sort volume ranking works.
        const asScores: SponsorReliabilityScore[] = entries
          .filter((e) => e.srs_score != null || e.total_filings > 0)
          .map((e) => ({
            employer_name: e.employer_name,
            employer_id: e.employer_id,
            scope: "overall",
            srs: e.srs_score,
            srs_tier: e.srs_tier,
            n_36m: e.total_filings, // drives smart-sort volume ranking
          } as SponsorReliabilityScore));
        setOverallScores(asScores);
        setMlScores(ml);
        setRiskFeatures(risks);
        setBenchmarks(bench);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load data")
      )
      .finally(() => setLoading(false));
  }, []);

  // Profile change handler — saves to localStorage on every change
  const handleProfileChange = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updates };
      saveProfile(next);
      return next;
    });
  }, []);

  // Employer selection from SRS search — loads shard for full data
  const handleEmployerSelect = useCallback(
    async (employer: SponsorReliabilityScore) => {
      const shard = await loadEmployerShard(employer.employer_id).catch(() => null);
      if (shard) {
        const fullSrs = extractSrsFromShard(shard);
        const mlMatch = mlScores.find((m) => m.employer_id === employer.employer_id);
        setSelectedEmployer({ ...(fullSrs ?? employer), srs_ml: mlMatch?.srs_ml });
        setSelectedMetrics(extractMonthlyMetrics(shard));
        setSelectedRisk(getEmployerRisk(riskFeatures, employer.employer_id));
        setEmployerWageRoles(extractWageRoles(shard));
      } else {
        const mlMatch = mlScores.find((m) => m.employer_id === employer.employer_id);
        setSelectedEmployer({ ...employer, srs_ml: mlMatch?.srs_ml });
        setSelectedMetrics([]);
        setSelectedRisk(getEmployerRisk(riskFeatures, employer.employer_id));
        setEmployerWageRoles([]);
      }
      // Sync employer name back to profile
      handleProfileChange({ employerName: employer.employer_name });
    },
    [mlScores, riskFeatures, handleProfileChange]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div
          data-testid="loading-spinner"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="h-8 w-8 rounded-full border-2 border-t-transparent border-[var(--accent-blue)]"
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
          <p className="text-sm text-rose-400">{error}</p>
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
    <div className="space-y-4 pb-6" data-testid="insights-page">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 shrink-0">
            <User className="h-4.5 w-4.5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
              My Insights
            </h1>
            <p className="text-xs text-[var(--muted-foreground)]">
              Personalized immigration intelligence, built around your situation
            </p>
          </div>
        </div>
      </FadeIn>

      {/* ── Profile Card ─────────────────────────────────────────────────── */}
      <FadeIn delay={0.05}>
        <ProfileCard
          profile={profile}
          onChange={handleProfileChange}
          isEditing={isEditing}
          onToggleEdit={() => setIsEditing((v) => !v)}
          overallScores={overallScores}
          onEmployerSelect={handleEmployerSelect}
        />
      </FadeIn>

      {/* ── Panels ───────────────────────────────────────────────────────── */}
      <StaggerContainer className="space-y-8">
        {/* Divider */}
        <StaggerItem>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Your Personalized Insights
            </span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>
        </StaggerItem>

        {/* Panel A: Green Card Forecast */}
        <StaggerItem>
          <GreenCardPanel profile={profile} forecasts={forecasts} retroForecasts={retroForecasts} trends={trends} />
        </StaggerItem>

        {/* Panel B: Sponsor Intelligence */}
        <StaggerItem>
          <SponsorPanel
            profile={profile}
            overallScores={overallScores}
            mlScores={mlScores}
            riskFeatures={riskFeatures}
            onEmployerSelect={handleEmployerSelect}
            selectedEmployer={selectedEmployer}
            selectedMetrics={selectedMetrics}
            selectedRisk={selectedRisk}
          />
        </StaggerItem>

        {/* Panel C: Salary Compass */}
        <StaggerItem>
          <SalaryPanel
            profile={profile}
            benchmarks={benchmarks}
            employerWageRoles={employerWageRoles}
            employerName={selectedEmployer?.employer_name ?? null}
          />
        </StaggerItem>
      </StaggerContainer>

      {/* ── Privacy note ─────────────────────────────────────────────────── */}
      <FadeIn>
        <GlassCard padding="md">
          <p className="text-[11px] text-[var(--muted-foreground)] text-center flex items-center justify-center gap-1.5">
            <Shield className="h-3 w-3 shrink-0" />
            All profile data is stored locally in your browser only. Nothing is ever sent to a server.
            See our{" "}
            <a href="/privacy" className="underline underline-offset-2 hover:text-[var(--foreground)] transition-colors">
              Privacy Policy
            </a>
            .
          </p>
        </GlassCard>
      </FadeIn>
    </div>
  );
}
