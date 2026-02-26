import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "NorthStar Compass — Immigration Insights",
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
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
