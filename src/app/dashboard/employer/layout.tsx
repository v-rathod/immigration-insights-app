import type { Metadata } from "next";

const SITE_URL = "https://d10immmzyp7xgr.cloudfront.net";

export const metadata: Metadata = {
  title: "Employer Sponsor Reliability Score",
  description:
    "Research any of 70,000+ employers' H-1B and PERM green card sponsorship track record. See approval rates, wage competitiveness, denial trends, and a Sponsor Reliability Score (SRS) built from 11 years of DOL and USCIS data.",
  keywords: [
    "H-1B employer sponsorship",
    "employer green card sponsorship",
    "PERM approval rate by employer",
    "sponsor reliability score",
    "H-1B approval rate",
    "best employers for green card",
    "employer immigration history",
    "H-1B denial rate",
    "employer wage competitiveness",
  ],
  openGraph: {
    title: "Employer Sponsor Reliability Score | Compass",
    description:
      "Look up any employer's H-1B and PERM sponsorship track record. Approval rates, wage scores, denial trends for 70,000+ employers.",
    url: `${SITE_URL}/dashboard/employer/`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Compass: Employer Sponsor Reliability Score",
      },
    ],
  },
  alternates: {
    canonical: `${SITE_URL}/dashboard/employer/`,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I check if an employer sponsors green cards?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Search for any employer on the Compass Sponsor Reliability Score (SRS) dashboard. It aggregates 11 years of H-1B and PERM data from the Department of Labor, showing approval rates, denial trends, wage competitiveness, and an overall reliability score.",
      },
    },
    {
      "@type": "Question",
      name: "What is a Sponsor Reliability Score?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The Sponsor Reliability Score (SRS) is a 0 to 100 rating that evaluates an employer's immigration sponsorship track record. It considers PERM approval rates, H-1B denial rates, wage competitiveness vs BLS benchmarks, case volume, and denial trends over time.",
      },
    },
    {
      "@type": "Question",
      name: "Which employers have the best green card sponsorship track record?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Large technology companies generally have high SRS scores due to consistent filing volumes and high approval rates. Search any employer name on Compass to see their specific score and compare across industries.",
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
