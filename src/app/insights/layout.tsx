import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Insights: Personalized Green Card Dashboard",
  description:
    "Enter your immigration profile and get personalized insights: see when your priority date may become current, your employer's reliability score, and how your salary compares to market benchmarks for your role and location.",
  keywords: [
    "personalized immigration insights",
    "green card timeline calculator",
    "when will my priority date be current",
    "employer sponsorship checker",
    "immigration salary comparison",
    "my green card forecast",
    "personalized visa bulletin tracker",
  ],
  openGraph: {
    title: "My Insights: Personalized Green Card Dashboard | Compass",
    description:
      "Your personalized green card timeline, employer score, and salary benchmark in one place.",
    url: "https://d10immmzyp7xgr.cloudfront.net/insights/",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
