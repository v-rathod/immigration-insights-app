import type { Metadata } from "next";

const SITE_URL = "https://immigrationcompass.fyi";

export const metadata: Metadata = {
  title: "Visa Bulletin Priority Date Forecast | April 2026",
  description:
    "Track EB1, EB2, and EB3 priority date cutoffs and forecast when your date will become current. Historical trends from 2011, machine learning projections for the next 24 months. India, China, Philippines, and ROW data from the State Department Visa Bulletin. Updated monthly with latest priority date movement analysis.",
  keywords: [
    "visa bulletin",
    "visa bulletin april 2026",
    "priority date forecast",
    "priority date movement",
    "EB2 priority date",
    "EB3 priority date",
    "green card cutoff date",
    "dates for filing",
    "final action date",
    "India EB2 wait time",
    "China green card queue",
    "priority date current",
    "visa bulletin tracker",
    "priority date prediction",
    "EB2 India priority date",
    "EB3 India priority date",
    "when will my priority date be current",
    "visa bulletin analysis",
    "green card wait time calculator",
  ],
  alternates: {
    canonical: `${SITE_URL}/dashboard/visa-bulletin/`,
  },
  openGraph: {
    title: "Visa Bulletin Priority Date Forecast | Compass",
    description:
      "Track EB1/EB2/EB3 priority date cutoffs and forecast when your date will become current. 15 years of Visa Bulletin history + 24-month ML projections.",
    url: `${SITE_URL}/dashboard/visa-bulletin/`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Compass: Visa Bulletin Priority Date Forecast",
      },
    ],
  },
};

/**
 * JSON-LD for rich search results:
 * - FAQPage schema targets "People also ask" Google feature
 * - Dataset schema for data-rich crawling by AI agents
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is the current EB2 India priority date?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The EB2 India priority date changes monthly with each new Visa Bulletin from the State Department. Use our interactive tracker to see the latest Final Action Date and Dates for Filing cutoffs, updated within days of each bulletin release.",
          },
        },
        {
          "@type": "Question",
          name: "How long is the EB2 India green card wait time?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The EB2 India green card wait depends on your priority date. Our ML forecast model projects cutoff movement 24 months ahead based on 10+ years of Visa Bulletin data. Enter your priority date to get a personalized estimate.",
          },
        },
        {
          "@type": "Question",
          name: "What is the difference between Final Action Date and Dates for Filing?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The Final Action Date (FAD) is when your green card can actually be approved. The Dates for Filing (DFF) is when you can submit Form I-485 (Adjustment of Status). DFF is typically more advanced than FAD, meaning you can file earlier, but approval depends on FAD becoming current.",
          },
        },
        {
          "@type": "Question",
          name: "When is the next Visa Bulletin released?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The State Department typically releases the new Visa Bulletin in the second or third week of each month, effective for the following month. For example, the May 2026 Visa Bulletin is usually released in mid-April 2026.",
          },
        },
        {
          "@type": "Question",
          name: "How do you predict priority date movement?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Compass uses a blended velocity model trained on 10+ years of Visa Bulletin data. The model combines full-history net movement, 24-month mean, and 12-month mean velocities with seasonal adjustment and retrogression dampening to produce 24-month forecasts with confidence intervals.",
          },
        },
      ],
    },
    {
      "@type": "Dataset",
      name: "US Visa Bulletin Priority Date Trends",
      description:
        "Historical priority date cutoff trends for EB1, EB2, EB3, EB4, EB5 categories across India, China, Philippines, Mexico, and Rest of World. Updated monthly from the US State Department Visa Bulletin.",
      url: `${SITE_URL}/dashboard/visa-bulletin/`,
      license: "https://creativecommons.org/licenses/by/4.0/",
      creator: {
        "@type": "Organization",
        name: "NorthStar Compass",
      },
      temporalCoverage: "2011/2026",
      spatialCoverage: "US",
      variableMeasured: [
        "Priority date cutoff",
        "Monthly advancement days",
        "Velocity (days per month)",
        "Retrogression events",
      ],
    },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
