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

export async function loadEmployerSalaryTrend(): Promise<EmployerSalaryTrend[]> {
  const raw = await loadDashboardData('wage', 'employer_salary_trend') as EmployerSalaryTrend[];
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

/** Get market trend series for a SOC + visa type, sorted by year. */
export function getMarketTrend(
  market: SocSalaryMarket[],
  socCode: string,
  visaType: string = 'H-1B'
): SocSalaryMarket[] {
  return market
    .filter((m) => m.soc_code === socCode && m.visa_type === visaType)
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
 * Returns null if not enough history.
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
  return Math.round(((latest.market_median - prior.market_median) / prior.market_median) * 1000) / 10;
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

/** Compute growth statistics for a single employer. */
export function computeEmployerGrowth(
  trend: EmployerSalaryTrend[],
  employerName: string,
  visaType = 'H-1B'
): EmployerGrowthStats | null {
  const series = getEmployerTrend(trend, employerName, visaType);
  if (series.length === 0) return null;

  const latest = series[series.length - 1];
  const latestMedian = latest.median_salary;
  const latestYear = latest.fiscal_year;

  // YoY: compare last two years
  let yoy_latest: number | null = null;
  if (series.length >= 2) {
    const prior = series[series.length - 2];
    if (prior.median_salary > 0) {
      yoy_latest = Math.round(((latestMedian - prior.median_salary) / prior.median_salary) * 1000) / 10;
    }
  }

  // 5-yr CAGR: find row y-5
  let cagr_5yr: number | null = null;
  const base5 = series.find((r) => r.fiscal_year === latestYear - 5);
  if (base5 && base5.median_salary > 0) {
    cagr_5yr = Math.round(((Math.pow(latestMedian / base5.median_salary, 1 / 5) - 1) * 100) * 10) / 10;
  }

  // Streak: consecutive years of salary increases ending at latest
  let streak = 0;
  for (let i = series.length - 1; i >= 1; i--) {
    if (series[i].median_salary > series[i - 1].median_salary) streak++;
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

/** All SOC roles for a given employer from the rankings table (FY latest). */
export function getEmployerRoles(
  rankings: EmployerWageRanking[],
  employerName: string
): EmployerWageRanking[] {
  return rankings
    .filter((r) => r.employer_name === employerName)
    .sort((a, b) => b.n_filings - a.n_filings);
}

/**
 * Compute YoY % annotations for each year in a series.
 * Returns the series with an added `yoy_pct` field.
 */
export function annotateWithYoy(
  series: EmployerSalaryTrend[]
): Array<EmployerSalaryTrend & { yoy_pct: number | null }> {
  return series.map((row, i) => {
    if (i === 0) return { ...row, yoy_pct: null };
    const prior = series[i - 1].median_salary;
    if (!prior) return { ...row, yoy_pct: null };
    return {
      ...row,
      yoy_pct: Math.round(((row.median_salary - prior) / prior) * 1000) / 10,
    };
  });
}
