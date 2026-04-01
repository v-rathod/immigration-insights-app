/**
 * SrsScoreGauge — Animated circular gauge displaying the SRS score.
 *
 * Features:
 * - Animated arc fill using Framer Motion
 * - Tier color coding
 * - Score number with spring animation
 * - Subscore breakdown bars
 * - Interactive "Why not rated?" explanation for unrated employers
 */
"use client";

import { useState, useMemo } from "react";
import { motion, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { srsTierHex, srsTierColor } from "@/lib/utils/format";

interface SrsScoreGaugeProps {
  score: number | null;
  tier: string;
  subscores: {
    outcome: number;
    wage: number;
    sustainability: number;
  };
  mlScore?: number;
  /** Employer activity classification from P2 pipeline */
  activityStatus?: "active" | "legacy" | "historical";
  /** PERM case count in the last 36 months */
  caseCount?: number;
  className?: string;
}

const GAUGE_SIZE = 180;
const STROKE_WIDTH = 12;
const RADIUS = (GAUGE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Show 270° arc (3/4 of circle)
const ARC_LENGTH = CIRCUMFERENCE * 0.75;

export function SrsScoreGauge({
  score,
  tier,
  subscores,
  mlScore,
  activityStatus,
  caseCount,
  className,
}: SrsScoreGaugeProps) {
  const normalizedScore = score != null && !isNaN(score) ? score : 0;
  const fillPercent = normalizedScore / 100;
  const color = srsTierHex(tier);
  const [showWhyUnrated, setShowWhyUnrated] = useState(false);

  // Spring-animated score value
  const springValue = useSpring(0, {
    stiffness: 60,
    damping: 20,
    mass: 1,
  });

  // Set target value on mount
  useMemo(() => {
    springValue.set(normalizedScore);
  }, [normalizedScore, springValue]);

  const displayScore = useTransform(springValue, (v) => Math.round(v));

  const isRated = score != null && !isNaN(score) && tier !== "Unrated";
  const hasSubscores =
    subscores.outcome > 0 || subscores.wage > 0 || subscores.sustainability > 0;

  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      {/* Circular Gauge */}
      <div className="relative w-full max-w-[180px]" style={{ aspectRatio: '1 / 1' }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
          className="-rotate-[135deg]"
          role="img"
          aria-label={
            isRated
              ? `Sponsor Reliability Score: ${normalizedScore} out of 100, rated ${tier}`
              : "Sponsor Reliability Score: Unrated"
          }
        >
          {/* Background arc */}
          <circle
            cx={GAUGE_SIZE / 2}
            cy={GAUGE_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
            className="text-white/[0.06]"
          />

          {/* Filled arc */}
          {isRated && (
            <motion.circle
              cx={GAUGE_SIZE / 2}
              cy={GAUGE_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${ARC_LENGTH * fillPercent} ${CIRCUMFERENCE}`}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${CIRCUMFERENCE}` }}
              animate={{
                strokeDasharray: `${ARC_LENGTH * fillPercent} ${CIRCUMFERENCE}`,
              }}
              transition={{
                duration: 1.2,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              style={{
                filter: `drop-shadow(0 0 8px ${color}40)`,
              }}
            />
          )}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isRated ? (
            <>
              <motion.span
                className="text-4xl font-bold tabular-nums text-[var(--foreground)] font-mono"
                aria-hidden="true"
              >
                {displayScore}
              </motion.span>
              <span
                className={cn(
                  "mt-1 text-xs font-semibold uppercase tracking-wider",
                  srsTierColor(tier)
                )}
              >
                {tier}
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold text-[var(--muted-foreground)]">
                N/A
              </span>
              <span className="mt-1 text-xs text-[var(--muted-foreground)]">
                Unrated
              </span>
              <button
                onClick={() => setShowWhyUnrated((v) => !v)}
                className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-400/80 hover:text-blue-400 transition-colors"
                aria-label="Why is this employer not rated?"
              >
                <HelpCircle className="h-3 w-3" />
                Why?
              </button>
            </>
          )}
        </div>
      </div>

      {/* ML Score badge (if available) */}
      {mlScore != null && !isNaN(mlScore) && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1.5",
            "border border-purple-500/20 bg-purple-500/10",
            "text-xs font-medium text-purple-400"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          ML Score: {mlScore}
        </div>
      )}

      {/* Unrated explanation — interactive panel triggered by "Why?" button */}
      <AnimatePresence>
        {!isRated && showWhyUnrated && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full max-w-[260px] overflow-hidden"
          >
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] text-blue-300/90 leading-snug">
                  <UnratedReason activityStatus={activityStatus} caseCount={caseCount} hasSubscores={hasSubscores} />
                </p>
                <button
                  onClick={() => setShowWhyUnrated(false)}
                  className="shrink-0 rounded p-0.5 text-blue-400/60 hover:text-blue-400 transition-colors"
                  aria-label="Close explanation"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Partial subscores note — shown when subscores exist but composite is withheld */}
      {!isRated && hasSubscores && !showWhyUnrated && (
        <div className="w-full max-w-[240px] rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
          <p className="text-[11px] text-amber-400/80 text-center leading-snug">
            Too few recent filings for an overall score. Component scores below are based on available LCA data.
          </p>
        </div>
      )}

      {/* Subscores — shown for rated employers and for unrated ones with partial data */}
      {(isRated || (!isRated && hasSubscores)) && (
        <div className="w-full max-w-[240px] space-y-3">
          <SubscoreBar
            label="Approval Outcomes"
            value={subscores.outcome}
            weight="50%"
            color="blue"
          />
          <SubscoreBar
            label="Wage Competitiveness"
            value={subscores.wage}
            weight="30%"
            color="emerald"
          />
          <SubscoreBar
            label="Sustainability"
            value={subscores.sustainability}
            weight="20%"
            color="purple"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subscore Bar
// ---------------------------------------------------------------------------

function SubscoreBar({
  label,
  value,
  weight,
  color,
}: {
  label: string;
  value: number;
  weight: string;
  color: "blue" | "emerald" | "purple";
}) {
  const colorClasses = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    purple: "bg-purple-500",
  };

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span className="font-mono text-[var(--foreground)] tabular-nums">
          {Math.round(value)}
          <span className="text-[var(--muted-foreground)] ml-1">({weight})</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", colorClasses[color])}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{
            duration: 1,
            ease: [0.25, 0.1, 0.25, 1],
            delay: 0.3,
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unrated Reason — explains WHY an employer isn't scored
// ---------------------------------------------------------------------------

function UnratedReason({
  activityStatus,
  caseCount,
  hasSubscores,
}: {
  activityStatus?: "active" | "legacy" | "historical";
  caseCount?: number;
  hasSubscores: boolean;
}) {
  if (activityStatus === "historical") {
    return (
      <>
        This employer has no recent green card (PERM) filings.
        Their last activity was before the 36-month scoring window, so a current reliability score cannot be computed.
        {hasSubscores && " Partial component scores below are based on available LCA data."}
      </>
    );
  }

  if (activityStatus === "legacy") {
    return (
      <>
        This employer has limited recent filing activity.
        SRS requires consistent sponsorship volume over 36 months to produce a statistically reliable score.
        {hasSubscores && " Partial component scores below use available LCA data."}
      </>
    );
  }

  if (caseCount != null && caseCount < 3) {
    return (
      <>
        This employer has only {caseCount} green card {caseCount === 1 ? "filing" : "filings"} in the last 36 months.
        A minimum of 3 PERM filings is needed for a meaningful score.
        {hasSubscores && " Component scores below are based on available data."}
      </>
    );
  }

  return (
    <>
      This employer does not meet the minimum filing thresholds for SRS scoring.
      The score requires sufficient PERM (green card) application history within the 36-month analysis window.
      {hasSubscores && " Component scores below are based on available data."}
    </>
  );
}
