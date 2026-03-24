import type { Metadata } from "next";

const SITE_URL = "https://immigrationcompass.fyi";

export const metadata: Metadata = {
  title: "USCIS Processing Speed & Green Card Backlog",
  description:
    "Track USCIS processing speed for employment-based green cards. Quarterly throughput trends, approval and denial rates, pending case estimates, and backlog months. I-140 and I-485 processing data.",
  keywords: [
    "USCIS processing time",
    "green card processing speed",
    "I-140 processing time",
    "I-485 processing time",
    "USCIS backlog",
    "employment based processing",
    "USCIS adjudication",
    "green card pending cases",
    "USCIS approval rate",
  ],
  openGraph: {
    title: "USCIS Processing Speed | Compass",
    description:
      "Track USCIS processing speed and green card backlog. Quarterly throughput, approval rates, and I-140/I-485 trends.",
    url: `${SITE_URL}/dashboard/processing/`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Compass: USCIS Processing Speed Dashboard",
      },
    ],
  },
  alternates: {
    canonical: `${SITE_URL}/dashboard/processing/`,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "USCIS Employment-Based Processing Speed",
  description:
    "Quarterly USCIS processing throughput, approval rates, denial rates, and pending case estimates for employment-based immigration forms including I-140 and I-485.",
  url: `${SITE_URL}/dashboard/processing/`,
  license: "https://creativecommons.org/licenses/by/4.0/",
  creator: {
    "@type": "Organization",
    name: "NorthStar Compass",
  },
  temporalCoverage: "2015/2026",
  variableMeasured: [
    "Quarterly approval count",
    "Quarterly denial count",
    "Pending case estimate",
    "Approval rate percentage",
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
