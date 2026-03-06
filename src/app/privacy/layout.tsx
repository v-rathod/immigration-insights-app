import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Compass collects zero personal data. All computations run in your browser. No accounts, no tracking pixels, no cookies, no server-side processing. Your immigration data never leaves your device.",
  openGraph: {
    title: "Privacy Policy | Compass",
    description:
      "Compass collects zero data. All personalization runs locally in your browser. No accounts, no tracking, no servers.",
    url: "https://d10immmzyp7xgr.cloudfront.net/privacy/",
  },
  robots: { index: true, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
