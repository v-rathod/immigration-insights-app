import type { Metadata } from "next";

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
    url: "https://d10immmzyp7xgr.cloudfront.net/dashboard/geographic/",
  },
  alternates: {
    canonical: "https://d10immmzyp7xgr.cloudfront.net/dashboard/geographic/",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
