import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Green Card Backlog Visualization",
  description:
    "Visualize the scale of the EB green card backlog by country and category. See estimated years to clear the queue, how inflows compare to visa caps, and how the backlog has grown over time for India, China, and other countries.",
  keywords: [
    "green card backlog",
    "immigration queue",
    "green card wait time India",
    "EB2 India wait time",
    "employment based backlog",
    "green card queue depth",
    "visa number retrogression",
    "annual green card cap",
    "immigration backlog years",
  ],
  openGraph: {
    title: "Green Card Backlog Visualization | Compass",
    description:
      "See how many years remain in the green card queue by country and category. Backlog estimates for EB1, EB2, EB3.",
    url: "https://d10immmzyp7xgr.cloudfront.net/dashboard/backlog/",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
