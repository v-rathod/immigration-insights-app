/**
 * FeedbackWidget — Floating action button (FAB) that opens a feedback dialog.
 *
 * Single click opens the dialog directly (no intermediate menu).
 * Feedback is stored in PostHog as a `feedback_submitted` event and
 * queryable daily in the PostHog dashboard — no email, no GitHub, no backend.
 *
 * Three feedback categories:
 *   - General Feedback
 *   - Feature Request
 *   - Bug Report
 */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  MessageCircle,
  Lightbulb,
  Bug,
  CheckCircle2,
  MessageSquarePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedbackType = "feedback" | "feature" | "bug";

interface FeedbackOption {
  type: FeedbackType;
  label: string;
  icon: typeof MessageCircle;
  placeholder: string;
  issueLabel: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  {
    type: "feedback",
    label: "General Feedback",
    icon: MessageCircle,
    placeholder:
      "What do you think about NorthStar Compass? What could be better?",
    issueLabel: "feedback",
    color: "text-blue-400",
  },
  {
    type: "feature",
    label: "Feature Request",
    icon: Lightbulb,
    placeholder:
      "Describe the feature you'd like to see. What problem would it solve?",
    issueLabel: "enhancement",
    color: "text-amber-400",
  },
  {
    type: "bug",
    label: "Bug Report",
    icon: Bug,
    placeholder:
      "What happened? What did you expect? Steps to reproduce, if possible.",
    issueLabel: "bug",
    color: "text-rose-400",
  },
];

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const EASING = [0.25, 0.1, 0.25, 1] as const;

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: EASING } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASING } },
};

const panelVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: EASING },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.97,
    transition: { duration: 0.2, ease: EASING },
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeedbackWidget() {
  const pathname = usePathname();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Open feedback dialog directly from FAB
  const openFeedback = useCallback(() => {
    setFeedbackOpen(true);
    setSubmitted(false);
    setMessage("");
    setSelected("feedback");
  }, []);

  // Close feedback dialog
  const closeFeedback = useCallback(() => {
    setFeedbackOpen(false);
    setSubmitted(false);
    setMessage("");
  }, []);

  // Focus textarea when dialog opens
  useEffect(() => {
    if (feedbackOpen && textareaRef.current) {
      const t = setTimeout(() => textareaRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [feedbackOpen, selected]);

  // Escape to close
  useEffect(() => {
    if (!feedbackOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFeedbackOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [feedbackOpen]);

  const currentOption =
    FEEDBACK_OPTIONS.find((o) => o.type === selected) ?? FEEDBACK_OPTIONS[0];

  // Submit: store via PostHog event — queryable daily in PostHog dashboard
  const handleSubmit = useCallback(() => {
    if (!message.trim()) return;
    analytics.feedbackSubmitted({
      type: selected,
      message: message.trim(),
      pagePath: pathname ?? "/",
    });
    setSubmitted(true);
  }, [message, selected, pathname]);

  return (
    <>
      {/* ── FAB — single click opens dialog ── */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
        {/* Tooltip label — fades in on hover */}
        <AnimatePresence>
          {hovered && !feedbackOpen && (
            <motion.span
              key="fab-tooltip"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5",
                "text-xs font-medium text-[var(--foreground)] shadow-lg",
                "pointer-events-none select-none whitespace-nowrap"
              )}
            >
              Send Feedback
            </motion.span>
          )}
        </AnimatePresence>

        <motion.button
          onClick={openFeedback}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          aria-label="Send feedback"
          title="Send feedback"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.93 }}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full shadow-lg",
            "bg-gradient-to-br from-blue-500 to-purple-500 text-white",
            "hover:shadow-xl hover:shadow-blue-500/25",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          )}
        >
          <MessageSquarePlus className="h-5 w-5" strokeWidth={1.75} />
        </motion.button>
      </div>

      {/* ── Feedback dialog (modal) ── */}
      <AnimatePresence>
        {feedbackOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="fb-overlay"
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={closeFeedback}
              aria-hidden="true"
            />

            {/* Panel */}
            <motion.div
              key="fb-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Send feedback"
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                "fixed bottom-20 right-6 z-50 w-[calc(100vw-48px)] max-w-md",
                "rounded-2xl border border-[var(--border)]",
                "bg-[var(--background)] shadow-2xl shadow-black/30"
              )}
            >
              <div className="p-5">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold">Send Feedback</h2>
                  <button
                    onClick={closeFeedback}
                    aria-label="Close"
                    className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {submitted ? (
                  /* ── Success state ── */
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium">Thank you!</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Your feedback has been recorded and will be reviewed shortly.
                    </p>
                    <button
                      onClick={closeFeedback}
                      className="mt-4 rounded-lg border border-[var(--border)] px-4 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--muted)]/50"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  /* ── Form ── */
                  <>
                    {/* Type selector */}
                    <div className="mb-4 flex gap-2">
                      {FEEDBACK_OPTIONS.map((opt) => (
                        <button
                          key={opt.type}
                          onClick={() => {
                            setSelected(opt.type);
                            setMessage("");
                          }}
                          className={cn(
                            "flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-all",
                            selected === opt.type
                              ? "border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/5 text-[var(--foreground)]"
                              : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--foreground)]/20"
                          )}
                        >
                          <opt.icon
                            className={cn("h-4 w-4", opt.color)}
                            strokeWidth={1.5}
                          />
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Textarea */}
                    <textarea
                      ref={textareaRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={currentOption.placeholder}
                      rows={4}
                      maxLength={2000}
                      className={cn(
                        "w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3",
                        "text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
                        "focus:border-[var(--accent-blue)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30",
                        "transition-colors"
                      )}
                    />
                    <div className="mt-1 text-right text-[10px] text-[var(--muted-foreground)]">
                      {message.length} / 2,000
                    </div>

                    {/* Submit */}
                    <button
                      onClick={handleSubmit}
                      disabled={!message.trim()}
                      className={cn(
                        "mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                        message.trim()
                          ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90"
                          : "cursor-not-allowed bg-[var(--muted)]/50 text-[var(--muted-foreground)]"
                      )}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Submit Feedback
                    </button>
                    <p className="mt-2 text-center text-[10px] text-[var(--muted-foreground)]">
                      Feedback is stored securely and reviewed by the team.
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
