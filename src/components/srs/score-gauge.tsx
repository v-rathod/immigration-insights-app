/**
 * SrsScoreGauge — Animated circular gauge displaying the SRS score.
 *
 * Features:
 * - Animated arc fill using Framer Motion
 * - Tier color coding
 * - Score number with spring animation
 * - Subscore breakdown bars
 */
"use client";

import { useMemo } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
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
  className,
}: SrsScoreGaugeProps) {
  const normalizedScore = score != null && !isNaN(score) ? score : 0;
  const fillPercent = normalizedScore / 100;
  const color = srsTierHex(tier);

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

  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      {/* Circular Gauge */}
      <div className="relative" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
        <svg
          width={GAUGE_SIZE}
          height={GAUGE_SIZE}
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
                —
              </span>
              <span className="mt-1 text-xs text-[var(--muted-foreground)]">
                Unrated
              </span>
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

      {/* Subscores */}
      {isRated && (
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
