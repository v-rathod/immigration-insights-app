/**
 * Tests for src/lib/env.ts — getEnvironment() runtime detection.
 *
 * The key capability this tests: the same JS bundle deployed to both stage
 * and prod correctly self-identifies based on hostname, enabling artifact
 * promotion without needing separate env-specific builds for analytics tagging.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getEnvironment } from "@/lib/env";

// ── Helpers ───────────────────────────────────────────────────────────────────

function withHostname(hostname: string, fn: () => void) {
  const original = window.location.hostname;
  Object.defineProperty(window, "location", {
    value: { ...window.location, hostname },
    writable: true,
    configurable: true,
  });
  fn();
  Object.defineProperty(window, "location", {
    value: { ...window.location, hostname: original },
    writable: true,
    configurable: true,
  });
}

// ── Hostname-based detection (client-side) ────────────────────────────────────

describe("getEnvironment — hostname detection (client-side)", () => {
  it('returns "prod" for immigrationcompass.fyi', () => {
    withHostname("immigrationcompass.fyi", () => {
      expect(getEnvironment()).toBe("prod");
    });
  });

  it('returns "prod" for www.immigrationcompass.fyi', () => {
    withHostname("www.immigrationcompass.fyi", () => {
      expect(getEnvironment()).toBe("prod");
    });
  });

  it('returns "dev" for localhost', () => {
    withHostname("localhost", () => {
      expect(getEnvironment()).toBe("dev");
    });
  });

  it('returns "dev" for 127.0.0.1', () => {
    withHostname("127.0.0.1", () => {
      expect(getEnvironment()).toBe("dev");
    });
  });

  it('returns "dev" for 192.168.x.x (LAN dev)', () => {
    withHostname("192.168.1.100", () => {
      expect(getEnvironment()).toBe("dev");
    });
  });

  it('returns "stage" for CloudFront stage domain', () => {
    withHostname("d10immmzyp7xgr.cloudfront.net", () => {
      expect(getEnvironment()).toBe("stage");
    });
  });

  it('returns "stage" for stage.immigrationcompass.fyi', () => {
    withHostname("stage.immigrationcompass.fyi", () => {
      expect(getEnvironment()).toBe("stage");
    });
  });

  it('returns "stage" for any unknown domain (safe default)', () => {
    withHostname("preview.example.com", () => {
      expect(getEnvironment()).toBe("stage");
    });
  });

  it("hostname check overrides NEXT_PUBLIC_APP_ENV=stage for prod hostname", () => {
    // This is the artifact promotion case: bundle was built with stage env var
    // but is now served from the prod hostname.
    const original = process.env.NEXT_PUBLIC_APP_ENV;
    process.env.NEXT_PUBLIC_APP_ENV = "stage";
    withHostname("immigrationcompass.fyi", () => {
      expect(getEnvironment()).toBe("prod"); // hostname wins
    });
    process.env.NEXT_PUBLIC_APP_ENV = original;
  });

  it("hostname check overrides NEXT_PUBLIC_APP_ENV=prod for dev hostname", () => {
    const original = process.env.NEXT_PUBLIC_APP_ENV;
    process.env.NEXT_PUBLIC_APP_ENV = "prod";
    withHostname("localhost", () => {
      expect(getEnvironment()).toBe("dev"); // hostname wins
    });
    process.env.NEXT_PUBLIC_APP_ENV = original;
  });
});

// ── Build-time env var fallback (SSR / no window) ────────────────────────────

describe("getEnvironment — NEXT_PUBLIC_APP_ENV fallback (SSR)", () => {
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    originalWindow = global.window;
    // Suppress window to simulate SSR
    // @ts-expect-error — intentionally removing window for SSR test
    delete global.window;
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  it('returns the NEXT_PUBLIC_APP_ENV value when set to "prod"', () => {
    const original = process.env.NEXT_PUBLIC_APP_ENV;
    process.env.NEXT_PUBLIC_APP_ENV = "prod";
    expect(getEnvironment()).toBe("prod");
    process.env.NEXT_PUBLIC_APP_ENV = original;
  });

  it('returns the NEXT_PUBLIC_APP_ENV value when set to "stage"', () => {
    const original = process.env.NEXT_PUBLIC_APP_ENV;
    process.env.NEXT_PUBLIC_APP_ENV = "stage";
    expect(getEnvironment()).toBe("stage");
    process.env.NEXT_PUBLIC_APP_ENV = original;
  });

  it('returns the NEXT_PUBLIC_APP_ENV value when set to "dev"', () => {
    const original = process.env.NEXT_PUBLIC_APP_ENV;
    process.env.NEXT_PUBLIC_APP_ENV = "dev";
    expect(getEnvironment()).toBe("dev");
    process.env.NEXT_PUBLIC_APP_ENV = original;
  });

  it('ignores invalid NEXT_PUBLIC_APP_ENV values (falls back to NODE_ENV)', () => {
    const original = process.env.NEXT_PUBLIC_APP_ENV;
    process.env.NEXT_PUBLIC_APP_ENV = "unknown-value";
    // In test environment NODE_ENV is normally "test", not "production", so returns "dev"
    const result = getEnvironment();
    expect(["dev", "prod", "stage"]).toContain(result);
    process.env.NEXT_PUBLIC_APP_ENV = original;
  });

  it('returns "prod" when NEXT_PUBLIC_APP_ENV is unset and NODE_ENV is production', () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_ENV;
    const originalNode = process.env.NODE_ENV;
    delete process.env.NEXT_PUBLIC_APP_ENV;
    // NODE_ENV is read-only in some runtimes; guard against TypeError
    try {
      // @ts-expect-error — overriding for test
      process.env.NODE_ENV = "production";
      expect(getEnvironment()).toBe("prod");
    } finally {
      // @ts-expect-error — restoring
      process.env.NODE_ENV = originalNode;
      process.env.NEXT_PUBLIC_APP_ENV = originalEnv;
    }
  });

  it('returns "dev" when NEXT_PUBLIC_APP_ENV is unset and NODE_ENV is test', () => {
    const original = process.env.NEXT_PUBLIC_APP_ENV;
    delete process.env.NEXT_PUBLIC_APP_ENV;
    // NODE_ENV = "test" in vitest → not "production" → returns "dev"
    expect(getEnvironment()).toBe("dev");
    process.env.NEXT_PUBLIC_APP_ENV = original;
  });
});
