import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Occupation Demand for Immigration Sponsorship",
  description:
    "Discover which occupations have the highest H-1B and PERM green card sponsorship demand. Rankings by SOC code, total filings, approval rates, and median wages. Identify in-demand roles for employment-based immigration.",
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
    url: "https://d10immmzyp7xgr.cloudfront.net/dashboard/job-demand/",
  },
  alternates: {
    canonical: "https://d10immmzyp7xgr.cloudfront.net/dashboard/job-demand/",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
