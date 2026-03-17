import type { Metadata } from "next";

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
    url: "https://d10immmzyp7xgr.cloudfront.net/dashboard/processing/",
  },
  alternates: {
    canonical: "https://d10immmzyp7xgr.cloudfront.net/dashboard/processing/",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
