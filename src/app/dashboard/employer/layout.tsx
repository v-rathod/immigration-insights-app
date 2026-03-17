import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Employer Sponsor Reliability Score",
  description:
    "Research any of 70,000+ employers' H-1B and PERM green card sponsorship track record. See approval rates, wage competitiveness, denial trends, and a Sponsor Reliability Score (SRS) built from 11 years of DOL and USCIS data.",
  keywords: [
    "H-1B employer sponsorship",
    "employer green card sponsorship",
    "PERM approval rate by employer",
    "sponsor reliability score",
    "H-1B approval rate",
    "best employers for green card",
    "employer immigration history",
    "H-1B denial rate",
    "employer wage competitiveness",
  ],
  openGraph: {
    title: "Employer Sponsor Reliability Score | Compass",
    description:
      "Look up any employer's H-1B and PERM sponsorship track record. Approval rates, wage scores, denial trends for 70,000+ employers.",
    url: "https://d10immmzyp7xgr.cloudfront.net/dashboard/employer/",
  },
  alternates: {
    canonical: "https://d10immmzyp7xgr.cloudfront.net/dashboard/employer/",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
