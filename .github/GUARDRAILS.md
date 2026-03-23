# P3 Compass — Project Guardrails

> **Compass** is the user-facing web application for NorthStar. These guardrails protect the static-site architecture, user experience quality, security, and the testing contract.
>
> **Read the program-wide Ten Commandments first**: `/Users/vrathod1/dev/NorthStar/northstar-docs/GUARDRAILS.md`

---

## P3 Commandments (Non-Negotiable)

### 1. Static Export, No Exceptions

`output: 'export'` in `next.config.ts`. No API routes. No server components that fetch at runtime. No middleware. No `getServerSideProps`. The build produces `out/` with pure HTML/CSS/JS files served from S3.

**Why**: A static site has zero attack surface, zero server costs, zero cold starts, and infinite scalability via CDN.

### 2. Zero Backend, Zero Database

The app has no Lambda, no database, no API Gateway, no server. All data is pre-built JSON served from S3/CloudFront. If you need computed data, add it to P2 Meridian, never to P3.

**Why**: This keeps AWS costs at $1-3/month and eliminates an entire class of security, scaling, and operational concerns.

### 3. TypeScript Strict Mode, Always

No `any`. No unexplained type assertions. All P2 artifact schemas typed in `src/types/p2-artifacts.ts`. All component props typed with interfaces. `strict: true` in `tsconfig.json`.

**Why**: TypeScript strict mode catches an entire class of bugs at compile time. Every `any` is a hole in the safety net.

### 4. Deploy Only Via deploy.sh

**ALWAYS use `bash scripts/deploy.sh`**. NEVER run `aws s3 sync` directly. The deploy script uses `--exact-timestamps` to prevent stale HTML with mismatched CSS/JS bundle hashes. It runs pre-flight checks and post-deploy smoke tests.

**Why**: Direct S3 sync can leave stale HTML files referencing deleted JS bundles, producing blank white pages in production.

### 5. Client-Side Interactivity Only

All search, filtering, and personalization runs in the browser. Fuse.js for search. localStorage for persistence. No external API calls for core functionality (LLM for Ask page is optional enhancement, not critical path).

**Why**: Client-side-only means the app works offline after first load, has zero privacy concerns (no data leaves the device), and requires no server infrastructure.

### 6. Smart Visibility: Never Render Empty Widgets

Never render a widget whose only output is "please provide input". If a component requires user input, hide it entirely until input exists. Replace with a clear CTA.

**Why**: Empty widgets waste screen space, confuse users, and undermine trust. The data-first design means every visible element should show meaningful content.

### 7. Tailwind Only, Aurora Design System

No CSS modules. No styled-components. No inline styles except for dynamic values. All colors via CSS custom properties (`var(--accent-blue)`). Glassmorphic cards with `backdrop-blur-xl bg-white/[0.03]`. Dark-first design.

**Why**: Consistent design language builds user trust. CSS-in-JS approaches create invisible complexity and hurt performance.

### 8. Security at Every Boundary

`sanitizeTextInput()` on all user text. `escapeHtml()` before rendering. `secureGet/Set/Remove` for localStorage. `sanitizeUrl()` blocks dangerous protocols. No API keys in source code.

**Why**: P3 is the public-facing surface. Every XSS vector, every unsanitized input, every leaked key is a direct user-facing risk.

---

## Regression Testing (CRITICAL — MANDATORY FOR ALL FIXES)

> **CORE PRINCIPLE: Whenever you fix broken functionality, you MUST add test cases to prevent silent recurrence.**

This is non-negotiable. A silent recurrence of a bug in production is far costlier than spending 30 minutes adding regression tests now. Tests are the contract between you and future agents.

### When to Add Regression Tests
- **After EVERY bug fix** — no exceptions
- **Before deployment** — regression tests must pass locally before any commit
- **Part of the commit** — fix + tests + documentation are committed together

### How to Add Regression Tests

1. **Identify affected scenarios**
   - The exact scenario that was broken
   - All edge cases and related variations
   - When multiple similar cases exist, use parameterized tests (e.g., all 7 employers affected by one bug)

2. **Integrate into existing test suite** — not in isolation
   - For data/loader bugs: add to `src/__tests__/[domain]-data.test.ts`
   - For component bugs: add to `src/__tests__/[domain]-components.test.tsx`
   - For cross-cutting issues: create a new `describe()` block with date + objective
   - Example: `describe("employer name normalization (Milestone 13 regression)", ...)`

3. **Write comprehensive tests**
   - Cover the root cause that was fixed
   - Include edge cases (spacing, case sensitivity, boundary conditions)
   - Test integration with dependent functions
   - Verify symmetry (if applicable)
   - Use real data from the codebase when possible

4. **All regression tests MUST pass locally**
   - Run `npm test` to verify
   - No existing tests should be broken
   - Zero failures required before committing

5. **Document the pattern**
   - Update `TEST_AUDIT.md` "Regression Testing Patterns" section with:
     - Root cause of the bug
     - Solution applied
     - Test cases added (with line references)
     - How to replicate this pattern for future defects
   - Update `PROGRESS.md` with a milestone entry documenting the regression suite
   - Link to test code in ARCHITECTURE_DECISIONS.md

### Example: Cognizant Employer Name Fix

**The Bug**: Cognizant & 6 other employers showed "No trend data available"

**Root Cause**: Search index stored `"Cognizant Technology Solutions US"` (uppercase) but shard data stored `"Cognizant Technology Solutions Us"` (title-case) — strict `===` equality failed.

**The Fix**: 
- Exported `normalizeEmployerName()` function using `.toLowerCase().replace(/\bu\s+s\b/g, 'us')`
- Updated 3 wage functions to use normalized comparison

**Regression Tests Added** (src/__tests__/wage-dashboard.test.tsx lines 495-630):
- 7 `normalizeEmployerName()` edge case tests (lowercase, spacing, word boundaries)
- 5 integration tests for `getEmployerTrend()` with mismatched names
- 1 test for `getEmployerRoleTrendSeries()`
- 1 test for `getEmployerRoles()`
- 7 parameterized tests for all known mismatch employers
- 1 symmetry verification test
- **Total: 25 comprehensive regression tests**

**Documentation**:
- Added case study in TEST_AUDIT.md "Regression Testing Patterns" (60+ lines)
- Added decision entries in ARCHITECTURE_DECISIONS.md
- Added Milestone 14.0 in PROGRESS.md with full narrative
- Added playbook section in NEXT_AGENT_CONTEXT.md for next agent reference

**Outcome**: All 7 employers now work correctly. Pattern documented for future defects. Silent recurrence prevented.

---

## Quality Gates (before every commit)

✅ **MANDATORY**:
- `npm test` passes with zero failures (including all regression tests)
- TypeScript strict mode: 0 errors
- ESLint: 0 errors
- Mobile tests required for UI changes
- **For any bug fix: Regression test suite MUST exist and MUST pass**

⚠️ **RED FLAGS**:
- Committing a bug fix without regression tests = violation of guardrails
- Regression tests that don't pass locally = never commit
- Regression tests added AFTER deployment = too late; prevent production incidents first
- Regression test added in isolation (not integrated into test suite) = violates structure

---

## Test Suite Organization

### Test File Naming & Location

| Domain | File Path | Purpose |
|--------|-----------|---------|
| **Wage dashboard** | `src/__tests__/wage-dashboard.test.tsx` | Wage trend, employer lookup, data loading |
| **SRS dashboard** | `src/__tests__/srs-*.test.ts` | SRS components and data |
| **PDI dashboard** | `src/__tests__/pdi-*.test.tsx` | PDI components and data |
| **Security** | `src/__tests__/security.test.ts` | Input sanitization, XSS prevention |
| **Data loaders** | `src/__tests__/dashboard-data-loaders.test.ts` | All dashboard data load functions |
| **Components** | `src/__tests__/[domain]-components.test.tsx` | UI component rendering & behavior |
| **Utilities** | `src/__tests__/[util].test.ts` | Formatters, helpers, normalization |

### Regression Test Pattern

```tsx
describe("employer name normalization (Milestone 13 regression)", () => {
  // Edge case tests for the normalization function
  it("should normalize U S to us", () => {
    expect(normalizeEmployerName("Ernst Young U S")).toBe("ernst young us");
  });

  it("should handle multiple spaces between US", () => {
    expect(normalizeEmployerName("Company U  S Inc")).toBe("company u  s inc");
  });

  // Integration tests
  it("should match Cognizant with case-insensitive search", () => {
    const trend = getEmployerTrend(
      allTrends,
      "Cognizant Technology Solutions US",
      "Cognizant Technology Solutions Us" // Different casing in shard
    );
    expect(trend).not.toEqual("No trend data available");
  });

  // Parameterized tests for all affected cases
  const affectedEmployers = [
    "Cognizant", "itech", "Ernst Young", // ... all 7
  ];
  
  affectedEmployers.forEach((emp) => {
    it(`should work with ${emp}`, () => {
      // Test implementation
    });
  });
});
```

---

## Preventing Silent Recurrence

### Why Regression Tests Matter

1. **Contract Between Agents**: Tests are the only way a future agent knows a bug existed and was fixed
2. **Automation**: Tests run automatically with every build — no manual memory required
3. **Confidence**: If a regression test fails, we know immediately. If tests don't exist, we won't know until users report it
4. **Cost**: Adding tests during fix = 30 min. Silent production bug = hours + user impact + reputation damage

### What Happens Without Regression Tests

1. Agent A fixes bug X (no tests added)
2. Agent B refactors code Y (unaware of bug X's fragile fix)
3. Bug X silently recurs in production
4. Users report issue → support → investigation → emergency fix → reputation damage

### What Happens With Regression Tests

1. Agent A fixes bug X + adds 20 tests covering all scenarios
2. Agent B refactors code Y
3. `npm test` fails immediately (Agent B sees the regression)
4. Agent B either preserves the fix or updates tests with awareness
5. Bug X never hits production

---

## Documentation Requirements

When adding regression tests, update these files in order:

### 1. Add tests first
- File: `src/__tests__/[domain]-*.test.tsx`
- Ensure all tests pass locally: `npm test`

### 2. Document in TEST_AUDIT.md
- Update "Regression Testing Patterns" section
- Include: root cause, fix applied, test count, file references, pattern replication guide

### 3. Update ARCHITECTURE_DECISIONS.md
- Add entry to "Testing" table with regression test decision + rationale

### 4. Add milestone in PROGRESS.md
- Timestamped entry with objective, what was built, files modified, commit hash

### 5. Update NEXT_AGENT_CONTEXT.md
- Reference playbook section if this is establishing a new pattern

---

## Checklist for Agents

Before committing ANY bug fix:

- [ ] Root cause identified and documented (comment in code or commit message)
- [ ] Fix applied and tested manually
- [ ] Regression test cases written
- [ ] All regression tests pass locally (`npm test`)
- [ ] Regression tests are integrated into the test suite (not isolated)
- [ ] TEST_AUDIT.md updated with case study
- [ ] PROGRESS.md updated with milestone
- [ ] Commit message includes reference to regression tests
- [ ] All 3 (fix + tests + docs) committed together
- [ ] No test breakage in existing test suite

---

## FAQ

**Q: Can I deploy a bug fix without regression tests?**  
A: No. This violates guardrails. Tests must pass locally before any commit.

**Q: What if the bug is very simple and obvious?**  
A: Still add regression tests. Simple bugs often recur for simple reasons. Tests catch them.

**Q: Can regression tests be added after deployment?**  
A: Prefer to add BEFORE. If discovered post-deploy, add immediately to prevent recurrence.

**Q: How many regression tests are enough?**  
A: Enough to cover: root cause + edge cases + integration scenarios + all affected entities. Better to have 20 passing tests than 3 insufficient ones.

**Q: What if I'm refactoring and I break a regression test?**  
A: STOP. Don't commit. Either preserve the fix that regression test is protecting, or intentionally deprecate the old behavior WITH new tests for the new behavior.

---

## Additional P3 Guardrails

### Quality Gates (before every commit)

| Gate | Check | Command |
|------|-------|---------|
| Unit tests | 1,206+ pass, 0 fail | `npm test` |
| TypeScript | 0 errors, strict mode | `npx tsc --noEmit` |
| ESLint | 0 errors | `npm run lint` |
| Mobile (for UI changes) | Touch targets, responsive layout | `npm run test:e2e:mobile` |
| Build | Static export succeeds | `npm run build` |
| Regression tests | All fix-related tests pass | `npm test` |

### UI & Design Guardrails

| # | Guardrail | Enforcement |
|---|-----------|-------------|
| U1 | Tailwind only: no CSS modules, no styled-components | Code review |
| U2 | Dark-first design with CSS variable tokens | `globals.css` tokens |
| U3 | Framer Motion with standard easing `[0.25, 0.1, 0.25, 1]` | Convention |
| U4 | Smart Visibility: never render empty "please provide input" widgets | Component review |
| U5 | Number formatting via `Intl.NumberFormat` with commas | Convention |
| U6 | Dates displayed as "Month YYYY", stored as ISO-8601 | Convention |
| U7 | `font-mono` for all numeric data cells | Aurora design system |
| U8 | Server components by default; `"use client"` only for interactivity | Next.js architecture |
| U9 | No em-dashes (`—`) in user-facing text | UI copy rules |
| U10 | No AI marketing filler words | UI copy rules |

### Data Handling Guardrails

| # | Guardrail | Enforcement |
|---|-----------|-------------|
| D1 | Co-locate data loaders: `src/lib/data/[topic].ts` per dashboard | Architecture |
| D2 | P2 field remap at loader boundary (EFS→SRS, NaN→null) | Data loaders |
| D3 | Employer shard lookup via `_index.json` hash, not raw name | `employer-shard.ts` |
| D4 | Case-insensitive employer matching with `normalizeEmployerName()` | Regression-tested |
| D5 | UTC timezone for all date formatters (prevents test failures) | Convention |

### Security Guardrails

| # | Guardrail | Enforcement |
|---|-----------|-------------|
| S1 | `sanitizeTextInput()` on all user-provided text | `src/lib/security/` |
| S2 | `escapeHtml()` before rendering user-supplied text | XSS prevention |
| S3 | `secureGet/Set/Remove/ClearAll()` for all localStorage | `compass_` prefix |
| S4 | URL validation blocks `javascript:`, `data:`, `vbscript:` | `sanitizeUrl()` |
| S5 | No API keys, tokens, or credentials in source code | Git review |
| S6 | `.env.local` always gitignored | `.gitignore` |
| S7 | Only permitted env vars: `NEXT_PUBLIC_POSTHOG_*`, `NEXT_PUBLIC_GROQ_API_KEY`, `NEXT_PUBLIC_FORMSPREE_ID` | Convention |

### Deployment Guardrails

| # | Guardrail | Enforcement |
|---|-----------|-------------|
| DP1 | Deploy only via `bash scripts/deploy.sh` | Standing instruction |
| DP2 | Never deploy without explicit user request | Standing instruction |
| DP3 | Pre-flight checks: HTML count, `_next/static/` present, CSS non-empty | `deploy.sh` |
| DP4 | Post-deploy smoke tests (238+ checks) must pass | `scripts/smoke-test.mjs` |
| DP5 | CloudFront invalidation after every deploy | `deploy.sh` |
| DP6 | Employer shards synced with `--size-only` optimization | `deploy.sh` |

---

## Cross-References

- **Program-wide guardrails (Ten Commandments)**: `/Users/vrathod1/dev/NorthStar/northstar-docs/GUARDRAILS.md`
- **P1 Horizon guardrails**: `/Users/vrathod1/dev/NorthStar/fetch-immigration-data/.github/GUARDRAILS.md`
- **P2 Meridian guardrails**: `/Users/vrathod1/dev/NorthStar/immigration-model-builder/.github/GUARDRAILS.md`
- **P2→P3 data contract**: `src/types/p2-artifacts.ts` (this repo) + `configs/schemas.yml` (P2 repo)
- **Test audit**: [TEST_AUDIT.md](./TEST_AUDIT.md)
- **Architecture decisions**: [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md)
