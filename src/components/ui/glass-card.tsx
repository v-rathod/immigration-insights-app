"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  /** Visual variant */
  variant?: "default" | "elevated" | "interactive" | "accent";
  /** Padding preset */
  padding?: "none" | "sm" | "md" | "lg";
  /** Enable hover glow effect */
  glow?: boolean;
  /** Gradient accent color (top border) */
  accent?: string;
}

// ---------------------------------------------------------------------------
// Animation Presets
// ---------------------------------------------------------------------------

const EASING = [0.25, 0.1, 0.25, 1] as const;

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASING },
  },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const VARIANT_STYLES = {
  default: "bg-[var(--card-glass)] border-[var(--card-border)]",
  elevated:
    "bg-[var(--card-glass)] border-[var(--card-border)] shadow-lg shadow-black/5 dark:shadow-black/20",
  interactive:
    "bg-[var(--card-glass)] border-[var(--card-border)] cursor-pointer hover:border-white/20 hover:shadow-md hover:shadow-white/5 transition-all duration-300",
  accent:
    "bg-[var(--card-glass)] border-[var(--card-border)] border-t-2 border-t-[var(--accent-blue)]",
} as const;

const PADDING_STYLES = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GlassCard({
  children,
  variant = "default",
  padding = "md",
  glow = false,
  accent,
  className,
  ...motionProps
}: GlassCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "relative rounded-2xl border backdrop-blur-xl transition-all duration-300",
        VARIANT_STYLES[variant],
        PADDING_STYLES[padding],
        glow && "hover:shadow-[0_0_30px_rgba(59,130,246,0.08)]",
        className
      )}
      style={accent ? { borderTopColor: accent } : undefined}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
