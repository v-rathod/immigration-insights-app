import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "The story behind Compass: an open-source, free immigration analytics app built by an immigrant for immigrants. Learn how 18.5M+ government records from DOL, USCIS, State Department, and BLS are transformed into actionable green card insights.",
  openGraph: {
    title: "About Compass | Immigration Insights App",
    description:
      "Open-source immigration analytics built by immigrants, for immigrants. 18.5M+ government records, zero data collection, free forever.",
    url: "https://d10immmzyp7xgr.cloudfront.net/about/",
  },
  alternates: {
    canonical: "https://d10immmzyp7xgr.cloudfront.net/about/",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
