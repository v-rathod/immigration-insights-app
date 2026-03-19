import type { Metadata } from "next";

const SITE_URL = "https://d10immmzyp7xgr.cloudfront.net";

export const metadata: Metadata = {
  title: "About Compass",
  description:
    "The story behind Compass: an open-source, free immigration analytics app built by an immigrant for immigrants. Learn how 18.5M+ government records from DOL, USCIS, State Department, and BLS are transformed into actionable green card insights.",
  keywords: [
    "about compass immigration",
    "immigration analytics platform",
    "open source immigration tools",
    "green card data sources",
    "H-1B data analytics",
    "PERM data analytics",
    "visa bulletin analytics",
    "immigration data pipeline",
  ],
  openGraph: {
    title: "About Compass | Immigration Insights App",
    description:
      "Open-source immigration analytics built by immigrants, for immigrants. 18.5M+ government records, zero data collection, free forever.",
    url: `${SITE_URL}/about/`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Compass: Free Immigration Insights & Green Card Tracker",
      },
    ],
  },
  alternates: {
    canonical: `${SITE_URL}/about/`,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Compass",
  description:
    "Free, open-source immigration analytics platform built on 18.5M+ government data points from DOL, USCIS, State Department, and BLS.",
  url: `${SITE_URL}/about/`,
  mainEntity: {
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#webapp`,
  },
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
