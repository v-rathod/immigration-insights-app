import type { Metadata } from "next";

const SITE_URL = "https://d10immmzyp7xgr.cloudfront.net";

export const metadata: Metadata = {
  title: "EB Category Comparison: EB1 vs EB2 vs EB3",
  description:
    "Compare EB1, EB2, and EB3 green card category movement velocity and volatility. Understand which employment-based category advances fastest, where retrogressions occur, and historical cutoff progression by country.",
  keywords: [
    "EB1 vs EB2 vs EB3",
    "employment based category comparison",
    "green card category velocity",
    "EB2 retrogression",
    "EB3 movement",
    "employment based preference category",
    "green card cutoff advancement",
    "EB category volatility",
    "EB2 vs EB3 India",
    "which EB category is faster",
    "EB1 wait time",
    "EB2 India movement",
  ],
  alternates: {
    canonical: `${SITE_URL}/dashboard/eb-category/`,
  },
  openGraph: {
    title: "EB Category Comparison | Compass",
    description:
      "Compare EB1, EB2, EB3 movement velocity and volatility. Understand which employment-based green card category moves fastest.",
    url: `${SITE_URL}/dashboard/eb-category/`,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Which EB category green card is fastest — EB1, EB2, or EB3?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "EB1 is generally the fastest category, often current for most countries except India and China. EB2 typically moves faster than EB3 for India. Use our comparison dashboard to see real-time velocity data for each category by country.",
      },
    },
    {
      "@type": "Question",
      name: "Should I downgrade from EB2 to EB3 for a faster green card?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For India, EB2 has recently been advancing faster than EB3 (higher velocity in days/month). Check the latest EB2 vs EB3 velocity comparison on our dashboard before making this decision, as the relative speeds change over time.",
      },
    },
    {
      "@type": "Question",
      name: "What is a priority date retrogression?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A retrogression occurs when the State Department moves a cutoff date backward, meaning previously eligible applicants must wait longer. This happens when demand exceeds the annual visa cap. Our dashboard tracks retrogression events for each EB category.",
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
