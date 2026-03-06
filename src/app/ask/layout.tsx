import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ask Immigration Questions",
  description:
    "Ask any question about employment-based immigration and get instant answers. Topics include priority dates, visa bulletin, employer sponsorship, H-1B, PERM, salary benchmarks, and green card wait times. Powered by 18.5M+ government data points.",
  keywords: [
    "immigration questions",
    "green card FAQ",
    "priority date questions",
    "H-1B questions",
    "PERM frequently asked questions",
    "immigration data questions",
    "visa bulletin explained",
    "employment based green card questions",
  ],
  openGraph: {
    title: "Ask Immigration Questions | Compass",
    description:
      "Get instant answers to employment-based immigration questions. Powered by 18.5M+ government records.",
    url: "https://d10immmzyp7xgr.cloudfront.net/ask/",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
