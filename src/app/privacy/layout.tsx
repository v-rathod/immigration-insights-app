import type { Metadata } from "next";

const SITE_URL = "https://immigrationcompass.fyi";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Compass collects zero personal data. All computations run in your browser. No accounts, no tracking pixels, no cookies, no server-side processing. Your immigration data never leaves your device.",
  openGraph: {
    title: "Privacy Policy | Compass",
    description:
      "Compass collects zero data. All personalization runs locally in your browser. No accounts, no tracking, no servers.",
    url: `${SITE_URL}/privacy/`,
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
    canonical: `${SITE_URL}/privacy/`,
  },
  robots: { index: true, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
