"use client";

import Link from "next/link";
import {
  Compass,
  BarChart3,
  Globe2,
  Building2,
  TrendingUp,
  Search,
  ArrowRight,
  Star,
  Sparkles,
  Shield,
  Zap,
} from "lucide-react";
import {
  GlassCard,
  StatCard,
  StaggerContainer,
  StaggerItem,
  FadeIn,
} from "@/components/ui";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const HERO_STATS = [
  { label: "Data Points", value: 18500000, displayValue: "18.5M", suffix: "+", icon: BarChart3 },
  { label: "Employers Tracked", value: 243000, displayValue: "243K", icon: Building2 },
  { label: "Countries", value: 249, icon: Globe2 },
  { label: "Forecast Series", value: 56, icon: TrendingUp },
];

/**
 * All 8 dashboards — presented equally as an informational catalog.
 * PDI (Visa Bulletin) and SRS (Employer) are promoted in sidebar navigation.
 */
const DASHBOARDS = [
  {
    title: "Visa Bulletin Trends",
    description:
      "Historical cutoff progression, retrogression patterns, and priority date forecasts",
    href: "/dashboard/visa-bulletin/",
    gradient: "from-blue-500 to-cyan-400",
  },
  {
    title: "Sponsor Reliability Score",
    description:
      "Search any employer and see their SRS — approval rates, wage competitiveness, and risk signals",
    href: "/dashboard/employer/",
    gradient: "from-emerald-500 to-teal-400",
  },
  {
    title: "EB Category Comparison",
    description:
      "EB2 vs EB3 movement velocity, volatility, and wait time analysis",
    href: "/dashboard/eb-category/",
    gradient: "from-purple-500 to-violet-400",
  },
  {
    title: "Geographic Heatmaps",
    description:
      "Sponsorship hotspots, filing density, and wage competitiveness by region",
    href: "/dashboard/geographic/",
    gradient: "from-amber-500 to-orange-400",
  },
  {
    title: "Wage Competitiveness",
    description:
      "Compare your offered wage to OEWS percentiles and employer benchmarks",
    href: "/dashboard/wage/",
    gradient: "from-rose-500 to-pink-400",
  },
  {
    title: "SOC Demand",
    description:
      "High-demand occupations, hiring trends, and wage premiums by SOC code",
    href: "/dashboard/soc-demand/",
    gradient: "from-indigo-500 to-blue-400",
  },
  {
    title: "Processing Speed",
    description:
      "Case processing velocity, I-485 approval trends, and center backlog",
    href: "/dashboard/processing/",
    gradient: "from-teal-500 to-emerald-400",
  },
  {
    title: "Backlog Visualization",
    description:
      "Queue position estimates and years-to-clear projections by category",
    href: "/dashboard/backlog/",
    gradient: "from-fuchsia-500 to-purple-400",
  },
];

const VALUE_PROPS = [
  {
    icon: Zap,
    title: "Real-Time Data",
    description: "Powered by 18.5M+ records from DOL, DOS, USCIS, BLS, and DHS",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your data stays in your browser. No accounts, no tracking, no servers",
  },
  {
    icon: Sparkles,
    title: "AI-Powered",
    description: "Pre-computed ML models for forecasts, scores, and recommendations",
  },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="space-y-20 pb-12">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative -mx-4 -mt-6 sm:-mx-6 lg:-mx-8 overflow-hidden">
        {/* Ambient gradient backdrop */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600/8 via-purple-600/8 to-emerald-600/6 blur-3xl" />
          <div className="absolute top-20 right-0 h-[300px] w-[400px] rounded-full bg-gradient-to-l from-rose-600/5 to-transparent blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center px-6 pt-20 pb-16 text-center sm:pt-28 sm:pb-20">
          {/* Badge */}
          <FadeIn delay={0}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-1.5 backdrop-blur-sm">
              <Compass className="h-3.5 w-3.5 text-[var(--accent-blue)]" strokeWidth={2} />
              <span className="font-mono text-[11px] tracking-widest uppercase text-[var(--muted-foreground)]">
                NorthStar Compass
              </span>
            </div>
          </FadeIn>

          {/* Headline */}
          <FadeIn delay={0.1}>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
              Navigate Your{" "}
              <span className="gradient-text">Immigration Journey</span>
              <br />
              <span className="text-[var(--muted-foreground)]">with Confidence</span>
            </h1>
          </FadeIn>

          {/* Subheadline */}
          <FadeIn delay={0.2}>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)] sm:text-lg">
              Personalized insights powered by{" "}
              <span className="font-mono font-medium text-[var(--foreground)]">
                18.5M+
              </span>{" "}
              data points from official government sources.
              Priority date forecasts, employer scores, salary benchmarks —
              all in one place.
            </p>
          </FadeIn>

          {/* CTAs */}
          <FadeIn delay={0.3}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/setup/"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-7 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/ask/"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)]/50 px-7 py-3 text-sm font-medium text-[var(--foreground)] backdrop-blur-sm transition-all duration-300 hover:bg-[var(--muted)]/50 hover:border-[var(--muted-foreground)]/30"
              >
                <Search className="h-4 w-4" />
                Ask a Question
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          STATS BAR
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Key statistics">
        <StaggerContainer className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {HERO_STATS.map((stat) => (
            <StaggerItem key={stat.label}>
              <StatCard
                label={stat.label}
                value={stat.value}
                displayValue={stat.displayValue}
                suffix={stat.suffix}
                icon={stat.icon}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          DASHBOARD GRID
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Dashboards">
        <FadeIn>
          <div className="mb-8 flex items-center gap-3">
            <Star className="h-5 w-5 text-amber-400" strokeWidth={1.5} />
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                8 Interactive Dashboards
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Explore every dimension of the U.S. immigration system
              </p>
            </div>
          </div>
        </FadeIn>

        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DASHBOARDS.map((dash) => (
            <StaggerItem key={dash.href}>
              <Link href={dash.href} className="block h-full">
                <GlassCard
                  variant="interactive"
                  padding="md"
                  className="group relative h-full overflow-hidden"
                >
                  {/* Gradient accent bar */}
                  <div
                    className={cn(
                      "mb-4 h-1 w-10 rounded-full bg-gradient-to-r transition-all duration-500 group-hover:w-16",
                      dash.gradient
                    )}
                  />
                  <h3 className="mb-1.5 text-sm font-semibold text-[var(--foreground)]">
                    {dash.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {dash.description}
                  </p>
                  <ArrowRight className="absolute right-4 bottom-4 h-4 w-4 text-[var(--muted-foreground)] opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0.5" />
                </GlassCard>
              </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          VALUE PROPOSITIONS
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Why Compass">
        <FadeIn>
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Built Different
            </h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              No accounts. No tracking. Your data never leaves your browser.
            </p>
          </div>
        </FadeIn>
        <StaggerContainer className="grid gap-6 sm:grid-cols-3">
          {VALUE_PROPS.map((prop) => (
            <StaggerItem key={prop.title}>
              <GlassCard variant="elevated" padding="lg" className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                  <prop.icon className="h-6 w-6 text-[var(--accent-blue)]" strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 text-base font-semibold">{prop.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {prop.description}
                </p>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>
    </div>
  );
}
