import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  stripHtml,
  sanitizeTextInput,
  validateDate,
  validateCountryCode,
  validateCategory,
  validateNumber,
  secureGet,
  secureSet,
  secureRemove,
  secureClearAll,
  isAllowedPath,
  sanitizeUrl,
  generateNonce,
} from "@/lib/security";

// ═══════════════════════════════════════════════════════════════════════════
// HTML / XSS Sanitization
// ═══════════════════════════════════════════════════════════════════════════

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
    );
  });

  it("escapes quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("escapes backticks", () => {
    expect(escapeHtml("`code`")).toBe("&#96;code&#96;");
  });

  it("returns empty string for non-string input", () => {
    expect(escapeHtml(null as unknown as string)).toBe("");
    expect(escapeHtml(undefined as unknown as string)).toBe("");
    expect(escapeHtml(123 as unknown as string)).toBe("");
  });

  it("passes through safe strings unchanged", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });
});

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<b>bold</b>")).toBe("bold");
  });

  it("handles nested tags", () => {
    expect(stripHtml("<div><p>hello</p></div>")).toBe("hello");
  });

  it("returns empty string for non-string input", () => {
    expect(stripHtml(42 as unknown as string)).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Input Validation
// ═══════════════════════════════════════════════════════════════════════════

describe("sanitizeTextInput", () => {
  it("accepts valid text", () => {
    const result = sanitizeTextInput("Google LLC");
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe("Google LLC");
  });

  it("trims whitespace", () => {
    const result = sanitizeTextInput("  Google  ");
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe("Google");
  });

  it("truncates at 500 characters", () => {
    const long = "a".repeat(600);
    const result = sanitizeTextInput(long);
    expect(result.sanitized.length).toBe(500);
  });

  it("rejects empty string", () => {
    expect(sanitizeTextInput("").valid).toBe(false);
    expect(sanitizeTextInput("   ").valid).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(sanitizeTextInput(42).valid).toBe(false);
    expect(sanitizeTextInput(null).valid).toBe(false);
  });

  it("strips unsafe characters but remains valid", () => {
    const result = sanitizeTextInput("Google <script>");
    expect(result.valid).toBe(true);
    expect(result.sanitized).not.toContain("<");
    expect(result.sanitized).not.toContain(">");
  });

  it("allows common punctuation", () => {
    const result = sanitizeTextInput("O'Brien & Co., Inc.");
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe("O'Brien & Co., Inc.");
  });
});

describe("validateDate", () => {
  it("accepts valid ISO date", () => {
    const result = validateDate("2020-03-15");
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe("2020-03-15");
  });

  it("rejects invalid format", () => {
    expect(validateDate("03/15/2020").valid).toBe(false);
    expect(validateDate("2020-3-5").valid).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(validateDate(20200315).valid).toBe(false);
  });

  it("rejects impossible dates", () => {
    expect(validateDate("2020-13-45").valid).toBe(false);
  });
});

describe("validateCountryCode", () => {
  it("accepts valid codes", () => {
    expect(validateCountryCode("IND").valid).toBe(true);
    expect(validateCountryCode("US").valid).toBe(true);
  });

  it("uppercases input", () => {
    expect(validateCountryCode("ind").sanitized).toBe("IND");
  });

  it("rejects invalid codes", () => {
    expect(validateCountryCode("INDIA").valid).toBe(false);
    expect(validateCountryCode("1").valid).toBe(false);
  });
});

describe("validateCategory", () => {
  it("accepts EB1-EB5", () => {
    expect(validateCategory("EB2").valid).toBe(true);
    expect(validateCategory("eb3").valid).toBe(true);
  });

  it("uppercases input", () => {
    expect(validateCategory("eb2").sanitized).toBe("EB2");
  });

  it("rejects invalid categories", () => {
    expect(validateCategory("EB6").valid).toBe(false);
    expect(validateCategory("H1B").valid).toBe(false);
  });
});

describe("validateNumber", () => {
  it("accepts valid numbers", () => {
    expect(validateNumber(100000).valid).toBe(true);
    expect(validateNumber("50000").valid).toBe(true);
  });

  it("respects min/max bounds", () => {
    expect(validateNumber(5, { min: 10 }).valid).toBe(false);
    expect(validateNumber(100, { max: 50 }).valid).toBe(false);
  });

  it("rejects NaN/Infinity", () => {
    expect(validateNumber(NaN).valid).toBe(false);
    expect(validateNumber(Infinity).valid).toBe(false);
    expect(validateNumber("abc").valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Secure localStorage
// ═══════════════════════════════════════════════════════════════════════════

describe("secureGet / secureSet", () => {
  it("stores and retrieves JSON", () => {
    secureSet("test", { name: "Alice" });
    expect(secureGet<{ name: string }>("test")).toEqual({ name: "Alice" });
  });

  it("returns null for missing keys", () => {
    expect(secureGet("nonexistent")).toBeNull();
  });

  it("blocks prototype pollution attempts", () => {
    // Object literals with __proto__ set the prototype, not an own property,
    // so JSON.stringify produces '{}'. Use JSON.parse to create an actual
    // own property named '__proto__' that will appear in serialized output.
    const malicious = JSON.parse('{"__proto__":{"admin":true}}');
    const result = secureSet("evil", malicious);
    expect(result).toBe(false);
  });

  it("blocks constructor injection", () => {
    const result = secureSet("evil2", { constructor: { prototype: {} } });
    expect(result).toBe(false);
  });
});

describe("secureRemove", () => {
  it("removes stored item", () => {
    secureSet("removable", "data");
    secureRemove("removable");
    expect(secureGet("removable")).toBeNull();
  });
});

describe("secureClearAll", () => {
  it("clears all compass-prefixed items", () => {
    secureSet("a", 1);
    secureSet("b", 2);
    secureClearAll();
    expect(secureGet("a")).toBeNull();
    expect(secureGet("b")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// URL Validation
// ═══════════════════════════════════════════════════════════════════════════

describe("isAllowedPath", () => {
  it("allows root", () => {
    expect(isAllowedPath("/")).toBe(true);
  });

  it("allows dashboard paths", () => {
    expect(isAllowedPath("/dashboard/employer")).toBe(true);
    expect(isAllowedPath("/dashboard/visa-bulletin")).toBe(true);
  });

  it("allows setup and insights", () => {
    expect(isAllowedPath("/setup")).toBe(true);
    expect(isAllowedPath("/insights")).toBe(true);
  });

  it("rejects external paths", () => {
    expect(isAllowedPath("/admin")).toBe(false);
    expect(isAllowedPath("/api/secret")).toBe(false);
  });

  it("ignores query params and hash", () => {
    expect(isAllowedPath("/setup?tab=1")).toBe(true);
    expect(isAllowedPath("/ask#topic")).toBe(true);
  });

  it("rejects non-string input", () => {
    expect(isAllowedPath(null as unknown as string)).toBe(false);
  });
});

describe("sanitizeUrl", () => {
  it("blocks javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
  });

  it("blocks data: protocol", () => {
    expect(sanitizeUrl("data:text/html,<h1>XSS</h1>")).toBe("#");
  });

  it("blocks vbscript: protocol", () => {
    expect(sanitizeUrl("vbscript:msgbox")).toBe("#");
  });

  it("allows normal URLs", () => {
    expect(sanitizeUrl("/dashboard/employer")).toBe("/dashboard/employer");
  });

  it("returns # for non-string", () => {
    expect(sanitizeUrl(42 as unknown as string)).toBe("#");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CSP Nonce
// ═══════════════════════════════════════════════════════════════════════════

describe("generateNonce", () => {
  it("returns a non-empty string", () => {
    const nonce = generateNonce();
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBeGreaterThan(0);
  });

  it("generates unique nonces", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});
