/**
 * SRS Score Explainer - Info button with a portal-rendered panel.
 *
 * Uses position:fixed so the panel always renders on top regardless of
 * parent backdrop-filter / transform stacking contexts.
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SrsScoreExplainerProps {
  className?: string;
}

export function SrsScoreExplainer({ className }: SrsScoreExplainerProps) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const positionPanel = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    // Show panel below the button, aligned to left edge of button
    setPanelPos({
      top: rect.bottom + 8,
      left: Math.max(8, rect.right - 320), // 320px wide, right-aligned
    });
  }, []);

  const toggle = useCallback(() => {
    if (!open) positionPanel();
    setOpen((v) => !v);
  }, [open, positionPanel]);

  // Close on Escape or outside click
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="srs-explainer"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          style={{
            position: "fixed",
            top: panelPos.top,
            left: panelPos.left,
            width: 320,
            zIndex: 9999,
          }}
          className="rounded-xl border border-blue-500/30 bg-[#0d1726] shadow-2xl p-4"
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/[0.06] rounded transition-colors"
            aria-label="Close explanation"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <p className="font-semibold text-[var(--foreground)] text-sm mb-3">
            Understanding the SRS Score
          </p>

          <div className="space-y-3 text-xs text-[var(--muted-foreground)] leading-relaxed">
            <div>
              <span className="font-semibold text-blue-400">The Ring</span>
              <p className="mt-0.5">
                A full circle = score 100. Score 80 = ring 80% filled in the tier color. The fill always matches the score directly.
              </p>
            </div>
            <div>
              <span className="font-semibold text-blue-400">Score Tiers</span>
              <div className="mt-1 space-y-0.5 ml-1">
                <div><span className="text-emerald-400 font-medium">Excellent</span> &nbsp;80–100 — consistently high approvals &amp; wages</div>
                <div><span className="text-blue-400 font-medium">Good</span> &nbsp;60–79 — solid record with minor gaps</div>
                <div><span className="text-yellow-400 font-medium">Average</span> &nbsp;40–59 — moderate, variable outcomes</div>
                <div><span className="text-orange-400 font-medium">Below Avg</span> &nbsp;20–39 — lower approvals or high variability</div>
                <div><span className="text-rose-400 font-medium">Poor</span> &nbsp;&lt;20 — low approval rates</div>
              </div>
            </div>
            <div>
              <span className="font-semibold text-blue-400">ML Score</span>
              <p className="mt-0.5">A separate machine-learning prediction score. High = model is confident the employer is a strong sponsor based on 1.67M case outcomes.</p>
            </div>
            <div>
              <span className="font-semibold text-blue-400">Sub-scores</span>
              <p className="mt-0.5"><strong>Approval Outcomes</strong> 50% · <strong>Wage Competitiveness</strong> 30% · <strong>Sustainability</strong> 20%</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={cn("flex items-start justify-between", className)}>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Sponsor Reliability Score
        </h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          Evaluated from PERM &amp; LCA filings
        </p>
      </div>
      <button
        ref={btnRef}
        onClick={toggle}
        className="ml-2 shrink-0 rounded-md p-1.5 text-[var(--muted-foreground)] hover:text-blue-400 hover:bg-white/[0.06] transition-colors"
        aria-label="Learn about SRS score metrics"
        aria-expanded={open}
      >
        <HelpCircle className={cn("h-4 w-4", open && "text-blue-400")} strokeWidth={1.5} />
      </button>

      {typeof document !== "undefined" && createPortal(panel, document.body)}
    </div>
  );
}
