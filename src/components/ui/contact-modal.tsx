/**
 * ContactModal & ContactButton
 *
 * Self-contained "Contact Us" feature:
 *   <ContactButton /> — renders the trigger link + the modal together.
 *
 * Submission goes to Formspree (https://formspree.io) which forwards the
 * form data as an email to the configured address.
 * Set NEXT_PUBLIC_FORMSPREE_ID in .env.local to enable; if the env var is
 * absent the form falls back to a mailto: link.
 *
 * Analytics: fires analytics.contactSubmitted() on successful send.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Mail,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { analytics } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUBJECTS = [
  "General Question",
  "Data Issue",
  "Feature Request",
  "Bug Report",
  "Press & Media",
  "Other",
] as const;

type Subject = (typeof SUBJECTS)[number];

// ---------------------------------------------------------------------------
// Animation variants (same easing as the rest of the app)
// ---------------------------------------------------------------------------

const EASING = [0.25, 0.1, 0.25, 1] as const;

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: EASING } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASING } },
};

const panelVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: EASING },
  },
  exit: {
    opacity: 0,
    y: 12,
    scale: 0.98,
    transition: { duration: 0.2, ease: EASING },
  },
};

// ---------------------------------------------------------------------------
// Modal props
// ---------------------------------------------------------------------------

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<Subject>("General Question");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus first field when dialog opens
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => nameRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Reset form when closing
  const handleClose = useCallback(() => {
    onClose();
    // Give animation time to finish before resetting state
    setTimeout(() => {
      setName("");
      setEmail("");
      setSubject("General Question");
      setMessage("");
      setStatus("idle");
      setErrorMsg("");
    }, 300);
  }, [onClose]);

  // Validate fields
  const isValid = name.trim().length > 0 && email.trim().length > 0 && message.trim().length > 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValid || status === "submitting") return;

      setStatus("submitting");
      setErrorMsg("");

      const formspreeId = process.env.NEXT_PUBLIC_FORMSPREE_ID;

      try {
        if (formspreeId) {
          // Formspree submission → email forwarded to configured address
          const res = await fetch(`https://formspree.io/f/${formspreeId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              email: email.trim(),
              subject,
              message: message.trim(),
              _subject: `[Compass] ${subject} — from ${name.trim()}`,
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error((data as { error?: string }).error ?? "Submission failed");
          }
        } else {
          // Fallback: open mailto link (no Formspree ID configured)
          const body = encodeURIComponent(
            `Name: ${name.trim()}\nEmail: ${email.trim()}\nSubject: ${subject}\n\n${message.trim()}`
          );
          window.open(
            `mailto:v.s.rathod@gmail.com?subject=${encodeURIComponent(`[Compass] ${subject}`)}&body=${body}`,
            "_blank"
          );
        }

        // Track submission (subject only — no PII in analytics)
        analytics.contactSubmitted(subject);

        setStatus("success");
        // Auto-close after success
        setTimeout(() => handleClose(), 3000);
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    },
    [isValid, status, name, email, subject, message, handleClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="contact-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="contact-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Contact us"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-lg",
              "-translate-x-1/2 -translate-y-1/2",
              "rounded-2xl border border-[var(--border)]",
              "bg-[var(--background)] shadow-2xl shadow-black/40"
            )}
          >
            <div className="p-6">
              {/* Header */}
              <div className="mb-5 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
                    <Mail className="h-4.5 w-4.5 text-blue-400" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Contact Us</h2>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      We typically respond within 2–3 business days.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  aria-label="Close contact form"
                  className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--foreground)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* ── Success state ── */}
              {status === "success" ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold">Message sent!</p>
                  <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                    Thank you for reaching out. We&apos;ll get back to you within
                    2–3 business days.
                  </p>
                  <button
                    onClick={handleClose}
                    className="mt-5 rounded-lg border border-[var(--border)] px-5 py-2 text-xs font-medium transition-colors hover:bg-[var(--muted)]/50"
                  >
                    Close
                  </button>
                </div>
              ) : (
                /* ── Form ── */
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  {/* Name + Email row */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="contact-name"
                        className="mb-1.5 block text-xs font-medium text-[var(--foreground)]"
                      >
                        Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        ref={nameRef}
                        id="contact-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        maxLength={100}
                        className={cn(
                          "w-full rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3.5 py-2.5",
                          "text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
                          "focus:border-[var(--accent-blue)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30",
                          "transition-colors"
                        )}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contact-email"
                        className="mb-1.5 block text-xs font-medium text-[var(--foreground)]"
                      >
                        Email <span className="text-rose-400">*</span>
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        maxLength={254}
                        className={cn(
                          "w-full rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3.5 py-2.5",
                          "text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
                          "focus:border-[var(--accent-blue)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30",
                          "transition-colors"
                        )}
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label
                      htmlFor="contact-subject"
                      className="mb-1.5 block text-xs font-medium text-[var(--foreground)]"
                    >
                      Subject
                    </label>
                    <select
                      id="contact-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value as Subject)}
                      className={cn(
                        "w-full rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3.5 py-2.5",
                        "text-sm text-[var(--foreground)]",
                        "focus:border-[var(--accent-blue)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30",
                        "transition-colors appearance-none cursor-pointer"
                      )}
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label
                      htmlFor="contact-message"
                      className="mb-1.5 block text-xs font-medium text-[var(--foreground)]"
                    >
                      Message <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can we help you?"
                      rows={4}
                      maxLength={3000}
                      className={cn(
                        "w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3.5 py-3",
                        "text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
                        "focus:border-[var(--accent-blue)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30",
                        "transition-colors"
                      )}
                    />
                    <div className="mt-1 text-right text-[10px] text-[var(--muted-foreground)]">
                      {message.length.toLocaleString()} / 3,000
                    </div>
                  </div>

                  {/* Error message */}
                  {status === "error" && (
                    <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      <p className="text-xs text-rose-400">{errorMsg}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={!isValid || status === "submitting"}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                      isValid && status !== "submitting"
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 active:scale-[0.98]"
                        : "cursor-not-allowed bg-[var(--muted)]/50 text-[var(--muted-foreground)]"
                    )}
                  >
                    {status === "submitting" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Send Message
                      </>
                    )}
                  </button>

                  <p className="text-center text-[10px] text-[var(--muted-foreground)]">
                    Your information is never shared with third parties.
                  </p>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// ContactButton — self-contained trigger + modal (drop into server components)
// ---------------------------------------------------------------------------

interface ContactButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function ContactButton({ className, children }: ContactButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]",
          className
        )}
      >
        {children ?? "Contact"}
      </button>
      <ContactModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
