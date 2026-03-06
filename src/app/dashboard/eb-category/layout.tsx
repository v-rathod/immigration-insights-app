import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EB Category Comparison: EB1 vs EB2 vs EB3",
  description:
    "Compare EB1, EB2, and EB3 green card category movement velocity and volatility. Understand which employment-based category advances fastest, where retrogressions occur, and historical cutoff progression by country.",
  keywords: [
    "EB1 vs EB2 vs EB3",
    "employment based category comparison",
    "green card category velocity",
    "EB2 retrogression",
    "EB3 movement",
    "employment based preference category",
    "green card cutoff advancement",
    "EB category volatility",
  ],
  openGraph: {
    title: "EB Category Comparison | Compass",
    description:
      "Compare EB1, EB2, EB3 movement velocity and volatility. Understand which employment-based green card category moves fastest.",
    url: "https://d10immmzyp7xgr.cloudfront.net/dashboard/eb-category/",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
