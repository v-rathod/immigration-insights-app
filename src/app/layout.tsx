import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider, themeScript } from "@/components/providers/theme-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const SITE_URL = "https://d10immmzyp7xgr.cloudfront.net";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Compass | Free Immigration Insights & Green Card Tracker",
    template: "%s | Compass",
  },
  description:
    "Free tools for employment-based green card applicants. Track priority dates, research employer sponsorship history, benchmark salaries, and forecast your green card timeline with 18.5M+ government data points.",
  keywords: [
    "green card tracker",
    "priority date forecast",
    "visa bulletin tracker",
    "H-1B employer sponsorship",
    "PERM approval rates",
    "employment based immigration",
    "EB2 EB3 green card wait time",
    "immigration salary benchmark",
    "green card timeline calculator",
    "USCIS processing times",
    "employer sponsorship history",
    "immigration data analytics",
    "immigration",
    "green card",
    "priority date",
    "visa bulletin",
    "H-1B",
    "PERM",
    "EB2",
    "EB3",
    "I-485",
    "adjustment of status",
  ],
  authors: [{ name: "NorthStar Compass" }],
  creator: "NorthStar Compass",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Compass",
    title: "Compass | Free Immigration Insights & Green Card Tracker",
    description:
      "Free tools for employment-based green card applicants. Track priority dates, research employer sponsorship, benchmark salaries, and forecast your green card timeline with 18.5M+ government data points.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Compass | Free Immigration Insights & Green Card Tracker",
    description:
      "Free tools for EB green card applicants. Priority date forecasts, employer sponsorship history, salary benchmarks. Powered by 18.5M+ government records.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

const schemaOrgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Compass",
      description:
        "Free immigration insights and analytics for employment-based green card applicants.",
      inLanguage: "en-US",
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapp`,
      name: "Compass",
      alternateName: "NorthStar Compass",
      url: SITE_URL,
      description:
        "Free tools for employment-based green card applicants. Priority date forecasts, employer sponsorship scores, salary benchmarks, visa bulletin tracking, and USCIS processing analytics built on 18.5M+ government data points.",
      applicationCategory: "UtilityApplication",
      operatingSystem: "Web",
      inLanguage: "en-US",
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Priority date forecasting with machine learning models",
        "Employer sponsorship reliability scoring for 70,000+ employers",
        "H-1B and PERM salary benchmarks by job title and location",
        "Visa bulletin historical trends and cutoff analysis",
        "USCIS processing speed and backlog visualization",
        "EB1 EB2 EB3 category comparison and wait time estimates",
        "Geographic heatmaps of H-1B and PERM activity by US state",
        "Occupation demand trends for employment-based immigration",
      ],
      audience: {
        "@type": "Audience",
        audienceType:
          "Employment-based green card applicants, H-1B visa holders, immigration attorneys",
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "NorthStar Compass",
      url: SITE_URL,
      description:
        "Open-source immigration analytics platform built by immigrants, for immigrants.",
      sameAs: ["https://github.com/v-rathod/immigration-insights-app"],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgJsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {/* Blocking script: applies stored theme class before React hydrates */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        <ThemeProvider>
          <PostHogProvider>
            <AppShell>{children}</AppShell>
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
