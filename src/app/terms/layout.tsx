import type { Metadata } from "next";

const SITE_URL = "https://immigrationcompass.fyi";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Terms of use for Compass. Not legal advice. All data is sourced from official US government sources (DOL, USCIS, State Department, BLS). Use this tool as one input among many.",
  openGraph: {
    title: "Terms of Use | Compass",
    description:
      "Terms of use for Compass. Not a substitute for professional immigration legal advice.",
    url: `${SITE_URL}/terms/`,
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
    canonical: `${SITE_URL}/terms/`,
  },
  robots: { index: true, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
