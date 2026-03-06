import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Terms of use for Compass. Not legal advice. All data is sourced from official US government sources (DOL, USCIS, State Department, BLS). Use this tool as one input among many.",
  openGraph: {
    title: "Terms of Use | Compass",
    description:
      "Terms of use for Compass. Not a substitute for professional immigration legal advice.",
    url: "https://d10immmzyp7xgr.cloudfront.net/terms/",
  },
  robots: { index: true, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
