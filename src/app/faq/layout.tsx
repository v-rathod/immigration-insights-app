/**
 * FAQ Page Layout — adds FAQPage JSON-LD schema for search engines + AI crawlers.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ — Compass Immigration Insights",
  description:
    "Frequently asked questions about Compass: what it does, what data it uses, how priority date velocity is calculated, privacy practices, and why it's free.",
  openGraph: {
    title: "FAQ — Compass Immigration Insights",
    description:
      "Answers to common questions about how Compass works, the data sources behind it, and what it doesn't do.",
    url: "https://immigrationcompass.fyi/faq",
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What does Compass do?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Compass is a free, data-driven tool for U.S. employment-based immigration research. It shows priority date movement history and 24-month forecasts, employer petition approval rates, salary benchmarks by occupation and location, visa bulletin backlogs, and USCIS processing trends — all sourced from official U.S. government datasets. There are no accounts, no sign-ups, and no paywalls.",
        },
      },
      {
        "@type": "Question",
        "name": "What data sources does Compass use?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "All data comes from publicly available U.S. government sources: the State Department Visa Bulletin (priority date history since 2007), Department of Labor PERM and LCA filings (1.7M+ PERM petitions, 9.6M+ LCA certifications), Bureau of Labor Statistics Occupational Employment and Wage Statistics, USCIS I-140, I-485, I-765, and I-360 approval/denial reports, and DHS annual immigration statistics. Data is refreshed periodically and pre-processed into static JSON files served from a CDN.",
        },
      },
      {
        "@type": "Question",
        "name": "How is priority date velocity calculated?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Velocity (days per month) is a blended estimate: 50% long-term net velocity (total days advanced ÷ total months, using the last 8 years of Visa Bulletin history as the anchor window), 25% anomaly-weighted 24-month rolling mean, and 25% anomaly-weighted 12-month rolling mean. Months with unusually large single-month advances (above the 90th percentile of the series history) are down-weighted to 30% to prevent one-time fiscal-year resets from inflating the forecast. The 24-month total advancement figure is the sum of projected monthly advances over the 24-month forecast horizon. 90% confidence intervals are derived from the interquartile range of historical monthly advancement.",
        },
      },
      {
        "@type": "Question",
        "name": "What does Compass NOT do?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Compass does not provide immigration legal advice, visa consulting, case filing services, or any paid services. It is a data visualization and research tool only. Compass cannot tell you whether you qualify for a visa, predict USCIS adjudication decisions, or guarantee the accuracy of forecasts. Always consult a qualified immigration attorney for decisions about your specific situation.",
        },
      },
      {
        "@type": "Question",
        "name": "Does Compass track me or collect personal data?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Compass uses PostHog for anonymous, privacy-focused product analytics (page views and feature interactions — no names, emails, or personal identifiers). Any personalization data you enter (priority date, employer, etc.) is stored only in your browser's localStorage and never sent to any server. There are no advertising trackers, no Google Analytics, and no accounts. See the Privacy page for full details.",
        },
      },
      {
        "@type": "Question",
        "name": "How is this site funded? Is it free?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Compass is completely free and has no ads, subscriptions, or paid tiers. It is an open-source personal project built by an engineer who navigated the EB immigration process and wanted better data tooling. The site is hosted on AWS and maintained as an open-source project. There are no monetization plans.",
        },
      },
      {
        "@type": "Question",
        "name": "How often is data updated?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The State Department Visa Bulletin is published monthly; Compass incorporates each new bulletin as it is released. DOL PERM and LCA data is refreshed quarterly or when new official datasets are published. BLS wage data is refreshed annually. You can see the exact last-sync timestamp at the bottom of any page.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {children}
    </>
  );
}
