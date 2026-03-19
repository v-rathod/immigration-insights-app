import type { Metadata } from "next";

const SITE_URL = "https://d10immmzyp7xgr.cloudfront.net";

export const metadata: Metadata = {
  title: "Occupation Demand for Immigration Sponsorship",
  description:
    "See which occupations have the highest H-1B and PERM green card sponsorship demand. Rankings by SOC code, total filings, approval rates, and median wages. Identify in-demand roles for employment-based immigration.",
  keywords: [
    "immigration occupation demand",
    "H-1B job demand",
    "PERM occupation rankings",
    "SOC code immigration",
    "in-demand jobs for H-1B",
    "software engineer immigration demand",
    "data scientist H-1B sponsorship",
    "occupation sponsorship rate",
    "tech jobs immigration",
  ],
  openGraph: {
    title: "Occupation Demand for Immigration | Compass",
    description:
      "Rankings of which job types have the highest H-1B and PERM sponsorship demand, approval rates, and median offered wages.",
    url: `${SITE_URL}/dashboard/job-demand/`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Compass: Occupation Demand for Immigration Sponsorship",
      },
    ],
  },
  alternates: {
    canonical: `${SITE_URL}/dashboard/job-demand/`,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "H-1B and PERM Sponsorship Demand by Occupation",
  description:
    "Rankings of occupation demand for employment-based immigration sponsorship. Includes SOC codes, total filings, approval rates, and median offered wages.",
  url: `${SITE_URL}/dashboard/job-demand/`,
  license: "https://creativecommons.org/licenses/by/4.0/",
  creator: {
    "@type": "Organization",
    name: "NorthStar Compass",
  },
  variableMeasured: [
    "Filing count by occupation",
    "Approval rate by occupation",
    "Median offered wage by occupation",
    "Year over year demand change",
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
