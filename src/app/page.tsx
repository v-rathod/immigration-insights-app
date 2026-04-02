"use client";

import Link from "next/link";
import {
  Compass,
  BarChart3,
  Globe2,
  Building2,
  TrendingUp,
  ArrowRight,
  Star,
  CalendarClock,
  Briefcase,
  DollarSign,
  Activity,
  Clock,
  CheckCircle,
} from "lucide-react";
import {
  GlassCard,
  StatCard,
  StaggerContainer,
  StaggerItem,
  FadeIn,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { VisaBulletinPulse } from "@/components/home/visa-bulletin-pulse";
import { EmployerQuickCheck } from "@/components/home/employer-quick-check";
import { PdQuickCheck } from "@/components/home/pd-quick-check";
import { FeaturedEmployers } from "@/components/home/featured-employers";
import { WelcomeBackBanner } from "@/components/home/welcome-back-banner";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const HERO_STATS = [
  {
    label: "Data Points",
    value: 18500000,
    displayValue: "18M",
    suffix: "+",
    icon: BarChart3,
    tooltip: "Total government records processed: USCIS H-1B and PERM approvals/denials, DOL LCA certifications and wage surveys, State Dept visa bulletins, and BLS occupational data. Covers 1992 to 2026.",
  },
  {
    label: "Employers Tracked",
    value: 243000,
    displayValue: "240K",
    icon: Building2,
    tooltip: "Unique employer names in our full historical dataset (1992-2026), including legacy employers no longer actively sponsoring. About 60K+ of these have active filings in the last 36 months and appear in the Sponsor Reliability Score search.",
  },
  {
    label: "Countries",
    value: 249,
    icon: Globe2,
    tooltip: "Birth countries represented across employment-based green card applications in USCIS and State Dept records. Drives per-country priority date forecasts and wait-time estimates.",
  },
  {
    label: "Forecast Series",
    value: 56,
    icon: TrendingUp,
    tooltip: "ML-powered priority date forecast timelines, one per EB category and birth country combination. Each series uses historical visa bulletin data and a trained regression model.",
  },
];

/**
 * All dashboards for the explore grid at the bottom.
 */
const DASHBOARDS = [
  {
    title: "Visa Bulletin Trends",
    description:
      "Historical cutoff progression, retrogression patterns, and priority date forecasts",
    href: "/dashboard/visa-bulletin/",
    gradient: "from-blue-500 to-cyan-400",
    icon: CalendarClock,
  },
  {
    title: "Sponsor Reliability Score",
    description:
      "Search any employer and see their SRS: approval rates, wage competitiveness, and risk signals",
    href: "/dashboard/employer/",
    gradient: "from-emerald-500 to-teal-400",
    icon: Building2,
  },
  {
    title: "EB Category Comparison",
    description:
      "EB2 vs EB3 movement velocity, volatility, and wait time analysis",
    href: "/dashboard/eb-category/",
    gradient: "from-purple-500 to-violet-400",
    icon: BarChart3,
  },
  {
    title: "Geographic Heatmaps",
    description:
      "Sponsorship hotspots, filing density, and wage competitiveness by region",
    href: "/dashboard/geographic/",
    gradient: "from-amber-500 to-orange-400",
    icon: Globe2,
  },
  {
    title: "Wage Competitiveness",
    description:
      "See how your salary offer compares to market pay ranges and what top employers actually pay by role and location",
    href: "/dashboard/wage/",
    gradient: "from-rose-500 to-pink-400",
    icon: DollarSign,
  },
  {
    title: "Occupation Demand",
    description:
      "High-demand job types, hiring trends, and wage premiums by occupation",
    href: "/dashboard/job-demand/",
    gradient: "from-indigo-500 to-blue-400",
    icon: Briefcase,
  },
  {
    title: "Processing Speed",
    description:
      "Case processing velocity, I-485 approval trends, and center backlog",
    href: "/dashboard/processing/",
    gradient: "from-teal-500 to-emerald-400",
    icon: Clock,
  },
  {
    title: "Approval & Denial Trends",
    description:
      "19-year PERM approval pulse, administration effects, cross-track comparison, and YoY velocity",
    href: "/dashboard/approvals/",
    gradient: "from-green-500 to-emerald-400",
    icon: CheckCircle,
  },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="space-y-10 pb-8">
      {/* Returning user banner — only renders if profile exists in localStorage */}
      <WelcomeBackBanner />

      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION — Data-First Split Layout
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative -mx-4 -mt-6 sm:-mx-6 lg:-mx-8 overflow-hidden">
        {/* Ambient gradient backdrop */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600/8 via-purple-600/8 to-emerald-600/6 blur-3xl" />
        </div>

        <div className="relative z-10 px-6 pt-8 pb-6 sm:pt-12 sm:pb-10">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
            {/* Left: Headline + CTA */}
            <div className="flex flex-col justify-center">
              <FadeIn delay={0}>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-1.5 backdrop-blur-sm">
                  <Activity className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
                  <span className="font-mono text-[11px] tracking-widest uppercase text-[var(--muted-foreground)]">
                    Live data
                  </span>
                </div>
              </FadeIn>

              <FadeIn delay={0.1}>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  Your green card timeline.{" "}
                  <span className="text-[var(--muted-foreground)]">
                    Your employer&apos;s record.
                  </span>{" "}
                  <span className="gradient-text">Your salary rank.</span>
                </h1>
              </FadeIn>

              <FadeIn delay={0.2}>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
                  Priority date forecasts, employer scores, and wage benchmarks
                  from{" "}
                  <span className="font-mono font-medium text-[var(--foreground)]">
                    18.5M+
                  </span>{" "}
                  official DOL, USCIS, and DOS records. No accounts required.
                </p>
              </FadeIn>

              <FadeIn delay={0.3}>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <Link
                    href="/insights"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Check My Situation
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/dashboard/employer"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)]/50 px-6 py-2.5 text-sm font-medium text-[var(--foreground)] backdrop-blur-sm transition-all duration-300 hover:bg-[var(--muted)]/50 hover:border-[var(--muted-foreground)]/30"
                  >
                    <Building2 className="h-4 w-4" />
                    Look Up an Employer
                  </Link>
                </div>
              </FadeIn>
            </div>

            {/* Right: Live Visa Bulletin Pulse */}
            <FadeIn delay={0.2}>
              <VisaBulletinPulse />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          QUICK-CHECK WIDGETS
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Quick check tools">
        <div className="grid gap-4 sm:grid-cols-2">
          <FadeIn delay={0.1}>
            <EmployerQuickCheck />
          </FadeIn>
          <FadeIn delay={0.2}>
            <PdQuickCheck />
          </FadeIn>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FEATURED EMPLOYERS
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Featured employers">
        <FadeIn>
          <FeaturedEmployers />
        </FadeIn>
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
                tooltip={stat.tooltip}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          EXPLORE THE FULL DATASET
          ═══════════════════════════════════════════════════════════════════ */}
      <section id="dashboards" aria-label="Explore dashboards">
        <FadeIn>
          <div className="mb-5 flex items-center gap-3">
            <Star className="h-5 w-5 text-amber-400" strokeWidth={1.5} />
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Explore the Full Dataset
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                8 interactive dashboards covering every dimension of U.S. employment immigration
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
    </div>
  );
}
