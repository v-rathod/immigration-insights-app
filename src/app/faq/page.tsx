/**
 * FAQ Page
 *
 * Route: /faq
 *
 * Quick answers to common questions about Compass: what it does,
 * what data powers it, methodology, privacy, and funding.
 * Also serves as a structured signal for search engines and AI crawlers
 * via FAQPage JSON-LD in the layout.
 */
"use client";

import {
  HelpCircle,
  Database,
  TrendingUp,
  ShieldOff,
  Eye,
  Heart,
  RefreshCw,
} from "lucide-react";
import { GlassCard, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui";

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    icon: HelpCircle,
    question: "What does Compass do?",
    answer:
      "Compass is a free, data-driven research tool for U.S. employment-based immigration. It shows priority date movement history and 24-month forecasts, employer petition approval rates, salary benchmarks by occupation and location, visa bulletin backlogs, and USCIS processing trends. All data comes from official U.S. government sources. There are no accounts, sign-ups, or paywalls.",
  },
  {
    icon: Database,
    question: "What data sources does Compass use?",
    answer:
      "All data comes from publicly available U.S. government sources: the State Department Visa Bulletin (monthly priority date history since 2007), Department of Labor PERM filings (1.7M+ petitions) and LCA certifications (9.6M+ records), Bureau of Labor Statistics Occupational Employment and Wage Statistics, USCIS I-140/I-485/I-765 approval and denial reports, and DHS annual immigration statistics. Data is pre-processed and served from a CDN as static JSON. No API calls are made to any government server from your browser.",
  },
  {
    icon: TrendingUp,
    question: "How is priority date velocity and total advancement calculated?",
    answer:
      "Velocity (days/month) uses a blended model: 50% long-term net velocity anchored to the last 8 years of Visa Bulletin history, 25% anomaly-weighted 24-month rolling mean, and 25% anomaly-weighted 12-month rolling mean. Months with unusually large single-month advances (above the P90 of the series) are down-weighted to 30%, preventing one-time fiscal-year resets from inflating the forecast. The 24-month total advancement figure is the cumulative sum of projected monthly advances over the forecast window. Confidence intervals use the interquartile range of historical monthly data (90% confidence).",
  },
  {
    icon: ShieldOff,
    question: "What does Compass NOT do?",
    answer:
      "Compass does not provide immigration legal advice, visa consulting, case filing services, or any paid services of any kind. It is a data visualization and research tool only. It cannot determine whether you qualify for a visa, predict USCIS adjudication outcomes for your specific case, or guarantee forecast accuracy. Always consult a qualified immigration attorney for decisions about your immigration matter.",
  },
  {
    icon: Eye,
    question: "Does Compass track me or collect personal data?",
    answer:
      "Compass uses PostHog for anonymous, privacy-focused product analytics: page views and feature interactions only, no names, emails, or personal identifiers. Any personalization data you enter (priority date, employer, etc.) is stored exclusively in your browser's localStorage and is never sent to any server. There are no advertising trackers, no Google Analytics, no Facebook Pixel, and no user accounts.",
  },
  {
    icon: Heart,
    question: "How is this site funded? Is it free?",
    answer:
      "Compass is completely free with no ads, subscriptions, or paid tiers. It's an open-source personal project built by an engineer who navigated the EB immigration backlog and wanted better data tooling. The full infrastructure costs under $5/month (S3 static hosting + CloudFront CDN). There are no monetization plans.",
  },
  {
    icon: RefreshCw,
    question: "How often is the data updated?",
    answer:
      "The State Department Visa Bulletin is published monthly; Compass incorporates each new bulletin as it is released. DOL PERM and LCA data is refreshed quarterly when new official datasets are published. BLS wage data is updated annually. You can see the exact last-sync timestamp at the bottom of any page.",
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FaqPage() {
  return (
    <FadeIn>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500">
              <HelpCircle className="h-6 w-6 text-white" strokeWidth={2} />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)] leading-relaxed">
            Common questions about what Compass is, how it works, and what it
            doesn&apos;t do.
          </p>
        </div>

        {/* FAQ Items */}
        <StaggerContainer className="space-y-4">
          {FAQ_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <StaggerItem key={item.question}>
                <GlassCard className="p-6">
                  <div className="flex gap-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]/60">
                      <Icon
                        className="h-4 w-4 text-[var(--muted-foreground)]"
                        strokeWidth={1.75}
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-[var(--foreground)] leading-snug">
                        {item.question}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Footer note */}
        <p className="mt-10 text-center text-xs text-[var(--muted-foreground)]">
          Have a question not covered here?{" "}
          <a
            href="https://github.com/v-rathod/immigration-insights-app/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--foreground)]"
          >
            Open an issue on GitHub
          </a>
          .
        </p>
      </div>
    </FadeIn>
  );
}
