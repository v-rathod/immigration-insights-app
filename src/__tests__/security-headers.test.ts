import { describe, it, expect } from "vitest";
import {
  SECURITY_HEADERS,
  CLOUDFRONT_SECURITY_CONFIG,
} from "@/lib/security/headers";

describe("Security Headers", () => {
  it("sets X-Content-Type-Options to nosniff", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("sets X-Frame-Options to DENY", () => {
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
  });

  it("sets Referrer-Policy", () => {
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
  });

  it("sets HSTS with preload", () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain(
      "max-age=31536000"
    );
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain("preload");
  });

  it("disables dangerous permissions", () => {
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("camera=()");
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("microphone=()");
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("geolocation=()");
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("payment=()");
  });

  it("sets CSP with frame-ancestors none", () => {
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'"
    );
  });

  it("CSP restricts script-src to self", () => {
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain(
      "script-src 'self'"
    );
  });

  it("CSP blocks object-src", () => {
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain(
      "object-src 'none'"
    );
  });
});

describe("CloudFront Security Config", () => {
  it("has correct policy name", () => {
    expect(CLOUDFRONT_SECURITY_CONFIG.responseHeadersPolicyName).toBe(
      "CompassSecurityHeaders"
    );
  });

  it("sets frame options to DENY", () => {
    expect(
      CLOUDFRONT_SECURITY_CONFIG.securityHeaders.frameOptions.frameOption
    ).toBe("DENY");
  });

  it("enables HSTS preload", () => {
    expect(
      CLOUDFRONT_SECURITY_CONFIG.securityHeaders.strictTransportSecurity.preload
    ).toBe(true);
  });
});
