import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider, themeScript } from "@/components/providers/theme-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Compass — Immigration Insights",
  description:
    "Personalized immigration insights powered by 18M+ data points. Priority date forecasts, employer friendliness scores, salary benchmarks, and interactive dashboards.",
  keywords: [
    "immigration",
    "green card",
    "priority date",
    "visa bulletin",
    "employer sponsorship",
    "H-1B",
    "PERM",
    "EB2",
    "EB3",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
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
