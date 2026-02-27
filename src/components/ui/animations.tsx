"use client";

import { type ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

// ---------------------------------------------------------------------------
// Animation Constants
// ---------------------------------------------------------------------------

const EASING = [0.25, 0.1, 0.25, 1] as const;

// ---------------------------------------------------------------------------
// Stagger Container — animates children in sequence
// ---------------------------------------------------------------------------

interface StaggerContainerProps {
  children: ReactNode;
  /** Delay between each child in seconds */
  staggerDelay?: number;
  /** Container className */
  className?: string;
}

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export function StaggerContainer({
  children,
  staggerDelay = 0.08,
  className,
}: StaggerContainerProps) {
  const variants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      },
    },
  };

  return (
    <motion.div
      variants={staggerDelay === 0.08 ? containerVariants : variants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stagger Item — child of StaggerContainer
// ---------------------------------------------------------------------------

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: EASING },
  },
};

export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Fade In — simple fade + slide up
// ---------------------------------------------------------------------------

interface FadeInProps {
  children: ReactNode;
  /** Delay before animation starts */
  delay?: number;
  /** Direction to slide from */
  direction?: "up" | "down" | "left" | "right";
  /** Distance to slide */
  distance?: number;
  /** Duration in seconds */
  duration?: number;
  className?: string;
}

export function FadeIn({
  children,
  delay = 0,
  direction = "up",
  distance = 16,
  duration = 0.5,
  className,
}: FadeInProps) {
  const axis = direction === "up" || direction === "down" ? "y" : "x";
  const sign = direction === "up" || direction === "left" ? 1 : -1;
  const offset = distance * sign;

  return (
    <motion.div
      initial={{ opacity: 0, [axis]: offset }}
      animate={{ opacity: 1, [axis]: 0 }}
      transition={{ duration, delay, ease: EASING }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Scale In — pop-in effect
// ---------------------------------------------------------------------------

interface ScaleInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function ScaleIn({ children, delay = 0, className }: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: EASING }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Glow Pulse — animated glow ring for emphasis
// ---------------------------------------------------------------------------

interface GlowPulseProps {
  children: ReactNode;
  color?: string;
  className?: string;
}

export function GlowPulse({
  children,
  color = "rgba(59, 130, 246, 0.3)",
  className,
}: GlowPulseProps) {
  return (
    <motion.div
      className={className}
      animate={{
        boxShadow: [
          `0 0 0px ${color}`,
          `0 0 20px ${color}`,
          `0 0 0px ${color}`,
        ],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}
