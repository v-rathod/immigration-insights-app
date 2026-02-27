/**
 * Security headers configuration for Compass.
 *
 * Since this is a static export, these headers must be applied
 * at the CDN level (CloudFront response headers policy).
 * This file documents and exports the canonical header values.
 */

export const SECURITY_HEADERS = {
  /** Prevent MIME type sniffing */
  "X-Content-Type-Options": "nosniff",

  /** Prevent clickjacking */
  "X-Frame-Options": "DENY",

  /** Control referrer information */
  "Referrer-Policy": "strict-origin-when-cross-origin",

  /** Enforce HTTPS */
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",

  /** Disable browser features we don't need */
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "interest-cohort=()",
  ].join(", "),

  /** Content Security Policy — static site, no inline scripts */
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // Tailwind needs inline styles
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
} as const;

/**
 * CloudFront response headers policy (Terraform/CDK reference).
 * Apply these in your infrastructure-as-code deployment.
 */
export const CLOUDFRONT_SECURITY_CONFIG = {
  responseHeadersPolicyName: "CompassSecurityHeaders",
  securityHeaders: {
    contentTypeOptions: { override: true },
    frameOptions: { frameOption: "DENY", override: true },
    referrerPolicy: {
      referrerPolicy: "strict-origin-when-cross-origin",
      override: true,
    },
    strictTransportSecurity: {
      accessControlMaxAgeSec: 31536000,
      includeSubdomains: true,
      preload: true,
      override: true,
    },
    contentSecurityPolicy: {
      contentSecurityPolicy: SECURITY_HEADERS["Content-Security-Policy"],
      override: true,
    },
  },
} as const;
