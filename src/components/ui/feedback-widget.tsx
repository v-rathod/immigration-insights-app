/**
 * FeedbackWidget — Unified floating action button (FAB) with mini-menu.
 *
 * Single floating button that expands into two actions:
 *   1. Ask NorthStar — navigates to /ask (RAG Q&A)
 *   2. Send Feedback — opens the feedback dialog
 *
 * The feedback dialog has three categories:
 *   - General Feedback
 *   - Feature Request
 *   - Bug Report
 *
 * Since Compass has zero backend, the form composes a pre-filled GitHub
 * issue URL (or mailto fallback). The user clicks "Submit" and is routed
 * to the appropriate destination in a new tab.
 */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Send,
  MessageCircle,
  Lightbulb,
  Bug,
  ExternalLink,
  Search,
  MessageSquarePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

/** Placeholder — user will provide the real URL */
const GITHUB_REPO_URL = "https://github.com";
const CONTACT_EMAIL = "northstar-compass@example.com";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [selected, setSelected] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Toggle the mini-menu (FAB)
  const toggleMenu = useCallback(() => {
    setMenuOpen((o) => !o);
  }, []);

  // Open feedback dialog from mini-menu
  const openFeedback = useCallback(() => {
    setMenuOpen(false);
    setFeedbackOpen(true);
    setSubmitted(false);
    setMessage("");
  }, []);

  // Close feedback dialog
  const closeFeedback = useCallback(() => {
    setFeedbackOpen(false);
    setSubmitted(false);
    setMessage("");
  }, []);

  // Navigate to /ask from mini-menu
  const handleAskClick = useCallback(() => {
    setMenuOpen(false);
  }, []);

  // Focus textarea when feedback modal opens
  useEffect(() => {
    if (feedbackOpen && textareaRef.current) {
      const t = setTimeout(() => textareaRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [feedbackOpen, selected]);

  // Escape to close menu or feedback
  useEffect(() => {
    if (!menuOpen && !feedbackOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (feedbackOpen) setFeedbackOpen(false);
        else setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [menuOpen, feedbackOpen]);

  // Close menu on route change
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
  }

  const currentOption =
    FEEDBACK_OPTIONS.find((o) => o.type === selected) ?? FEEDBACK_OPTIONS[0];

  const handleSubmit = useCallback(() => {
    if (!message.trim()) return;

    const title = encodeURIComponent(
      `[${currentOption.issueLabel}] ${message.slice(0, 80)}`
    );
    const body = encodeURIComponent(
      `**Type:** ${currentOption.label}\n\n**Description:**\n${message}\n\n---\n_Submitted via NorthStar Compass feedback widget_`
    );

    const githubUrl = `${GITHUB_REPO_URL}/issues/new?title=${title}&body=${body}&labels=${currentOption.issueLabel}`;
    const mailtoUrl = `mailto:${CONTACT_EMAIL}?subject=${title}&body=${body}`;

    const url =
      GITHUB_REPO_URL !== "https://github.com" ? githubUrl : mailtoUrl;

    window.open(url, "_blank", "noopener,noreferrer");
    setSubmitted(true);
  }, [message, currentOption]);

  // Hide on /ask page — the full search is already there
  const isAskPage = pathname === "/ask";

  return (
    <>
      {/* ── FAB trigger ── */}
      <motion.button
        onClick={toggleMenu}
        aria-label={menuOpen ? "Close menu" : "Quick actions"}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors",
          "bg-gradient-to-br from-blue-500 to-purple-500 text-white",
          "hover:shadow-xl hover:shadow-blue-500/20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{ rotate: menuOpen ? 45 : 0 }}
        transition={{ duration: 0.2, ease: EASING }}
      >
        {menuOpen ? (
          <X className="h-5 w-5" strokeWidth={2} />
        ) : (
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        )}
      </motion.button>

      {/* ── Mini-menu (2 items) ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Invisible backdrop to close */}
            <motion.div
              key="fab-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Action items — stagger upward */}
            <div className="fixed bottom-20 right-6 z-50 flex flex-col-reverse items-end gap-3">
              {/* Ask NorthStar */}
              {!isAskPage && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.9 }}
                  transition={{ duration: 0.2, delay: 0.03, ease: EASING }}
                >
                  <Link
                    href="/ask"
                    onClick={handleAskClick}
                    className={cn(
                      "flex items-center gap-2.5 rounded-full pl-4 pr-3 py-2.5 shadow-lg",
                      "bg-[var(--background)] border border-[var(--border)]",
                      "text-sm font-medium text-[var(--foreground)]",
                      "hover:border-purple-500/30 hover:shadow-purple-500/10",
                      "transition-all duration-200"
                    )}
                  >
                    <span>Ask NorthStar</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                      <Search className="h-3.5 w-3.5 text-purple-400" />
                    </div>
                  </Link>
                </motion.div>
              )}

              {/* Send Feedback */}
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                transition={{ duration: 0.2, delay: 0.06, ease: EASING }}
              >
                <button
                  onClick={openFeedback}
                  className={cn(
                    "flex items-center gap-2.5 rounded-full pl-4 pr-3 py-2.5 shadow-lg",
                    "bg-[var(--background)] border border-[var(--border)]",
                    "text-sm font-medium text-[var(--foreground)]",
                    "hover:border-blue-500/30 hover:shadow-blue-500/10",
                    "transition-all duration-200"
                  )}
                >
                  <span>Send Feedback</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                    <MessageSquarePlus className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

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
                      <Send className="h-5 w-5 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium">Thank you!</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Your feedback helps make Compass better for everyone.
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
                      <ExternalLink className="h-3.5 w-3.5" />
                      Submit via{" "}
                      {GITHUB_REPO_URL !== "https://github.com"
                        ? "GitHub"
                        : "Email"}
                    </button>
                    <p className="mt-2 text-center text-[10px] text-[var(--muted-foreground)]">
                      Opens in a new tab — we never collect data on our servers.
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
