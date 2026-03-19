import type { Metadata } from "next";

const SITE_URL = "https://d10immmzyp7xgr.cloudfront.net";

export const metadata: Metadata = {
  title: "My Insights: Personalized Green Card Dashboard",
  description:
    "Enter your immigration profile and get personalized insights: see when your priority date may become current, your employer's reliability score, and how your salary compares to market benchmarks for your role and location.",
  keywords: [
    "personalized immigration insights",
    "green card timeline calculator",
    "when will my priority date be current",
    "employer sponsorship checker",
    "immigration salary comparison",
    "my green card forecast",
    "personalized visa bulletin tracker",
  ],
  openGraph: {
    title: "My Insights: Personalized Green Card Dashboard | Compass",
    description:
      "Your personalized green card timeline, employer score, and salary benchmark in one place.",
    url: `${SITE_URL}/insights/`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Compass: Personalized Immigration Insights Dashboard",
      },
    ],
  },
  alternates: {
    canonical: `${SITE_URL}/insights/`,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Compass My Insights",
  description:
    "Personalized immigration dashboard with green card timeline forecast, employer reliability score, and salary benchmark.",
  url: `${SITE_URL}/insights/`,
  applicationCategory: "UtilityApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Personalized green card priority date forecast",
    "Employer sponsorship reliability score lookup",
    "Salary benchmark comparison by role and location",
    "All data stored locally in your browser",
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
