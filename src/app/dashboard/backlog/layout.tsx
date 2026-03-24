import type { Metadata } from "next";

const SITE_URL = "https://immigrationcompass.fyi";

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
    url: `${SITE_URL}/dashboard/backlog/`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Compass: Green Card Backlog Visualization",
      },
    ],
  },
  alternates: {
    canonical: `${SITE_URL}/dashboard/backlog/`,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How long is the green card backlog for India?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The EB2 and EB3 India green card backlog is among the longest, with estimated wait times measured in decades due to per-country visa caps. Use Compass to see current queue depth estimates and how the backlog has grown over time.",
      },
    },
    {
      "@type": "Question",
      name: "Why is there a green card backlog?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The green card backlog exists because annual demand for employment-based green cards exceeds the per-country visa cap of approximately 7% of the total 140,000 EB visas. Countries with high demand like India and China accumulate multi-year queues.",
      },
    },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
