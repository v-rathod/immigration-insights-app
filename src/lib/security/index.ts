/**
 * Security utilities for Compass.
 *
 * Implements defense-in-depth patterns:
 * - Input sanitization (XSS prevention)
 * - Secure localStorage wrapper (JSON parse safety)
 * - Content Security Policy helpers
 * - URL validation
 */

// ---------------------------------------------------------------------------
// HTML / XSS Sanitization
// ---------------------------------------------------------------------------

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
};

const ESCAPE_REGEX = /[&<>"'/`]/g;

/**
 * Escape HTML special characters to prevent XSS.
 * Use when rendering user-provided text in the DOM.
 */
export function escapeHtml(str: string): string {
  if (typeof str !== "string") return "";
  return str.replace(ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Strip all HTML tags from a string.
 */
export function stripHtml(str: string): string {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "");
}

// ---------------------------------------------------------------------------
// Input Validation
// ---------------------------------------------------------------------------

/** Maximum length for free-text user inputs */
const MAX_INPUT_LENGTH = 500;

/** Allowed characters for employer name, job title, location */
const SAFE_TEXT_REGEX = /^[\w\s,.'-/()&#+@]*$/;

/** ISO date format */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Country code format (2-3 uppercase alpha) */
const COUNTRY_CODE_REGEX = /^[A-Z]{2,3}$/;

/** EB category format */
const CATEGORY_REGEX = /^EB[1-5]$/i;

export interface ValidationResult {
  valid: boolean;
  sanitized: string;
  error?: string;
}

/**
 * Validate and sanitize free-text input (employer name, job title, etc.)
 */
export function sanitizeTextInput(input: unknown): ValidationResult {
  if (typeof input !== "string") {
    return { valid: false, sanitized: "", error: "Input must be a string" };
  }

  const trimmed = input.trim().slice(0, MAX_INPUT_LENGTH);

  if (trimmed.length === 0) {
    return { valid: false, sanitized: "", error: "Input cannot be empty" };
  }

  if (!SAFE_TEXT_REGEX.test(trimmed)) {
    // Strip unsafe characters instead of rejecting
    const cleaned = trimmed.replace(/[^\w\s,.'-/()&#+@]/g, "");
    return { valid: true, sanitized: cleaned };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate ISO date string (YYYY-MM-DD).
 */
export function validateDate(input: unknown): ValidationResult {
  if (typeof input !== "string") {
    return { valid: false, sanitized: "", error: "Date must be a string" };
  }

  const trimmed = input.trim();
  if (!ISO_DATE_REGEX.test(trimmed)) {
    return { valid: false, sanitized: "", error: "Date must be YYYY-MM-DD format" };
  }

  // Verify it's an actual valid date
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    return { valid: false, sanitized: "", error: "Invalid date" };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate country code (2-3 uppercase alpha).
 */
export function validateCountryCode(input: unknown): ValidationResult {
  if (typeof input !== "string") {
    return { valid: false, sanitized: "", error: "Country code must be a string" };
  }

  const upper = input.trim().toUpperCase();
  if (!COUNTRY_CODE_REGEX.test(upper)) {
    return { valid: false, sanitized: "", error: "Invalid country code" };
  }

  return { valid: true, sanitized: upper };
}

/**
 * Validate EB category (EB1-EB5).
 */
export function validateCategory(input: unknown): ValidationResult {
  if (typeof input !== "string") {
    return { valid: false, sanitized: "", error: "Category must be a string" };
  }

  const upper = input.trim().toUpperCase();
  if (!CATEGORY_REGEX.test(upper)) {
    return { valid: false, sanitized: "", error: "Category must be EB1-EB5" };
  }

  return { valid: true, sanitized: upper };
}

/**
 * Validate numeric input (wage, years of experience).
 */
export function validateNumber(
  input: unknown,
  opts: { min?: number; max?: number } = {}
): { valid: boolean; value: number; error?: string } {
  const num = typeof input === "string" ? parseFloat(input) : Number(input);

  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, value: 0, error: "Must be a valid number" };
  }

  if (opts.min !== undefined && num < opts.min) {
    return { valid: false, value: num, error: `Must be at least ${opts.min}` };
  }

  if (opts.max !== undefined && num > opts.max) {
    return { valid: false, value: num, error: `Must be at most ${opts.max}` };
  }

  return { valid: true, value: num };
}

// ---------------------------------------------------------------------------
// Secure localStorage Wrapper
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "compass_";

/**
 * Securely read a JSON value from localStorage.
 * Returns null if key doesn't exist, data is corrupted, or parse fails.
 */
export function secureGet<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupted data — remove it
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch {
      // localStorage might be disabled
    }
    return null;
  }
}

/**
 * Securely write a JSON value to localStorage.
 * Returns true on success, false if storage is unavailable.
 */
export function secureSet<T>(key: string, value: T): boolean {
  try {
    const serialized = JSON.stringify(value);
    // Guard against prototype pollution in serialized data
    if (serialized.includes("__proto__") || serialized.includes("constructor")) {
      console.warn("[Compass Security] Blocked suspicious data write");
      return false;
    }
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a value from localStorage.
 */
export function secureRemove(key: string): void {
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // localStorage might be disabled
  }
}

/**
 * Clear all Compass data from localStorage.
 */
export function secureClearAll(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // localStorage might be disabled
  }
}

// ---------------------------------------------------------------------------
// URL Validation
// ---------------------------------------------------------------------------

/** Exact paths allowed as internal routes */
const ALLOWED_EXACT_PATHS = ["/", "/setup", "/insights", "/ops", "/about", "/privacy", "/terms"] as const;

/** Path prefixes allowed as internal routes */
const ALLOWED_PREFIX_PATHS = [
  "/setup/",
  "/insights/",
  "/dashboard/",
  "/ops/",
] as const;

/**
 * Validate that a URL path is an allowed internal route.
 * Prevents open redirect attacks.
 */
export function isAllowedPath(path: string): boolean {
  if (typeof path !== "string") return false;
  const normalized = path.split("?")[0].split("#")[0];
  if (ALLOWED_EXACT_PATHS.some((p) => normalized === p)) return true;
  if (ALLOWED_PREFIX_PATHS.some((p) => normalized.startsWith(p))) return true;
  return false;
}

/**
 * Sanitize a URL to prevent javascript: and data: protocol attacks.
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== "string") return "#";
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:")
  ) {
    return "#";
  }
  return url;
}

// ---------------------------------------------------------------------------
// CSP Nonce (for inline scripts if ever needed)
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographic nonce for CSP headers.
 * Uses Web Crypto API (available in all modern browsers).
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}
