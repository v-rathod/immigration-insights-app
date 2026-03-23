# Guardrails & Best Practices

> This file contains non-negotiable rules and quality standards that ensure code reliability and prevent recurring bugs.

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
