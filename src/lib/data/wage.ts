import { loadDashboardData } from './loader';

// ---------------------------------------------------------------------------
// Raw artifact types
// ---------------------------------------------------------------------------

export interface SalaryBenchmark {
  soc_code: string;
  soc_title: string;
  area_code: string;
  area_title: string;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
}

export interface SocSalaryMarket {
  soc_code: string;
  soc_title: string;
  fiscal_year: number;
  visa_type: string; // "H-1B" | "PERM"
  market_mean: number;
  market_median: number;
  market_p25: number;
  market_p75: number;
  n_filings?: number;
}

export interface EmployerWageRanking {
  soc_code: string;
  soc_title: string;
  employer_name: string;
  fiscal_year: number;
  n_filings: number;
  mean_salary: number;
  median_salary: number;
  p25_salary: number;
  p75_salary: number;
  prevailing_wage_median: number;
  wage_premium_pct: number;
  wage_vs_pw_pct: number;
  oews_national_median: number;
  visa_type: string;
  job_title_top?: string;
  worksite_state_top?: string;
}

export interface EmployerSalaryTrend {
  employer_name: string;
  fiscal_year: number;
  visa_type: string;
  mean_salary: number;
  median_salary: number;
  total_filings?: number;
  n_soc_codes?: number;
  employer_id?: string | number;
}

export interface EmployerSearchIndex {
  employer_name: string;
  total_filings: number;
  n_soc_codes: number;
  latest_median_salary: number;
  latest_year: number;
}

// ---------------------------------------------------------------------------
// Data quality thresholds
// ---------------------------------------------------------------------------

/**
 * Sanity bounds applied throughout the wage analytics layer.
 * Guards against DOL data artifacts (zero/low salaries from rounding errors),
 * low-volume anomalies that inflate growth rates, and impossible year-over-year
 * swings that distort rankings.
 */
export const WAGE_SANITY = {
  /** Annual salary floor — below this is almost certainly a DOL data artifact */
  SALARY_FLOOR: 30_000,
  /** Annual salary ceiling — beyond this is excluded from growth calculations */
  SALARY_CEILING: 600_000,
  /** Max plausible 5-year annualized growth rate (25%/yr ≈ salary triples in 5 yrs) */
  CAGR_MAX_PCT: 25,
  /** Min plausible 5-year annualized change (−10%/yr) */
  CAGR_MIN_PCT: -10,
  /** Max single-year salary jump before treating as a data artifact */
  YOY_MAX_PCT: 40,
  /** Min single-year salary change before treating as a data artifact */
  YOY_MIN_PCT: -30,
  /** Minimum employer filings for a ranking row to be shown */
  MIN_FILINGS_RANKING: 5,
  /** Minimum filings for a SOC market data point to count in trend charts */
  MIN_FILINGS_MARKET: 10,
} as const;

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

export async function loadSalaryBenchmarksNational(): Promise<SalaryBenchmark[]> {
  const raw = await loadDashboardData('wage', 'salary_benchmarks_national') as SalaryBenchmark[];
  return Array.isArray(raw) ? raw : [];
}

export async function loadSalaryBenchmarksStates(): Promise<SalaryBenchmark[]> {
  const raw = await loadDashboardData('wage', 'salary_benchmarks_states') as SalaryBenchmark[];
  return Array.isArray(raw) ? raw : [];
}

export async function loadSocSalaryMarket(): Promise<SocSalaryMarket[]> {
  const raw = await loadDashboardData('wage', 'soc_salary_market') as SocSalaryMarket[];
  return Array.isArray(raw) ? raw : [];
}

export async function loadEmployerWageRankings(): Promise<EmployerWageRanking[]> {
  const raw = await loadDashboardData('wage', 'employer_wage_rankings') as EmployerWageRanking[];
  return Array.isArray(raw) ? raw : [];
}

/**
 * Employer-centric role breakdown: top 500 H-1B employers × their top 25 roles
 * by filing count. Use this for EmployerProfile's "Top Roles" section instead of
 * loadEmployerWageRankings() which is SOC-centric (top employers per SOC by salary).
 */
export async function loadEmployerRoleProfiles(): Promise<EmployerWageRanking[]> {
  const raw = await loadDashboardData('wage', 'employer_role_profiles') as EmployerWageRanking[];
  return Array.isArray(raw) ? raw : [];
}

export async function loadEmployerSalaryTrend(): Promise<EmployerSalaryTrend[]> {
  const raw = await loadDashboardData('wage', 'employer_salary_trend') as EmployerSalaryTrend[];
  return Array.isArray(raw) ? raw : [];
}

/** Load ALL employers (402K+) for full-text search — no cutoff. */
export async function loadEmployerSearchIndex(): Promise<EmployerSearchIndex[]> {
  const raw = await loadDashboardData('wage', 'employer_search_index') as EmployerSearchIndex[];
  return Array.isArray(raw) ? raw : [];
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/** Get the national benchmark for a specific SOC (latest available). */
export function getNationalBenchmark(
  benchmarks: SalaryBenchmark[],
  socCode: string
): SalaryBenchmark | null {
  return benchmarks.find((b) => b.soc_code === socCode && b.area_code === '99') ?? null;
}

/** Get market trend series for a SOC + visa type, sorted by year.
 * Filters out data points with implausible salary values or insufficient volume.
 */
export function getMarketTrend(
  market: SocSalaryMarket[],
  socCode: string,
  visaType: string = 'H-1B'
): SocSalaryMarket[] {
  return market
    .filter(
      (m) =>
        m.soc_code === socCode &&
        m.visa_type === visaType &&
        m.market_median >= WAGE_SANITY.SALARY_FLOOR &&
        // If filing count is available, require a minimum to avoid noise
        (m.n_filings == null || m.n_filings >= WAGE_SANITY.MIN_FILINGS_MARKET)
    )
    .sort((a, b) => a.fiscal_year - b.fiscal_year);
}

/** Most recent year's market stats for a SOC. */
export function getLatestMarket(
  market: SocSalaryMarket[],
  socCode: string,
  visaType: string = 'H-1B'
): SocSalaryMarket | null {
  const series = getMarketTrend(market, socCode, visaType);
  return series[series.length - 1] ?? null;
}

/**
 * YoY growth % for market median of a SOC.
 * Returns null if there is insufficient history, a gap year between data points,
 * or the computed rate falls outside the credible range.
 */
export function getYoyGrowth(
  market: SocSalaryMarket[],
  socCode: string,
  visaType: string = 'H-1B'
): number | null {
  const series = getMarketTrend(market, socCode, visaType);
  if (series.length < 2) return null;
  const latest = series[series.length - 1];
  const prior = series[series.length - 2];
  if (!prior.market_median || prior.market_median === 0) return null;
  // Require consecutive calendar years — a gap inflates the apparent rate
  if (latest.fiscal_year !== prior.fiscal_year + 1) return null;
  const yoy = Math.round(((latest.market_median - prior.market_median) / prior.market_median) * 1000) / 10;
  // Rates outside this range are almost always data corrections, not real change
  if (yoy > WAGE_SANITY.YOY_MAX_PCT || yoy < WAGE_SANITY.YOY_MIN_PCT) return null;
  return yoy;
}

/**
 * Compute which percentile a given wage falls in, given a national benchmark.
 * Returns a number 0-100, or null if benchmark missing.
 */
export function computePercentile(
  benchmark: SalaryBenchmark,
  wage: number
): { pct: number; label: string } {
  const { p10, p25, median, p75, p90 } = benchmark;
  if (wage >= p90) return { pct: 95, label: 'Top 10%' };
  if (wage >= p75) return { pct: 80, label: 'Top 25%' };
  if (wage >= median) return { pct: 60, label: 'Above median' };
  if (wage >= p25) return { pct: 35, label: 'Below median' };
  if (wage >= p10) return { pct: 15, label: 'Bottom quartile' };
  return { pct: 5, label: 'Bottom 10%' };
}

/** Get top paying states for a SOC code. */
export function getTopStates(
  states: SalaryBenchmark[],
  socCode: string,
  topN: number = 15
): SalaryBenchmark[] {
  return states
    .filter((s) => s.soc_code === socCode)
    .sort((a, b) => b.median - a.median)
    .slice(0, topN);
}

/** Unique list of SOC codes+titles from the market dataset. */
export function getSocList(
  market: SocSalaryMarket[]
): Array<{ code: string; title: string }> {
  const seen = new Map<string, string>();
  for (const m of market) {
    if (!seen.has(m.soc_code) && m.soc_title) seen.set(m.soc_code, m.soc_title);
  }
  return Array.from(seen.entries())
    .map(([code, title]) => ({ code, title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Top-level SOC group overview stats (aggregated by 2-digit SOC family). */
export interface SocGroupStat {
  group_code: string;
  group_title: string;
  median: number;
  employers: number;
}

export function getSocGroupStats(
  rankings: EmployerWageRanking[],
  benchmarks: SalaryBenchmark[]
): SocGroupStat[] {
  // Build national median lookup
  const nationalMap = new Map<string, number>();
  for (const b of benchmarks) {
    if (b.area_code === '99') nationalMap.set(b.soc_code, b.median);
  }

  // Group by 2-digit SOC prefix
  const groups = new Map<string, { title: string; medians: number[]; employers: Set<string> }>();
  for (const r of rankings) {
    const prefix = r.soc_code.slice(0, 2);
    const groupTitle = r.soc_title.includes('-')
      ? r.soc_title.split('-').slice(1).join('-').trim()
      : r.soc_title;
    if (!groups.has(prefix)) groups.set(prefix, { title: groupTitle, medians: [], employers: new Set() });
    const g = groups.get(prefix)!;
    if (r.median_salary > 0) g.medians.push(r.median_salary);
    g.employers.add(r.employer_name);
  }

  return Array.from(groups.entries())
    .map(([code, g]) => ({
      group_code: code,
      group_title: g.title,
      median: g.medians.length > 0 ? Math.round(g.medians.reduce((s, n) => s + n, 0) / g.medians.length) : 0,
      employers: g.employers.size,
    }))
    .filter((g) => g.median > 0)
    .sort((a, b) => b.median - a.median)
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Employer-centric helpers (used by employer search + EmployerProfile)
// ---------------------------------------------------------------------------

export interface EmployerGrowthStats {
  employer_name: string;
  latest_median: number;
  latest_year: number;
  /** 5-year CAGR % from (latest-5yr) to latest — null if <5 years of data */
  cagr_5yr: number | null;
  /** Year-over-year % change latest vs prior year — null if <2 years */
  yoy_latest: number | null;
  /** Consecutive years of median salary increases ending at latest year */
  streak: number;
  total_filings: number;
  n_soc_codes: number;
}

/** Unique employer names sorted by descending FY2025 filing count. */
export function getEmployerList(
  trend: EmployerSalaryTrend[],
  visaType = 'H-1B'
): string[] {
  const byEmp = new Map<string, number>();
  for (const r of trend) {
    if (r.visa_type !== visaType) continue;
    const prev = byEmp.get(r.employer_name) ?? 0;
    if ((r.total_filings ?? 0) > prev) byEmp.set(r.employer_name, r.total_filings ?? 0);
  }
  return Array.from(byEmp.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

/** All yearly rows for a specific employer + visa type, sorted by year. */
export function getEmployerTrend(
  trend: EmployerSalaryTrend[],
  employerName: string,
  visaType = 'H-1B'
): EmployerSalaryTrend[] {
  return trend
    .filter((r) => r.employer_name === employerName && r.visa_type === visaType)
    .sort((a, b) => a.fiscal_year - b.fiscal_year);
}

/** Compute growth statistics for a single employer.
 * Applies data quality filtering before computing any metrics:
 *  - Drops years with salaries outside the plausible range
 *  - Requires consecutive calendar years for YoY (no gap-year inflation)
 *  - Nullifies CAGR and YoY if outside credible bounds
 *  - Only credits streak for consecutive calendar years
 */
export function computeEmployerGrowth(
  trend: EmployerSalaryTrend[],
  employerName: string,
  visaType = 'H-1B'
): EmployerGrowthStats | null {
  const raw = getEmployerTrend(trend, employerName, visaType);
  if (raw.length === 0) return null;

  // Drop years with implausible salary values (DOL data artifacts)
  const series = raw.filter(
    (r) =>
      r.median_salary >= WAGE_SANITY.SALARY_FLOOR &&
      r.median_salary <= WAGE_SANITY.SALARY_CEILING
  );
  if (series.length === 0) return null;

  const latest = series[series.length - 1];
  const latestMedian = latest.median_salary;
  const latestYear = latest.fiscal_year;

  // YoY: require consecutive calendar years — a year gap inflates the apparent rate
  let yoy_latest: number | null = null;
  if (series.length >= 2) {
    const prior = series[series.length - 2];
    if (prior.median_salary > 0 && latest.fiscal_year === prior.fiscal_year + 1) {
      const raw_yoy = Math.round(((latestMedian - prior.median_salary) / prior.median_salary) * 1000) / 10;
      // Clamp to credible range — outliers are usually data corrections or re-filings
      if (raw_yoy >= WAGE_SANITY.YOY_MIN_PCT && raw_yoy <= WAGE_SANITY.YOY_MAX_PCT) {
        yoy_latest = raw_yoy;
      }
    }
  }

  // 5-yr CAGR: require the exact base year AND both endpoints within salary range
  let cagr_5yr: number | null = null;
  const base5 = series.find((r) => r.fiscal_year === latestYear - 5);
  if (base5 && base5.median_salary >= WAGE_SANITY.SALARY_FLOOR) {
    const raw_cagr = Math.round(((Math.pow(latestMedian / base5.median_salary, 1 / 5) - 1) * 100) * 10) / 10;
    // Rates outside this band almost always reflect a bad base-year value
    if (raw_cagr >= WAGE_SANITY.CAGR_MIN_PCT && raw_cagr <= WAGE_SANITY.CAGR_MAX_PCT) {
      cagr_5yr = raw_cagr;
    }
  }

  // Streak: only count consecutive calendar years of median salary increases
  let streak = 0;
  for (let i = series.length - 1; i >= 1; i--) {
    if (
      series[i].fiscal_year === series[i - 1].fiscal_year + 1 &&
      series[i].median_salary > series[i - 1].median_salary
    ) streak++;
    else break;
  }

  return {
    employer_name: employerName,
    latest_median: latestMedian,
    latest_year: latestYear,
    cagr_5yr,
    yoy_latest,
    streak,
    total_filings: latest.total_filings ?? 0,
    n_soc_codes: latest.n_soc_codes ?? 0,
  };
}

/**
 * Top N employers sorted by 5-year CAGR.
 * Requires at least `minYears` of data and `minFilings` in latest year.
 */
export function getTopWageGrowers(
  trend: EmployerSalaryTrend[],
  visaType = 'H-1B',
  topN = 15,
  minYears = 5,
  minFilings = 30
): EmployerGrowthStats[] {
  const employers = getEmployerList(trend, visaType);
  const results: EmployerGrowthStats[] = [];

  for (const name of employers) {
    const series = getEmployerTrend(trend, name, visaType);
    if (series.length < minYears) continue;
    if ((series[series.length - 1].total_filings ?? 0) < minFilings) continue;
    const stats = computeEmployerGrowth(trend, name, visaType);
    if (stats?.cagr_5yr != null) results.push(stats);
  }

  return results
    .sort((a, b) => (b.cagr_5yr ?? 0) - (a.cagr_5yr ?? 0))
    .slice(0, topN);
}

/** All SOC roles for a given employer from the rankings table.
 * Filters to the latest fiscal year only, optionally by visa type,
 * deduplicates by soc_code (keeps highest-filing row), and requires
 * sufficient filings and a plausible salary value.
 */
export function getEmployerRoles(
  rankings: EmployerWageRanking[],
  employerName: string,
  visaType?: string
): EmployerWageRanking[] {
  const employerRows = rankings.filter(
    (r) =>
      r.employer_name === employerName &&
      (visaType == null || r.visa_type === visaType) &&
      r.n_filings >= WAGE_SANITY.MIN_FILINGS_RANKING &&
      r.median_salary >= WAGE_SANITY.SALARY_FLOOR
  );
  if (employerRows.length === 0) return [];

  // Restrict to the latest fiscal year so stale/lower-count years don't
  // surface irrelevant roles (e.g. a role with 8 filings 3 years ago ranking
  // above current top roles with hundreds of filings).
  const latestYear = Math.max(...employerRows.map((r) => r.fiscal_year));
  const latestRows = employerRows.filter((r) => r.fiscal_year === latestYear);

  // Deduplicate by soc_code — keep the row with the highest n_filings in
  // case the same SOC code appears more than once in the latest year.
  const seen = new Map<string, EmployerWageRanking>();
  for (const row of latestRows) {
    const existing = seen.get(row.soc_code);
    if (!existing || row.n_filings > existing.n_filings) seen.set(row.soc_code, row);
  }

  return Array.from(seen.values()).sort((a, b) => b.n_filings - a.n_filings);
}

/**
 * Compute YoY % annotations for each year in a series.
 * Returns the series with an added `yoy_pct` field.
 * Only annotates consecutive calendar years and clamps to the credible range.
 */
export function annotateWithYoy(
  series: EmployerSalaryTrend[]
): Array<EmployerSalaryTrend & { yoy_pct: number | null }> {
  return series.map((row, i) => {
    if (i === 0) return { ...row, yoy_pct: null };
    const prior = series[i - 1];
    if (!prior.median_salary || prior.median_salary === 0) return { ...row, yoy_pct: null };
    // Skip gap years — the apparent change would be multi-year, not single-year
    if (row.fiscal_year !== prior.fiscal_year + 1) return { ...row, yoy_pct: null };
    const yoy = Math.round(((row.median_salary - prior.median_salary) / prior.median_salary) * 1000) / 10;
    // Suppress implausible swings (usually data corrections or re-classifications)
    if (yoy > WAGE_SANITY.YOY_MAX_PCT || yoy < WAGE_SANITY.YOY_MIN_PCT) return { ...row, yoy_pct: null };
    return { ...row, yoy_pct: yoy };
  });
}
