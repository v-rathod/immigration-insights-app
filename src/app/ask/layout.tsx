import type { Metadata } from "next";

const SITE_URL = "https://immigrationcompass.fyi";

export const metadata: Metadata = {
  title: "Ask Immigration Questions",
  description:
    "Ask any question about employment-based immigration and get instant answers. Topics include priority dates, visa bulletin, employer sponsorship, H-1B, PERM, salary benchmarks, and green card wait times. Powered by 18.5M+ government data points.",
  keywords: [
    "immigration questions",
    "green card FAQ",
    "priority date questions",
    "H-1B questions",
    "PERM frequently asked questions",
    "immigration data questions",
    "visa bulletin explained",
    "employment based green card questions",
  ],
  openGraph: {
    title: "Ask Immigration Questions | Compass",
    description:
      "Get instant answers to employment-based immigration questions. Powered by 18.5M+ government records.",
    url: `${SITE_URL}/ask/`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Compass: Ask Immigration Questions",
      },
    ],
  },
  alternates: {
    canonical: `${SITE_URL}/ask/`,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How long is the green card wait time for EB2 India?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The EB2 India green card wait depends on your priority date and the monthly Visa Bulletin cutoff movement. Use Compass to enter your priority date and get a personalized forecast based on 10+ years of historical data.",
      },
    },
    {
      "@type": "Question",
      name: "How do I check if my employer sponsors green cards?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Search for any employer on the Compass Sponsor Reliability Score dashboard. It shows H-1B and PERM approval rates, denial trends, wage competitiveness, and an overall reliability score based on 11 years of DOL data.",
      },
    },
    {
      "@type": "Question",
      name: "What salary should I expect for an H-1B visa job?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Use the Compass Wage Competitiveness dashboard to search salary data by employer or job title. See p10 to p90 percentile ranges, 5-year growth trends, and how offered wages compare to BLS national medians.",
      },
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
