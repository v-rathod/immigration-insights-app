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
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const TECH_STACK = [
  // --- P3: Compass (Frontend) ---
  { label: "Next.js 16", detail: "Static export (zero backend)" },
  { label: "React 19", detail: "Server + client components" },
  { label: "TypeScript 5", detail: "Strict mode, full type coverage" },
  { label: "Tailwind CSS 4", detail: "Aurora design system" },
  { label: "shadcn/ui", detail: "Radix UI primitives" },
  { label: "Recharts 2.15", detail: "Interactive data visualization" },
  { label: "Framer Motion 12", detail: "Purposeful micro-interactions" },
  { label: "Fuse.js 7", detail: "Client-side fuzzy search" },
  { label: "nuqs 2.4", detail: "URL state management" },
  { label: "PostHog", detail: "Product analytics + session recording" },
  { label: "Vitest 4", detail: "Unit + component testing" },
  { label: "Groq LLM (Llama 3.3)", detail: "Cloud-hosted LLM for RAG" },
  { label: "AWS S3 + CloudFront", detail: "Static site hosting + CDN" },
  
  // --- Data & Analytics (P1 & P2) ---
  { label: "Python 3.11", detail: "Data processing & modeling (P1 & P2)" },
  { label: "Pandas / Polars", detail: "Data manipulation (P1 & P2)" },
  { label: "DuckDB", detail: "OLAP queries on Parquet (P2)" },
  { label: "Apache Parquet", detail: "Columnar data format" },
  { label: "PyArrow", detail: "In-memory data interchange" },
  { label: "Scikit-learn", detail: "ML models (forecasting, scoring)" },
  { label: "Statsmodels", detail: "Time-series & statistical analysis" },
  { label: "NumPy / SciPy", detail: "Numerical computing" },
  { label: "pytest", detail: "Data pipeline testing" },
  { label: "APScheduler / Cron", detail: "Scheduled data collection (P1)" },
  { label: "requests / httpx", detail: "HTTP API clients (P1)" },
  { label: "BeautifulSoup4 / Selenium", detail: "Web scraping & parsing (P1)" },
  { label: "PDFMiner", detail: "PDF document extraction (P1)" },
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
                  I&apos;m a software engineer who has been navigating the U.S.
                  employment-based immigration system firsthand. If you&apos;ve
                  been through it, you know: the process is opaque, the data is
                  scattered across half a dozen government websites, and the
                  tools that exist either cost a fortune or show you a fraction
                  of the picture.
                </p>
                <p>
                  I kept asking simple questions:{" "}
                  <span className="text-[var(--foreground)] font-medium italic">
                    &ldquo;When will my priority date become current? Is my employer
                    reliable for sponsorship? How does my salary compare?&rdquo;
                  </span>.{" "}
                  Answering them required stitching together data from
                  DOL PERM filings, DOS Visa Bulletins, BLS wage surveys, and USCIS
                  processing reports. Manually. Every month.
                </p>
                <p>
                  So I decided to build what I wished existed:{" "}
                  <span className="text-[var(--foreground)] font-medium">
                    a single place that connects all the dots
                  </span>
                  . One app that ingests 18.5 million records, runs forecasting
                  models, computes employer reliability scores, and presents it all
                  through interactive dashboards, personalized to your specific
                  situation.
                </p>
                <p>
                  NorthStar Compass is open-source, free, and privacy-first. Your
                  data never leaves your browser. There are no accounts, no
                  tracking pixels, no API keys, and no servers to hack. It&apos;s
                  a statically-hosted web application, deployed globally for speed and reliability.
                </p>
                <p className="text-[var(--foreground)] font-medium">
                  If this project helps even one person navigate their immigration
                  journey with less anxiety and more clarity, it was worth every
                  late night building it.
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
              Complete Tech Stack (P1, P2, P3)
            </h3>
            <p className="mb-4 text-xs text-[var(--muted-foreground)]">
              <strong>P1 Horizon</strong> (data collection): Python web scrapers, APIs, scheduled tasks.
              <br />
              <strong>P2 Meridian</strong> (analytics &amp; models): Python data pipelines, ML models, statistical analysis.
              <br />
              <strong>P3 Compass</strong> (user experience): React/Next.js frontend, interactive dashboards, cloud LLM integration.
            </p>
            <div className="flex flex-wrap gap-2">
              {TECH_STACK.map((tech) => (
                <span
                  key={tech.label}
                  title={tech.detail}
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-mono text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20"
                >
                  {tech.label}
                </span>
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
              <a
                href="mailto:northstar-compass@example.com"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/50"
              >
                <Mail className="h-4 w-4" strokeWidth={1.5} />
                Contact
              </a>
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
