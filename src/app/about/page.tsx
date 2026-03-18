/**
 * About Page — The story behind NorthStar Compass.
 *
 * Route: /about
 */
"use client";

import Link from "next/link";
import {
  Compass,
  Heart,
  Code2,
  Database,
  Globe2,
  Users,
  ArrowRight,
  Github,
  Mail,
  Sparkles,
  BookOpen,
  BarChart3,
  Shield,
} from "lucide-react";
import {
  GlassCard,
  FadeIn,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui";
import { ContactButton } from "@/components/ui/contact-modal";
import { TechStackChip } from "@/components/about/tech-stack-chip";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const TECH_STACK = [
  // --- P3: Compass (Frontend) ---
  {
    label: "Next.js 16",
    detail: "Static export (zero backend)",
    explanation: "Compass is a statically-exported Next.js app with no runtime servers. All 16 pages are pre-rendered as HTML/CSS/JS and served globally via S3 + CloudFront. Zero server cost, infinite scalability, and instant page loads.",
  },
  {
    label: "React 19",
    detail: "Server + client components",
    explanation: "React powers Compass's interactive dashboards, personalization engine, and real-time filtering. Server components reduce JS bundle size; client components handle search, sorting, and localStorage-based preferences.",
  },
  {
    label: "TypeScript 5",
    detail: "Strict mode, full type coverage",
    explanation: "Strict TypeScript across all 75+ Compass source files ensures type safety and catches errors at compile time. Every P2 artifact schema is typed, preventing runtime data mismatches in production.",
  },
  {
    label: "Tailwind CSS 4",
    detail: "Aurora design system",
    explanation: "Tailwind powers the Aurora design system: a dark-first, glassmorphic aesthetic inspired by Linear and Vercel. Zero CSS files, entirely utility-based, enabling rapid iteration on dashboard layouts.",
  },
  {
    label: "shadcn/ui",
    detail: "Radix UI primitives",
    explanation: "Compass uses shadcn/ui's unstyled Radix primitives (Dialog, Select, Tabs, Tooltip) as accessible component foundations. These libraries handle focus management, keyboard navigation, and WCAG compliance.",
  },
  {
    label: "Recharts 2.15",
    detail: "Interactive data visualization",
    explanation: "Recharts renders all 8 Compass dashboards: Priority Date charts, SRS gauges, geographic heatmaps, wage trend lines, and approval rate bars. Built on React, handles responsive resizing and rich tooltips.",
  },
  {
    label: "Framer Motion 12",
    detail: "Purposeful micro-interactions",
    explanation: "Framer Motion animates Compass's staggered card reveals, number tickers, and hover states using a consistent cubic-bezier easing. Every animation communicates state change, never decoration.",
  },
  {
    label: "Fuse.js 7",
    detail: "Client-side fuzzy search",
    explanation: "Fuse.js powers the Compass search experience: fuzzy-match 243K employers, 1,800 job titles, and 341 RAG chunks in the browser with zero network calls. 150ms debounce keeps UX responsive.",
  },
  {
    label: "nuqs 2.4",
    detail: "URL state management",
    explanation: "nuqs keeps Compass dashboard filters (country, category, chart type) in sync with the browser URL, enabling shareable links and back-button navigation without localStorage.",
  },
  {
    label: "PostHog",
    detail: "Product analytics + session recording",
    explanation: "Compass uses PostHog for typed event tracking (dashboardViewed, employerSelected, filterChanged) and session replays to understand user behavior and identify UX bottlenecks.",
  },
  {
    label: "Vitest 4",
    detail: "Unit + component testing",
    explanation: "Vitest runs 586 tests across 25 files: 55 component tests, 18 utility tests, and 513 data loader tests. happy-dom replaces jsdom for lighter ESM compatibility and faster feedback loops.",
  },
  {
    label: "AWS S3 + CloudFront",
    detail: "Static site hosting + CDN",
    explanation: "Compass is deployed to S3 (16 HTML pages, ~160MB data) and cached globally via CloudFront. HTTPS + DNS via Route 53. Total AWS cost: $0.50–3/month.",
  },
  
  // --- ML & AI Models (P2: Meridian) ---
  {
    label: "Scikit-learn",
    detail: "ML models (forecasting, scoring)",
    explanation: "Meridian uses Scikit-learn's RandomForest and LinearRegression for Sponsor Reliability Score (SRS) and Priority Date forecasts. Models trained on 1.7M PERM filings and 9.6M LCA records.",
  },
  {
    label: "XGBoost",
    detail: "Gradient boosting for SRS ranking",
    explanation: "XGBoost powers Meridian's Sponsor Reliability Score (SRS) model: predicts employer approval likelihood from case history, wages, SOC mix, and geographic diversity. Outperforms linear models in SHAP-based validation.",
  },
  {
    label: "Prophet",
    detail: "Time-series forecasting (priority dates)",
    explanation: "Facebook's Prophet fits Meridian's Priority Date Index (PDI) forecasts: extrapolates 14-year Visa Bulletin trends to predict when each EB category becomes current. Handles seasonality and structural breaks.",
  },
  {
    label: "SHAP",
    detail: "Model explainability & feature importance",
    explanation: "Meridian uses SHAP (SHapley Additive exPlanations) to interpret why an employer scores high/low on SRS and which factors drive priority date movement. Powers the subscore breakdown in Compass.",
  },
  {
    label: "Statsmodels",
    detail: "Time-series & statistical analysis",
    explanation: "Meridian uses Statsmodels for ARIMA models, cointegration tests, and rolling window statistics on approval/denial trends and category velocity. Provides confidence intervals for forecasts.",
  },
  {
    label: "NumPy / SciPy",
    detail: "Numerical computing & algorithms",
    explanation: "Foundation for all Meridian ML pipelines: matrix operations, eigenvalue decomposition, statistical distributions, and optimization algorithms powering forecasting and scoring models.",
  },
  
  // --- Data Pipeline & Infrastructure ---
  {
    label: "Python 3.11",
    detail: "Data processing & modeling",
    explanation: "Horizon (data collection layer) uses Python scrapers and APIs; Meridian (analytics layer) transforms it into 46 artifact tables using pandas, statsmodels, and scikit-learn. Fast, mature, and ML-friendly.",
  },
  {
    label: "Pandas / Polars",
    detail: "Data manipulation",
    explanation: "Horizon uses Pandas to parse PERM/LCA/BLS CSV feeds; Meridian uses Polars for fast in-memory transforms on 18.5M+ rows. Both support groupby, rolling windows, and time-series resampling.",
  },
  {
    label: "DuckDB",
    detail: "OLAP queries on Parquet",
    explanation: "Meridian uses DuckDB's SQL engine to query 17.4M-row Parquet fact tables directly without loading into memory. Enables complex joins and aggregations at scale.",
  },
  {
    label: "Apache Parquet",
    detail: "Columnar data format",
    explanation: "All Meridian artifacts are stored as Parquet: compressed, columnar, and queryable. Synced to Compass as optimized JSON slices (160MB → browser, 0 runtime compute).",
  },
  {
    label: "PyArrow",
    detail: "In-memory data interchange",
    explanation: "PyArrow enables fast zero-copy data transfer between Pandas, DuckDB, and Parquet in Meridian. Improves pipeline throughput and reduces memory footprint during transforms.",
  },
  {
    label: "pytest",
    detail: "Data pipeline testing",
    explanation: "Meridian (analytics) runs 562 pytest cases validating data integrity: canonical employer names, NaN handling, fiscal-year filtering, and cross-artifact consistency before syncing to Compass.",
  },
  
  // --- Data Collection (Horizon) ---
  {
    label: "APScheduler / Cron",
    detail: "Scheduled data collection",
    explanation: "Horizon uses APScheduler to run daily/weekly collection jobs: querying DOL PERM APIs, parsing State Department Visa Bulletin PDFs, polling BLS CES databases, and parsing USCIS reports.",
  },
  {
    label: "requests / httpx",
    detail: "HTTP API clients",
    explanation: "Horizon fetches data via requests (DOL, DHS, BLS APIs) and httpx (async State Dept scraping). Both handle retries, authentication, and rate limiting gracefully.",
  },
  {
    label: "BeautifulSoup4 / Selenium",
    detail: "Web scraping & parsing",
    explanation: "BeautifulSoup4 parses HTML tables from State Dept Visa Bulletin and DHS reports; Selenium handles JavaScript-heavy pages (ACS Census) that require browser automation.",
  },
  {
    label: "PDFMiner",
    detail: "PDF document extraction",
    explanation: "PDFMiner extracts text and tables from unstructured USCIS and State Department PDF reports. Handles multi-page documents, text layout preservation, and OCR fallbacks.",
  },
  {
    label: "MLflow",
    detail: "ML experiment tracking",
    explanation: "Meridian logs model parameters, training metrics, and artifact versions in MLflow. Enables reproducible model selection and A/B testing of forecasting/scoring algorithms.",
  },
];

const DATA_SOURCES = [
  {
    name: "Dept. of Labor (DOL)",
    description: "1.7M employer sponsorship records + 9.6M work visa applications including job classifications, wages, and approval rates",
    icon: Database,
  },
  {
    name: "State Dept. Visa Bulletin",
    description: "14K+ historical priority date cutoffs tracking how the employment-based visa queue moves each month since 2011",
    icon: BarChart3,
  },
  {
    name: "Bureau of Labor Statistics (BLS)",
    description: "446K national wage records for salary benchmarks by job type, geographic area, and income percentile",
    icon: Globe2,
  },
  {
    name: "USCIS",
    description: "Approval/denial trends, processing times, and adjudication data",
    icon: Shield,
  },
  {
    name: "DHS",
    description: "Visa issuance volumes, admission statistics, and policy impacts",
    icon: BookOpen,
  },
];

const PRINCIPLES = [
  {
    icon: Heart,
    title: "Privacy First",
    description:
      "Your data never leaves your browser. No accounts, no tracking, no analytics. All personalization runs client-side using localStorage.",
  },
  {
    icon: Code2,
    title: "Open Source",
    description:
      "Every line of code is open in three repositories: Horizon (data collection), Meridian (analytics), and Compass (this app). All available for review and contribution.",
  },
  {
    icon: Sparkles,
    title: "Free Forever",
    description:
      "Hosted globally on AWS with S3 and CloudFront - fast, reliable, and always accessible. No premium tiers, no paywalls, no ads. Immigration tools shouldn't have a price tag.",
  },
  {
    icon: Users,
    title: "Community Driven",
    description:
      "Built by immigrants, for immigrants. Feature requests, bug reports, and contributions are welcome. Help shape the tools you wish existed.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AboutPage() {
  return (
    <div className="space-y-16">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="About hero">
        <FadeIn>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-500">
              <Compass className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
                NorthStar Compass
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                About This Project
              </h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Built by{" "}
                <a
                  href="https://github.com/v-rathod"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  Vivek Rathod
                </a>
              </p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          THE STORY
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="The story">
        <FadeIn>
          <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden">
            {/* Decorative gradient */}
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 blur-3xl" />

            <div className="relative space-y-6">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-400" strokeWidth={1.5} />
                <h2 className="text-xl font-semibold">The Story</h2>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-[var(--muted-foreground)]">
                <p>
                  I&apos;m a software engineer on the EB immigration path. The data
                  you need to make informed decisions about your case is public,
                  but it&apos;s scattered across DOL, State Dept, BLS, and USCIS
                  websites in formats that aren&apos;t built for individual use.
                </p>
                <p>
                  Compass started as a set of Python scripts I used to track my own
                  priority date and evaluate sponsors. Over time it grew into a full
                  pipeline: 18.5 million records ingested, forecasting models trained,
                  employer reliability scores computed, and everything surfaced through
                  dashboards that work for your specific situation.
                </p>
                <p>
                  It&apos;s open-source, free, and runs entirely in your browser.
                  No accounts, no tracking, no servers. Your profile stays in
                  localStorage and never leaves your device.
                </p>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          THE VISION: NORTHSTAR
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Vision and architecture">
        <FadeIn>
          <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden">
            {/* Decorative gradient */}
            <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 blur-3xl" />

            <div className="relative space-y-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" strokeWidth={1.5} />
                <h2 className="text-xl font-semibold">The Vision: NorthStar</h2>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-[var(--muted-foreground)]">
                <p>
                  <span className="text-[var(--foreground)] font-semibold">NorthStar</span> is the guiding vision for
                  this entire project. Just as a North Star guides sailors across
                  uncertain oceans, this initiative aims to guide immigrants through
                  the complex employment-based visa system with clarity, data, and hope.
                </p>

                <p>
                  To make this vision real, the work is organized into three distinct
                  layers, each with its own meaningful name:
                </p>

                <div className="space-y-3 mt-4 pl-4 border-l-2 border-[var(--border)]">
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)] text-sm">
                      Horizon: The Data Collection Layer
                    </h3>
                    <p className="text-xs">
                      Continuously scans the horizon for new immigration data: scraping
                      government announcements, monitoring visa bulletin changes, and
                      aggregating labor statistics. The foundation that keeps everything current.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-[var(--foreground)] text-sm">
                      Meridian: The Analytics Backbone
                    </h3>
                    <p className="text-xs">
                      The measurement layer that curates raw data into intelligence.
                      Meridian processes 18.5M+ records, trains ML models for predictions,
                      computes employer reliability scores, and synthesizes insights. Like
                      a surveyor using a meridian to map the land, this layer maps the
                      immigration landscape.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-[var(--foreground)] text-sm">
                      Compass: The User Experience
                    </h3>
                    <p className="text-xs">
                      The tool that guides you. Compass takes Meridian&apos;s intelligence
                      and presents it through interactive, personalized dashboards. It&apos;s
                      your compass in this process, helping you make sense of the data
                      and plan with confidence.
                    </p>
                  </div>
                </div>

                <p className="text-xs italic text-[var(--muted-foreground)] pt-2">
                  Together, these three layers form a complete system for understanding
                  employment-based immigration: collecting truth from the horizon,
                  measuring it with precision, and guiding individuals with clarity.
                </p>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          PRINCIPLES
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Principles">
        <FadeIn>
          <h2 className="mb-6 text-xl font-semibold tracking-tight">
            Guiding Principles
          </h2>
        </FadeIn>
        <StaggerContainer className="grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <StaggerItem key={p.title}>
              <GlassCard variant="default" padding="md" className="h-full">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                    <p.icon
                      className="h-5 w-5 text-[var(--accent-blue)]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">{p.title}</h3>
                    <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                      {p.description}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          DATA SOURCES
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Data sources">
        <FadeIn>
          <h2 className="mb-6 text-xl font-semibold tracking-tight">
            Data Sources
          </h2>
          <p className="mb-6 text-sm text-[var(--muted-foreground)]">
            NorthStar processes data from five official U.S. government sources,
            totaling 18.5M+ records across 46 data tables.
          </p>
        </FadeIn>
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DATA_SOURCES.map((src) => (
            <StaggerItem key={src.name}>
              <GlassCard variant="default" padding="md" className="h-full">
                <div className="flex items-start gap-3">
                  <src.icon
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-blue)]"
                    strokeWidth={1.5}
                  />
                  <div>
                    <h3 className="text-sm font-semibold">{src.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                      {src.description}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          ARCHITECTURE / TECH
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Technology">
        <FadeIn>
          <h2 className="mb-2 text-xl font-semibold tracking-tight">
            How It Works
          </h2>
          <p className="mb-6 text-sm text-[var(--muted-foreground)]">
            Three repositories work together as the NorthStar pipeline:
          </p>
        </FadeIn>

        <StaggerContainer className="grid gap-4 sm:grid-cols-3">
          {[
            {
              name: "Horizon",
              role: "Data collection: scans official sources and ingests raw records",
              gradient: "from-cyan-500 to-blue-500",
            },
            {
              name: "Meridian",
              role: "Analytics backbone: curates, measures, models. Produces 46 artifact tables",
              gradient: "from-blue-500 to-purple-500",
            },
            {
              name: "Compass",
              role: "User experience: renders pre-computed JSON into interactive dashboards",
              gradient: "from-purple-500 to-rose-500",
            },
          ].map((repo) => (
            <StaggerItem key={repo.name}>
              <GlassCard variant="elevated" padding="md" className="h-full">
                <div
                  className={cn(
                    "mb-3 h-1 w-10 rounded-full bg-gradient-to-r",
                    repo.gradient
                  )}
                />
                <h3 className="text-base font-semibold">{repo.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {repo.role}
                </p>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <FadeIn>
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold text-[var(--muted-foreground)]">
              Complete Tech Stack
            </h3>
            <p className="mb-4 text-xs text-[var(--muted-foreground)]">
              <strong>Horizon</strong> (data collection): Python web scrapers, APIs, scheduled tasks.
              <br />
              <strong>Meridian</strong> (analytics &amp; models): Python data pipelines, ML models, statistical analysis.
              <br />
              <strong>Compass</strong> (user experience): React/Next.js frontend, interactive dashboards, visualizations.
            </p>
            <div className="flex flex-wrap gap-2">
              {TECH_STACK.map((tech) => (
                <TechStackChip
                  key={tech.label}
                  label={tech.label}
                  detail={tech.detail}
                  explanation={tech.explanation}
                />
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CONTACT & CONTRIBUTE CTA
          ═══════════════════════════════════════════════════════════════════ */}
      <section aria-label="Get involved">
        <FadeIn>
          <GlassCard variant="accent" padding="lg" className="text-center">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Get Involved
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[var(--muted-foreground)]">
              NorthStar Compass is an open-source community project. Whether you
              want to report a bug, suggest a feature, contribute code, or just
              say hello, you&apos;re welcome here.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://github.com/v-rathod/immigration-insights-app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90"
              >
                <Github className="h-4 w-4" strokeWidth={1.5} />
                View on GitHub
              </a>
              <ContactButton
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/50"
              >
                <Mail className="h-4 w-4" strokeWidth={1.5} />
                Contact
              </ContactButton>
              <Link
                href="/insights"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/50"
              >
                Get Started
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            </div>
          </GlassCard>
        </FadeIn>
      </section>
    </div>
  );
}
