import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visa Bulletin Priority Date Forecast",
  description:
    "Track EB1, EB2, and EB3 priority date cutoffs and forecast when your date will become current. Historical trends from 2011, machine learning projections for the next 24 months. India, China, Philippines, and ROW data from the State Department Visa Bulletin.",
  keywords: [
    "visa bulletin",
    "priority date forecast",
    "EB2 priority date",
    "EB3 priority date",
    "green card cutoff date",
    "dates for filing",
    "final action date",
    "India EB2 wait time",
    "China green card queue",
    "priority date current",
  ],
  openGraph: {
    title: "Visa Bulletin Priority Date Forecast | Compass",
    description:
      "Track EB1/EB2/EB3 priority date cutoffs and forecast when your date will become current. 15 years of Visa Bulletin history + 24-month ML projections.",
    url: "https://d10immmzyp7xgr.cloudfront.net/dashboard/visa-bulletin/",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
