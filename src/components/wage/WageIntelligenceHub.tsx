/**
 * WageIntelligenceHub — Main client component for the Wage Competitiveness dashboard.
 *
 * Architecture (dual-mode search):
 *   ┌─────────────────────────────────────────────────┐
 *   │  [By Employer] [By Role]    Search input    [×] │
 *   └─────────────────────────────────────────────────┘
 *       ↓ employer selected           ↓ role selected
 *   EmployerProfile               StatCards + 4 Tabs
 *   (trend chart, roles)          (Trend|Dist|Employers|Regional)
 *
 * Data sources: salary_benchmarks_national, salary_benchmarks_states,
 *               soc_salary_market, employer_wage_rankings, employer_salary_trend
 */
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Fuse from "fuse.js";
import {
  Search,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  BarChart2,
  MapPin,
  Users,
  Briefcase,
  ChevronRight,
  Info,
  BriefcaseBusiness,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sortSocResults, sortWageEmployerResults } from "@/lib/search/smart-sort";
import { formatCurrency, formatNumber, formatCompact } from "@/lib/utils/format";
import { secureGet } from "@/lib/security";
import { GlassCard } from "@/components/ui/glass-card";
import { StatCard } from "@/components/ui/stat-card";
import { StaggerContainer, StaggerItem, FadeIn } from "@/components/ui/animations";
import { MarketTrendChart } from "@/components/wage/MarketTrendChart";
import { PercentileLadder } from "@/components/wage/PercentileLadder";
import { EmployerWageTable } from "@/components/wage/EmployerWageTable";
import { RegionalBreakdown } from "@/components/wage/RegionalBreakdown";
import { EmployerProfile } from "@/components/wage/EmployerProfile";
import {
  loadSalaryBenchmarksNational,
  loadSalaryBenchmarksStates,
  loadSocSalaryMarket,
  loadEmployerWageRankings,
  loadEmployerSalaryTrend,
  loadEmployerSearchIndex,
  loadEmployerRoleProfiles,
  loadEmployerRoleTrends,
  getSocList,
  getEmployerList,
  getNationalBenchmark,
  getLatestMarket,
  getYoyGrowth,
  getTopStates,
  computePercentile,
  getSocGroupStats,
  type SalaryBenchmark,
  type SocSalaryMarket,
  type EmployerWageRanking,
  type EmployerSalaryTrend,
  type EmployerSearchIndex,
  type EmployerRoleTrend,
} from "@/lib/data/wage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SocOption {
  code: string;
  title: string;
  aliases?: string[];  // additional search terms for alias matching
}

interface UserProfile {
  wageOffered?: number;
  jobTitle?: string;
  employerName?: string;
}

type SearchMode = "employer" | "role";
type VisaType = "H-1B" | "PERM";
type ActiveTab = "trend" | "distribution" | "employers" | "regional";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS: Array<{ id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "trend", label: "Wage Trend", icon: TrendingUp },
  { id: "distribution", label: "Distribution", icon: BarChart2 },
  { id: "employers", label: "Top Employers", icon: Building2 },
  { id: "regional", label: "By Region", icon: MapPin },
];

const EASING = [0.25, 0.1, 0.25, 1] as const;

const POPULAR_SOCS: Array<{ code: string; title: string }> = [
  { code: "15-1252", title: "Software Developers" },
  { code: "15-2051", title: "Data Scientists" },
  { code: "15-1211", title: "Computer Systems Analysts" },
  { code: "15-1299", title: "Software Quality Assurance" },
  { code: "17-2141", title: "Mechanical Engineers" },
  { code: "11-3021", title: "Computer & Info Systems Mgrs" },
  { code: "29-1071", title: "Physicians (General)" },
  { code: "13-2011", title: "Accountants & Auditors" },
];

const POPULAR_EMPLOYERS = [
  "Infosys",
  "Tata Consultancy Services",
  "Cognizant Technology Solutions Us",
  "Microsoft",
  "Deloitte Consulting",
  "Ernst Young U S",
  "Amazon Com Services",
  "Google",
];

/**
 * Maps SOC codes → additional user-friendly search aliases.
 * This lets users find "Software Developers" by typing "backend engineer",
 * "web developer", "programmer", etc. — without needing to know official titles.
 */
const ROLE_ALIASES: Record<string, string[]> = {
  "15-1252": ["backend developer", "backend engineer", "frontend developer", "fullstack developer", "full stack developer", "web developer", "software engineer", "app developer", "mobile developer", "programmer", "application developer"],
  "15-1254": ["web developer", "website developer", "web programmer", "front-end developer"],
  "15-1255": ["ui designer", "ux designer", "web designer", "digital designer", "frontend designer", "interface designer"],
  "15-1253": ["qa engineer", "quality assurance engineer", "test engineer", "sdet"],
  "15-2051": ["ml engineer", "machine learning engineer", "ai engineer", "artificial intelligence", "data engineer", "deep learning", "data science"],
  "15-2041": ["statistician", "biostatistician", "quantitative analyst", "quant"],
  "15-1211": ["it consultant", "systems consultant", "business systems analyst", "it analyst", "erm analyst"],
  "15-1299": ["qa engineer", "sqa", "test analyst", "quality engineer", "software tester"],
  "15-1241": ["network engineer", "network admin", "network administrator", "cloud engineer", "devops", "devops engineer", "sre", "site reliability engineer", "infrastructure engineer"],
  "15-1212": ["security engineer", "cybersecurity", "cybersecurity analyst", "information security", "infosec", "penetration tester"],
  "15-1245": ["dba", "database admin", "database administrator", "database engineer", "data warehouse"],
  "15-1246": ["database architect", "data architect"],
  "11-3021": ["it manager", "technology manager", "cto", "vp engineering", "engineering manager", "tech lead", "head of engineering"],
  "29-1216": ["hospitalist", "internist", "general practitioner", "gp", "doctor", "medical doctor"],
  "29-1214": ["psychiatrist", "mental health physician"],
  "29-1215": ["family medicine", "family physician"],
  "29-1141": ["rn", "registered nurse", "clinical nurse", "nurse", "nursing", "bedside nurse"],
  "29-1071": ["physician", "doctor", "medical specialist", "attending physician"],
  "29-1123": ["physical therapist", "pt", "physiotherapist", "rehabilitation therapist"],
  "29-1122": ["occupational therapist", "ot"],
  "13-2051": ["financial analyst", "investment analyst", "equity analyst", "portfolio analyst", "buy side analyst"],
  "13-2011": ["accountant", "auditor", "cpa", "accounting"],
  "13-1111": ["business analyst", "ba", "management analyst", "process analyst", "business consultant"],
  "13-1161": ["market research analyst", "marketing analyst", "consumer insights"],
  "17-2141": ["mechanical engineer", "product engineer", "manufacturing engineer", "mech engineer"],
  "17-2051": ["civil engineer", "structural engineer", "construction engineer"],
  "17-2071": ["electrical engineer", "ee", "electronics engineer", "power engineer"],
  "17-2061": ["electronics engineer", "circuit designer", "hardware engineer"],
  "17-2011": ["aerospace engineer", "aeronautical engineer", "aviation engineer"],
  "17-2112": ["industrial engineer", "process improvement", "lean engineer", "operations engineer"],
};

const SEARCH_MODES: Array<{ id: SearchMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "employer", label: "By Employer", icon: Building2 },
  { id: "role", label: "By Role", icon: BriefcaseBusiness },
];

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------

function LoadingSkeletons() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-16 rounded-2xl bg-white/[0.04]" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-white/[0.04]" />)}
      </div>
      <div className="h-80 rounded-2xl bg-white/[0.04]" />
    </div>
  );
}

function EmptyStateRole({ onQuickPick }: { onQuickPick: (soc: SocOption) => void }) {
  return (
    <FadeIn>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
          Popular Occupations
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {POPULAR_SOCS.map((soc) => (
            <button
              key={soc.code}
              onClick={() => onQuickPick(soc)}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04] transition-all text-left group"
            >
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">{soc.title}</p>
                <p className="text-xs text-[var(--muted-foreground)] font-mono">{soc.code}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </FadeIn>
  );
}

function EmptyStateEmployer({
  onQuickPick,
  availableEmployers,
}: {
  onQuickPick: (name: string) => void;
  availableEmployers: string[];
}) {
  const picks = POPULAR_EMPLOYERS.filter((e) =>
    availableEmployers.some((a) => a.toUpperCase().includes(e.split(" ")[0].toUpperCase()))
  ).slice(0, 8);
  const display = picks.length >= 4 ? picks : availableEmployers.slice(0, 8);
  return (
    <FadeIn>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
          Top H-1B Sponsors
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {display.map((name) => (
            <button
              key={name}
              onClick={() => onQuickPick(name)}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04] transition-all text-left group"
            >
              <p className="text-sm font-medium text-[var(--foreground)] truncate pr-2">{name}</p>
              <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </FadeIn>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WageIntelligenceHub() {
  // ── Data state ────────────────────────────────────────────────────────────
  const [national, setNational] = useState<SalaryBenchmark[]>([]);
  const [states, setStates] = useState<SalaryBenchmark[]>([]);
  const [market, setMarket] = useState<SocSalaryMarket[]>([]);
  const [rankings, setRankings] = useState<EmployerWageRanking[]>([]);
  const [trends, setTrends] = useState<EmployerSalaryTrend[]>([]);
  const [searchIndex, setSearchIndex] = useState<EmployerSearchIndex[]>([]);
  const [roleProfiles, setRoleProfiles] = useState<EmployerWageRanking[]>([]);
  const [roleTrends, setRoleTrends] = useState<EmployerRoleTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // ── Search / selection state ──────────────────────────────────────────────
  const [searchMode, setSearchMode] = useState<SearchMode>("employer");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ label: string; sub?: string }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedEmployer, setSelectedEmployer] = useState<string | null>(null);
  const [selectedSoc, setSelectedSoc] = useState<SocOption | null>(null);
  const [visaType, setVisaType] = useState<VisaType>("H-1B");
  const [activeTab, setActiveTab] = useState<ActiveTab>("trend");

  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const socFuseRef = useRef<Fuse<SocOption> | null>(null);
  const employerFuseRef = useRef<Fuse<string> | null>(null);

  // ── Load data on mount ────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [nat, sts, mkt, rnk, trd, searchIdx, rolePro, roleTrd] = await Promise.all([
          loadSalaryBenchmarksNational(),
          loadSalaryBenchmarksStates(),
          loadSocSalaryMarket(),
          loadEmployerWageRankings(),
          loadEmployerSalaryTrend(),
          loadEmployerSearchIndex(),
          loadEmployerRoleProfiles(),
          loadEmployerRoleTrends(),
        ]);
        setNational(nat);
        setStates(sts);
        setMarket(mkt);
        setRankings(rnk);
        setTrends(trd);
        setSearchIndex(searchIdx);
        setRoleProfiles(rolePro);
        setRoleTrends(roleTrd);

        // Build job category Fuse index — enriched with role aliases for better discoverability.
        // Searching "backend engineer" or "web developer" surfaces "Software Developers (15-1252)".
        const socList = getSocList(mkt).map((soc) => ({
          ...soc,
          aliases: ROLE_ALIASES[soc.code] ?? [],
        }));
        socFuseRef.current = new Fuse(socList, {
          keys: [
            { name: "title", weight: 0.7 },
            { name: "aliases", weight: 0.3 },
          ],
          threshold: 0.35,
          minMatchCharLength: 2,
          ignoreLocation: true,
        });

        // Build Employer Fuse index from FULL search index (402K+ employers, no cutoff)
        const empList = searchIdx.map((e) => e.employer_name);
        employerFuseRef.current = new Fuse(empList, {
          threshold: 0.25,
          minMatchCharLength: 2,
          ignoreLocation: true,
        });
      } catch (e) {
        setError("Failed to load wage data. Please try refreshing.");
        console.error("[WageHub] load error", e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const profile = secureGet<UserProfile>("profile");
    if (profile?.wageOffered && profile.wageOffered > 0) setUserProfile(profile);
  }, []);

  // ── Employer list for empty-state quick picks (all 402K+ employers) ────────
  const allEmployers = useMemo(() => searchIndex.map((e) => e.employer_name), [searchIndex]);

  // ── Search handler ────────────────────────────────────────────────────────
  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (!q.trim()) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }
      
      if (searchMode === "employer" && employerFuseRef.current) {
        // Search full employer list (402K+) with no cutoff
        const fuseResults = employerFuseRef.current.search(q).slice(0, 20);
        
        // Enrich with wage data for smart sorting
        const enriched = fuseResults.map((r) => {
          const name = r.item;
          const empData = searchIndex.find((e) => e.employer_name === name);
          return {
            item: {
              employer_name: name,
              total_filings: empData?.total_filings ?? 0,
              latest_median_salary: empData?.latest_median_salary ?? 0,
            },
            refIndex: r.refIndex,
            score: r.score,
          };
        });
        
        // Smart sort by relevance + volume + salary
        const sorted = sortWageEmployerResults(enriched, q).slice(0, 8);
        const results = sorted.map((emp) => ({ label: emp.employer_name }));
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } else if (searchMode === "role" && socFuseRef.current && market.length > 0) {
        const fuseResults = socFuseRef.current.search(q).slice(0, 20); // Get more for better re-scoring
        
        // Enrich with market data for smart sorting
        const enriched = fuseResults.map((r) => {
          const soc = r.item;
          const marketData = market.find((m) => m.soc_code === soc.code);
          return {
            item: {
              code: soc.code,
              title: soc.title,
              n_filings: marketData?.total_filings ?? 0, // JSON field is total_filings, not n_filings
              median_salary: marketData?.market_median ?? 0,
            },
            refIndex: r.refIndex,
            score: r.score,
          };
        });
        
        // Smart sort by relevance + demand + salary
        const sorted = sortSocResults(enriched, q).slice(0, 8);
        const results = sorted.map((soc) => ({
          label: soc.title,
          sub: soc.code,
        }));
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      }
    },
    [searchMode, market, searchIndex]
  );

  // Re-run search when mode switches
  useEffect(() => {
    if (searchQuery) handleSearch(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMode]);

  // ── Selection handlers ────────────────────────────────────────────────────
  const selectEmployer = useCallback((name: string) => {
    setSelectedEmployer(name);
    setSelectedSoc(null);
    setSearchQuery(name);
    setShowDropdown(false);
  }, []);

  const selectSoc = useCallback((soc: SocOption) => {
    setSelectedSoc(soc);
    setSelectedEmployer(null);
    setSearchQuery(soc.title);
    setShowDropdown(false);
    setActiveTab("trend");
  }, []);

  const clearAll = useCallback(() => {
    setSelectedEmployer(null);
    setSelectedSoc(null);
    setSearchQuery("");
    setShowDropdown(false);
    searchRef.current?.focus();
  }, []);

  const handleResultClick = useCallback(
    (result: { label: string; sub?: string }) => {
      if (searchMode === "employer") {
        selectEmployer(result.label);
      } else if (result.sub) {
        selectSoc({ code: result.sub, title: result.label });
      }
    },
    [searchMode, selectEmployer, selectSoc]
  );

  const switchModeAndClear = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    setSelectedEmployer(null);
    setSelectedSoc(null);
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
    setTimeout(() => searchRef.current?.focus(), 10);
  }, []);

  // ── Click outside to close dropdown ──────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current && !searchRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Derived values for selected job category ─────────────────────────────
  const socCode = selectedSoc?.code ?? "";
  const latestMarket = useMemo(
    () => (socCode ? getLatestMarket(market, socCode, visaType) : null),
    [market, socCode, visaType]
  );
  const yoyGrowth = useMemo(
    () => (socCode ? getYoyGrowth(market, socCode, visaType) : null),
    [market, socCode, visaType]
  );
  const nationalBenchmark = useMemo(
    () => (socCode ? getNationalBenchmark(national, socCode) : null),
    [national, socCode]
  );
  const topStates = useMemo(
    () => (socCode ? getTopStates(states, socCode) : []),
    [states, socCode]
  );
  const activeEmployers = useMemo(
    // Use the pre-aggregated unique-employer count from soc_salary_market (n_employers field),
    // NOT the row count in employer_wage_rankings which is capped at 25 rows per SOC/year.
    () => latestMarket?.n_employers ?? 0,
    [latestMarket]
  );
  const userPercentile = useMemo(() => {
    if (!userProfile?.wageOffered || !nationalBenchmark) return null;
    return computePercentile(nationalBenchmark, userProfile.wageOffered);
  }, [userProfile, nationalBenchmark]);
  const marketTrendData = useMemo(
    () => market.filter((m) => m.soc_code === socCode),
    [market, socCode]
  );
  const socGroupStats = useMemo(
    () => getSocGroupStats(rankings, national),
    [rankings, national]
  );

  const isSelected = selectedEmployer !== null || selectedSoc !== null;
  const placeholder =
    searchMode === "employer"
      ? "Search by company name (e.g. Google, Amazon, Deloitte, Infosys)…"
      : "Search by job title (e.g. Software Developer, Data Scientist, Nurse)…";

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeletons />;

  if (error) {
    return (
      <GlassCard variant="elevated" padding="lg">
        <div className="text-center py-8">
          <p className="text-rose-400 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Retry
          </button>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Hero + Dual-mode Search ──────────────────────────────────────── */}
      <FadeIn className="relative z-[100]">
        <GlassCard variant="accent" padding="lg">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Wage Intelligence Hub
              </h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                H-1B &amp; PERM salary benchmarks · {formatCompact(market.length)} market records · FY2008–2025
              </p>
            </div>

            {/* Search bar with mode tabs */}
            <div className="relative">
              <div className="flex items-center gap-0 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:border-white/[0.2] focus-within:border-blue-500/50 transition-all overflow-hidden">

                {/* Mode tabs inline */}
                <div className="flex shrink-0 border-r border-white/[0.10]">
                  {SEARCH_MODES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => switchModeAndClear(id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-3 text-xs font-semibold transition-all whitespace-nowrap",
                        searchMode === id
                          ? "text-blue-300 bg-blue-500/10"
                          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/[0.04]"
                      )}
                      aria-pressed={searchMode === id}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:block">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Text input */}
                <div className="flex flex-1 items-center gap-2 px-4">
                  <Search className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => searchQuery && searchResults.length > 0 && setShowDropdown(true)}
                    placeholder={placeholder}
                    className="flex-1 bg-transparent py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
                    aria-label={placeholder}
                    aria-expanded={showDropdown}
                    aria-autocomplete="list"
                    role="combobox"
                  />
                  {isSelected && (
                    <button
                      onClick={clearAll}
                      className="h-5 w-5 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
                      aria-label="Clear selection"
                    >
                      <X className="h-3 w-3 text-[var(--muted-foreground)]" />
                    </button>
                  )}
                </div>
              </div>

              {/* Dropdown results */}
              <AnimatePresence>
                {showDropdown && searchResults.length > 0 && (
                  <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-2 z-[9999] rounded-xl border border-white/[0.15] bg-[var(--background)]/95 backdrop-blur-2xl shadow-2xl overflow-y-auto max-h-96"
                    role="listbox"
                  >
                    {searchResults.map((result, i) => (
                      <button
                        key={`${result.label}-${i}`}
                        onClick={() => handleResultClick(result)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.06] transition-colors text-left"
                        role="option"
                      >
                        {searchMode === "employer" ? (
                          <Building2 className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                        ) : (
                          <Briefcase className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--foreground)] truncate">
                            {result.label}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] shrink-0" />
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Visa type toggle — only show when job category is selected */}
            {selectedSoc && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted-foreground)]">Visa type:</span>
                {(["H-1B", "PERM"] as const).map((vt) => (
                  <button
                    key={vt}
                    onClick={() => setVisaType(vt)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      visaType === vt
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-transparent hover:border-white/[0.08]"
                    )}
                  >
                    {vt}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <Info className="h-3 w-3" />
                  <span className="truncate max-w-[200px]" title={`SOC ${socCode}`}>{selectedSoc.title}</span>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </FadeIn>

      {/* ── JOB CATEGORY SELECTED — Market detail view ────────────────────── */}
      {selectedSoc && (
        <GlassCard variant="default" padding="lg">
          <div className="space-y-8">
            <AnimatePresence>
            {userProfile?.wageOffered && nationalBenchmark && userPercentile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: EASING }}
              >
                <GlassCard variant="elevated" padding="md" glow>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                        <Briefcase className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Your Offer</p>
                        <p className="text-2xl font-mono font-bold text-[var(--foreground)]">
                          {formatCurrency(userProfile.wageOffered)}
                        </p>
                      </div>
                    </div>
                    <div className="sm:border-l sm:border-white/[0.08] sm:pl-4 flex items-center gap-3 flex-wrap">
                      <span className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-semibold border",
                        userPercentile.pct >= 75
                          ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                          : userPercentile.pct >= 50
                          ? "bg-blue-400/10 text-blue-400 border-blue-400/20"
                          : "bg-amber-400/10 text-amber-400 border-amber-400/20"
                      )}>
                        {userPercentile.label}
                      </span>
                      {latestMarket && latestMarket.market_median > 0 && (
                        <span className="text-sm text-[var(--muted-foreground)]">
                          vs market median{" "}
                          <span className={cn(
                            "font-mono font-semibold",
                            userProfile.wageOffered >= latestMarket.market_median ? "text-emerald-400" : "text-amber-400"
                          )}>
                            {userProfile.wageOffered >= latestMarket.market_median ? "+" : ""}
                            {formatCurrency(userProfile.wageOffered - latestMarket.market_median)}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="sm:ml-auto text-xs text-[var(--muted-foreground)] flex items-center gap-1.5">
                      <Info className="h-3 w-3" />
                      From your /setup profile
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>

          <StaggerContainer>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StaggerItem>
                <StatCard
                  label="Market Median"
                  value={latestMarket?.market_median ?? 0}
                  displayValue={latestMarket?.market_median ? formatCurrency(latestMarket.market_median) : "—"}
                  icon={DollarSign}
                  trend={yoyGrowth !== null ? { value: yoyGrowth, label: "YoY" } : undefined}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Top Quartile (P75)"
                  value={latestMarket?.market_p75 ?? 0}
                  displayValue={latestMarket?.market_p75 ? formatCurrency(latestMarket.market_p75) : "—"}
                  icon={TrendingUp}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="YoY Wage Growth"
                  value={yoyGrowth !== null ? Math.abs(yoyGrowth) : 0}
                  displayValue={yoyGrowth !== null ? `${yoyGrowth >= 0 ? "+" : ""}${yoyGrowth.toFixed(1)}%` : "—"}
                  icon={yoyGrowth !== null && yoyGrowth >= 0 ? TrendingUp : TrendingDown}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  label="Active Employers"
                  value={activeEmployers}
                  format={(n) => formatNumber(n)}
                  icon={Users}
                />
              </StaggerItem>
            </div>
          </StaggerContainer>

          <div className="flex items-center gap-1 p-1 rounded-xl border border-white/[0.08] bg-white/[0.02] w-fit flex-wrap">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === id
                    ? "bg-blue-500/20 text-blue-300 shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/[0.04]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASING }}
            >
              {activeTab === "trend" && (
                <GlassCard variant="elevated" padding="lg">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--foreground)]">10-Year Wage Trend</h3>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        {selectedSoc.title} · {visaType} · Median salary with middle 50% range
                      </p>
                    </div>
                    <MarketTrendChart data={marketTrendData} visaType={visaType} userWage={userProfile?.wageOffered} />
                  </div>
                </GlassCard>
              )}
              {activeTab === "distribution" && (
                <GlassCard variant="elevated" padding="lg">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--foreground)]">Salary Distribution</h3>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        BLS OEWS national percentiles · {selectedSoc.title}
                      </p>
                    </div>
                    {nationalBenchmark ? (
                      <>
                        <PercentileLadder benchmark={nationalBenchmark} userWage={userProfile?.wageOffered} />
                        <div className="grid grid-cols-5 gap-2 pt-2 border-t border-white/[0.06]">
                          {(["p10", "p25", "median", "p75", "p90"] as const).map((key) => (
                            <div key={key} className="text-center">
                              <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-semibold">
                                {{ p10: "10th", p25: "25th", median: "Median", p75: "75th", p90: "90th" }[key] ?? key}
                              </p>
                              <p className="text-sm font-mono font-bold text-[var(--foreground)] mt-1">
                                {formatCurrency(nationalBenchmark[key])}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] pt-1">
                          <Info className="h-3 w-3" />
                          Source: U.S. Bureau of Labor Statistics · Annual wages
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center py-12">
                        <p className="text-sm text-[var(--muted-foreground)]">
                          No national benchmark data for this occupation
                        </p>
                      </div>
                    )}
                  </div>
                </GlassCard>
              )}
              {activeTab === "employers" && (
                <GlassCard variant="elevated" padding="none">
                  <div className="p-6 pb-2 border-b border-white/[0.06]">
                    <h3 className="text-base font-semibold text-[var(--foreground)]">Top Paying Employers</h3>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      Ranked by median {visaType} salary · FY2025 · Click row to expand trend
                    </p>
                  </div>
                  <EmployerWageTable rankings={rankings} trends={trends} socCode={socCode} visaType={visaType} />
                </GlassCard>
              )}
              {activeTab === "regional" && (
                <GlassCard variant="elevated" padding="lg">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--foreground)]">Top Paying States</h3>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        {selectedSoc.title} · Median salary by state · BLS OEWS
                      </p>
                    </div>
                    <RegionalBreakdown states={topStates} />
                  </div>
                </GlassCard>
              )}
            </motion.div>
          </AnimatePresence>

          {socGroupStats.length > 0 && (
            <GlassCard variant="default" padding="md">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">
                Market Context — {selectedSoc.title} vs Related Job Categories
              </p>
              <div className="space-y-2">
                {socGroupStats.slice(0, 6).map((g) => {
                  const isHighlighted = selectedSoc.code.startsWith(g.group_code);
                  const pct = latestMarket?.market_median
                    ? ((g.median - latestMarket.market_median) / latestMarket.market_median) * 100
                    : 0;
                  return (
                    <div key={g.group_code} className="flex items-center gap-3">
                      <div className={cn("w-1 h-8 rounded-full", isHighlighted ? "bg-blue-400" : "bg-white/20")} />
                      <span className={cn("flex-1 text-sm truncate", isHighlighted ? "text-blue-300 font-medium" : "text-[var(--muted-foreground)]")}>
                        {g.group_title}
                      </span>
                      <span className="text-xs font-mono text-[var(--foreground)]">{formatCurrency(g.median)}</span>
                      <span className={cn("text-[10px] font-mono w-14 text-right", pct > 5 ? "text-emerald-400" : pct < -5 ? "text-rose-400" : "text-[var(--muted-foreground)]")}>
                        {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}
            </div>
          </GlassCard>
      )}

      {/* ── EMPTY STATE — nothing selected ──────────────────────────────── */}
      {!selectedEmployer && !selectedSoc && (
        <FadeIn>
          {searchMode === "employer" ? (
            <EmptyStateEmployer onQuickPick={selectEmployer} availableEmployers={allEmployers} />
          ) : (
            <EmptyStateRole onQuickPick={selectSoc} />
          )}
        </FadeIn>
      )}

      {/* ── EMPLOYER SELECTED — Profile view ──────────────────────────── */}
      {selectedEmployer && (
        <div className="space-y-6">
          <FadeIn>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)]">{selectedEmployer}</h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  H-1B salary history · Top roles ranked by latest fiscal year
                </p>
              </div>
            </div>
          </FadeIn>
          <EmployerProfile
            employerName={selectedEmployer}
            trend={trends}
            rankings={rankings}
            roleProfiles={roleProfiles}
            roleTrends={roleTrends}
            visaType="H-1B"
          />
        </div>
      )}

    </div>
  );
}
