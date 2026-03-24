import type { Metadata } from "next";

const SITE_URL = "https://immigrationcompass.fyi";

export const metadata: Metadata = {
  title: "H-1B & PERM Activity by US State",
  description:
    "Explore where H-1B and PERM green card activity is concentrated by US state. Compare total filings, approval rates, unique employers, and median offered wages. California, Texas, New York, and more.",
  keywords: [
    "H-1B by state",
    "PERM filings by state",
    "immigration geographic distribution",
    "H-1B California",
    "green card sponsorship by state",
    "immigration hotspots",
    "employer sponsorship by location",
    "H-1B concentration",
  ],
  openGraph: {
    title: "H-1B & PERM Activity by US State | Compass",
    description:
      "See where H-1B and green card activity concentrates by state. Compare filings, approval rates, and wages across all 50 states.",
    url: `${SITE_URL}/dashboard/geographic/`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Compass: Geographic Immigration Heatmap",
      },
    ],
  },
  alternates: {
    canonical: `${SITE_URL}/dashboard/geographic/`,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "H-1B and PERM Filing Activity by US State",
  description:
    "Geographic distribution of H-1B and PERM green card filings across 50 US states. Includes total filings, approval rates, unique employers, and median offered wages.",
  url: `${SITE_URL}/dashboard/geographic/`,
  license: "https://creativecommons.org/licenses/by/4.0/",
  creator: {
    "@type": "Organization",
    name: "NorthStar Compass",
  },
  spatialCoverage: "US",
  variableMeasured: [
    "Total filings by state",
    "Approval rate by state",
    "Unique employers by state",
    "Median offered wage by state",
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
