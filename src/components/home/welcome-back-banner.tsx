"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, User } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { secureGet } from "@/lib/security";

// ---------------------------------------------------------------------------
// Types (mirrors insights page UserProfile shape)
// ---------------------------------------------------------------------------
interface StoredProfile {
  priorityDate?: string;
  category?: string;
  country?: string;
  employerName?: string;
  wageOffered?: string;
  jobTitle?: string;
}

const STORAGE_KEY = "user_profile";

/** Read profile from localStorage. Safe to call during SSR (returns null). */
function readProfile(): StoredProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = secureGet<StoredProfile>(STORAGE_KEY);
    if (stored && typeof stored === "object") {
      const hasData = !!(
        stored.priorityDate ||
        stored.employerName ||
        stored.wageOffered ||
        stored.jobTitle
      );
      if (hasData) return stored;
    }
  } catch {
    // ignore
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WelcomeBackBanner() {
  // Lazy initializer reads from localStorage once on mount — no useEffect needed
  const [profile] = useState<StoredProfile | null>(readProfile);

  if (!profile) return null;

  // Build a short summary of what the user has set
  const parts: string[] = [];
  if (profile.category && profile.country) {
    parts.push(`${profile.category} ${profile.country}`);
  }
  if (profile.employerName) {
    parts.push(profile.employerName);
  }

  return (
    <GlassCard padding="sm" className="border-blue-500/10">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
          <User className="h-4 w-4 text-blue-400" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-[var(--foreground)]">
            Welcome back
          </div>
          {parts.length > 0 && (
            <div className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">
              {parts.join(" | ")}
            </div>
          )}
        </div>
        <Link
          href="/insights"
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-3 py-1.5 text-[10px] font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
        >
          My Insights <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </GlassCard>
  );
}
