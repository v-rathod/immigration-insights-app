# Security & UI Copy Guidelines

**Read this file when:** Validating user input, handling sensitive data, or writing user-facing copy.
**Auto-updated by:** Manual updates only (standards are stable).
**Referenced in:** copilot-instructions.md → "Refer to SECURITY_UI_COPY_GUIDE.md"

---

## Security Principles

All P3 code must follow these non-negotiable security rules:

1. **Input sanitization** — All user input validated and sanitized before use (`src/lib/security/index.ts`)
   - Use `sanitizeTextInput()` for text
   - Use `validateDate()`, `validateCountryCode()`, `validateCategory()`, `validateNumber()` for structured data

2. **XSS prevention** — Block Cross-Site Scripting attacks
   - Use `escapeHtml()` for any user text rendered in DOM
   - Use `stripHtml()` for plain text extracts
   - Never use `dangerouslySetInnerHTML` except in controlled cases (MDX content, pre-sanitized)

3. **Prototype pollution defense** — Prevent object mutation attacks
   - Use `secureSet()` instead of direct object assignment for serialized data
   - Blocks `__proto__` and `constructor` properties

4. **Route allowlisting** — Prevent open redirect attacks
   - Use `isAllowedPath()` to validate all user-provided URLs before navigation
   - Exact match for `/`, prefix match for `/dashboard/`

5. **URL sanitization** — Block dangerous protocol attacks
   - Use `sanitizeUrl()` to strip `javascript:`, `data:`, `vbscript:` protocols
   - Applied to all `href` and link destinations

6. **Secure storage** — Protect localStorage from injection
   - All localStorage access through `secureGet/Set/Remove/ClearAll` with `compass_` prefix
   - Prevents key collisions and namespace pollution
   - No sensitive data (API keys, passwords, tokens) ever stored

7. **CSP headers** — Content Security Policy configured
   - Configured for CloudFront deployment (`src/lib/security/headers.ts`)
   - Blocks inline scripts, restricts external resources
   - Prevents clickjacking via X-Frame-Options

8. **No secrets in client** — Zero credentials in codebase
   - API keys in `.env*` (never committed)
   - No hardcoded passwords or tokens
   - Groq API key in `.env.local` only (not in git)

---

## Implementation Checklist

For **every form, input, or user-facing feature**:

- [ ] User input validated with appropriate `validate*()` function
- [ ] Text output escaped with `escapeHtml()` or `sanitizeTextInput()`
- [ ] Navigation URLs checked with `isAllowedPath()` or `sanitizeUrl()`
- [ ] localStorage updates wrapped in `secureSet()` call
- [ ] No hardcoded sensitive data
- [ ] TypeScript strict mode enabled (no `any` types)

---

## UI Copy Rules (MANDATORY — applies to ALL pages)

### Rule 1: No em-dashes
**NEVER use `—` or `&mdash;` in user-facing text or JSX.**

Instead use:
- `:` for labels (e.g., "Priority Date: March 15, 2023")
- `,` or `;` for prose (e.g., "The forecast shows growth, according to official data")
- `|` for metadata separators (e.g., "EB2 | USA | Priority Date")
- En-dashes (`–`, `&ndash;`) are correct and must stay (e.g., "2020–2023 period")

**Examples:**
- ❌ Bad: "The forecast — based on recent data — shows..."
- ✅ Good: "The forecast based on recent data shows..."

### Rule 2: No AI marketing markers
**NEVER use these words in user-facing copy:**
- *unlock*, *discover*, *journey*, *empower*, *leverage*, *seamless*
- *comprehensive*, *cutting-edge*, *revolutionize*, *delve*, *dive*
- *holistic*, *tailored*, *supercharge*, *game-changing*
- *transform* (when used as marketing filler, e.g., "transform your immigration journey")

Use plain, direct language instead.

**Examples:**
- ❌ Bad: "Unlock powerful insights and discover your immigration journey"
- ✅ Good: "See your priority date forecast and employer sponsorship score"

### Additional Copy Standards

- **Clarity over cleverness** — Data should be immediately comprehensible
- **Action-oriented CTAs** — "See your forecast", "View top employers", not "Learn more"
- **Avoid jargon** — Explain technical terms or use simpler alternatives
- **Consistent terminology** — Use "priority date" (not "PD"), "sponsorship score" (not "SRS" in UI)
- **Numbers**: Format with commas (e.g., "102,225 employers", not "102225")
- **Dates**: Display as "Month Year" in UI (e.g., "March 2026"), ISO-8601 in data

---

## Copy Checklist (Before Committing)

For **every new text, button label, heading, or user message**:

- [ ] No em-dashes (`—`)
- [ ] No AI marketing words (*unlock*, *discover*, *journey*, etc.)
- [ ] Clear, concise language (read aloud — does it sound natural?)
- [ ] Numbers formatted with commas
- [ ] Dates in correct format (UI: "Month Year", data: ISO-8601)
- [ ] CTA is action-oriented ("See X" not "Learn more")
- [ ] Terminology consistent with rest of app

---

## Security Testing

Run these checks before every production deploy:

```bash
# Validate security module
npm test -- security

# Check for hardcoded secrets (regex pattern)
grep -r "NEXT_PUBLIC_" src/ --include="*.ts" --include="*.tsx" | grep -v ".env"

# Verify no console.log of user data
grep -r "console.log.*user\|console.log.*data" src/ --include="*.ts" --include="*.tsx"

# Lint TypeScript (strict mode)
npx tsc --noEmit
```

---

## UI Copy Evolution Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-20 | Removed all em-dashes from copilot-instructions.md | Follow Rule 1 |
| 2026-03-18 | Removed "unlock", "discover", marketing terms | Follow Rule 2 (M10.75) |
| 2026-03-15 | Standardized "sponsorship score" (not "SRS" in UI) | Clarity |

---

## External Security Resources

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **MDN Web Security**: https://developer.mozilla.org/en-US/docs/Web/Security
- **WCAG 2.1 AA Accessibility**: https://www.w3.org/WAI/WCAG21/quickref/
