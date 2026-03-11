"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info } from "lucide-react";

interface TechStackChipProps {
  label: string;
  detail: string;
  explanation: string;
}

/**
 * Interactive tech stack chip with hover tooltip showing explanation.
 * Reveals 3-4 line explanation on hover, describing why/where the technology is used.
 */
export function TechStackChip({ label, detail, explanation }: TechStackChipProps) {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div className="relative inline-block">
      {/* Main chip button */}
      <button
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className="group relative rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-mono text-[var(--muted-foreground)] transition-all duration-200 hover:border-[var(--foreground)]/30 hover:text-[var(--foreground)] hover:bg-white/[0.02]"
        aria-label={`${label}: ${detail}`}
        title={detail}
      >
        <span className="flex items-center gap-1.5">
          {label}
          <Info className="h-3 w-3 opacity-0 transition-opacity duration-200 group-hover:opacity-60" />
        </span>
      </button>

      {/* Tooltip with explanation */}
      <AnimatePresence>
        {isHovering && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2"
          >
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-left shadow-2xl backdrop-blur-xl">
              {/* Arrow */}
              <div className="absolute -bottom-1.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-[var(--border)] bg-[var(--card)]" />

              {/* Header */}
              <div className="mb-2 flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                <div>
                  <div className="text-xs font-semibold text-[var(--foreground)]">
                    {label}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {detail}
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                {explanation}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
