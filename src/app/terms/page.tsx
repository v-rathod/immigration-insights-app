/**
 * Terms of Use Page
 *
 * Route: /terms
 */
"use client";

import { FileText, AlertTriangle, Scale, RefreshCw, Globe2, Mail } from "lucide-react";
import { GlassCard, FadeIn, StaggerContainer, StaggerItem } from "@/components/ui";

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    icon: Globe2,
    title: "Use of Service",
    content:
      "NorthStar Compass is a free, open-source informational tool. You may use it for personal, non-commercial research related to U.S. employment-based immigration. There are no accounts, subscriptions, or usage limits. The site is provided as-is via static web hosting.",
  },
  {
    icon: AlertTriangle,
    title: "Not Legal Advice",
    content:
      "NorthStar Compass provides data visualizations and statistical models based on publicly available government data. It is NOT a substitute for professional legal, immigration, or financial advice. Always consult a qualified immigration attorney for decisions about your specific case. Forecasts and scores are statistical estimates, not guarantees.",
  },
  {
    icon: Scale,
    title: "Data Accuracy",
    content:
      "We strive for accuracy, but immigration data is complex and changes frequently. The data displayed comes from official government sources (DOL, DOS, BLS, USCIS, DHS) and is refreshed periodically. There may be delays, errors, or discrepancies. Use the information as one input among many, not as your sole source of truth.",
  },
  {
    icon: RefreshCw,
    title: "Changes to Terms",
    content:
      "We may update these terms as the project evolves. Material changes will be noted on this page with the updated date. Continued use of Compass after changes constitutes acceptance of the revised terms.",
  },
  {
    icon: Scale,
    title: "Limitation of Liability",
    content:
      "NorthStar Compass is provided on an as-is and as-available basis without warranties of any kind, express or implied. In no event shall the creators or contributors be liable for any direct, indirect, incidental, special, or consequential damages arising from your use of, or inability to use, this service. This includes, without limitation, damages for errors in immigration data, missed filing deadlines, or reliance on statistical forecasts.",
  },
  {
    icon: FileText,
    title: "Open Source License",
    content:
      "NorthStar Compass source code is released under an open-source license. You are free to fork, modify, and distribute the code in accordance with the license terms available in the project repository. Attribution is appreciated but not legally required for use of the hosted application.",
  },
  {
    icon: Mail,
    title: "Contact",
    content:
      "Questions or concerns about these terms? Use the feedback widget (bottom-right corner) or reach out via the project's GitHub repository. We're immigrants building for immigrants, we'll get back to you.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TermsPage() {
  return (
    <div className="space-y-12">
      <section aria-label="Terms header">
        <FadeIn>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
              <FileText className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted-foreground)]">
                Legal
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Terms of Use
              </h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
            Plain-language terms for using NorthStar Compass. We keep it
            simple. Use the tool, don&apos;t rely on it as legal advice, and
            help us make it better if you can.
          </p>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Last updated: March 23, 2026
          </p>
        </FadeIn>
      </section>

      <StaggerContainer className="space-y-4">
        {SECTIONS.map((s) => (
          <StaggerItem key={s.title}>
            <GlassCard variant="default" padding="md">
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                  <s.icon
                    className="h-4.5 w-4.5 text-amber-400"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h2 className="mb-1 text-sm font-semibold">{s.title}</h2>
                  <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {s.content}
                  </p>
                </div>
              </div>
            </GlassCard>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  );
}
