# Code Change Workflow — Test-First Enforcement

> **This is the mandatory workflow for every code change in Compass.**
> Part of Guardrail #13: "Mandatory Test Workflow"

---

## Principle

**No code change is complete until tests pass.**

Tests are not an afterthought. They are:
- Part of the same commit as the code change
- Verified to pass before pushing
- Required for any behavioral change

---

## Step-by-Step Workflow

### 1️⃣ BEFORE You Touch Any Code

**Research what tests exist for this functionality.**

```bash
# Search for related test files
find src/__tests__ -name "*[feature-name]*"

# Search for tests that reference the component/function
grep -r "ComponentName\|functionName" src/__tests__/

# List all test files
ls -la src/__tests__/
```

**Document what you find:**
- Which test files test this component?
- How many test cases currently exist?
- Are there gaps in test coverage?

### 2️⃣ Understand the Current Tests

**Read the existing tests to understand expected behavior.**

```bash
# Open test file and read it
cat src/__tests__/my-component.test.tsx
```

**Ask yourself:**
- What behavior do these tests verify?
- What will change after my code changes?
- Which assertions will need updating?
- Do I need to add new test cases?

### 3️⃣ Make Your Code Changes

**Now implement the feature/fix.**

### 4️⃣ Update Tests IMMEDIATELY After

**Don't push. Update tests first.**

**Changes to make:**

| Scenario | Test Update |
|----------|------------|
| Changed default behavior | Update the "default" test case |
| Added new feature | Add new test cases for it |
| Renamed function/prop | Update all references in tests |
| Fixed a bug | Add regression test to prevent recurrence |
| Removed code | Remove or update related tests |
| Changed API surface | Update mocks/stubs |

**Example: Default theme changed from "dark" to "light"**

```typescript
// ❌ OLD TEST
it("defaults to dark theme", async () => {
  expect(await screen.findByTestId("theme")).toHaveTextContent("dark");
});

// ✅ NEW TEST
it("defaults to light theme", async () => {
  expect(await screen.findByTestId("theme")).toHaveTextContent("light");
});
```

### 5️⃣ Verify All Tests Pass

```bash
# Run tests for your specific files
npm test -- --run [test-pattern]

# Run ALL tests
npm test -- --run

# TypeScript strict mode
npx tsc --noEmit

# ESLint
npx eslint src/components/your-file.tsx
```

**Don't proceed until:**
- ✅ All tests pass
- ✅ TypeScript strict mode: 0 errors
- ✅ ESLint: 0 errors

### 6️⃣ Commit Code + Tests Together

```bash
# Stage both the code change AND the test update
git add src/components/my-component.tsx src/__tests__/my-component.test.tsx

# Commit with clear message explaining what changed
git commit -m "feat: change default theme to light mode

- Code: Updated ThemeProvider default from 'dark' to 'light'
- Tests: Updated 2 test cases to reflect new default
- Tests: Updated 1 toggle test to match new initial state
- Result: 10 tests passing"
```

### 7️⃣ Push to Git

```bash
git push origin main
```

---

## Test Search Patterns

### Finding Tests for a Component

**Pattern 1: By component name**
```bash
# If you modify src/components/layout/app-shell.tsx
# Look for src/__tests__/app-shell.test.tsx
grep -r "AppShell\|app-shell" src/__tests__/
```

**Pattern 2: By function name**
```bash
# If you modify src/lib/utils/format.ts
# Look for src/__tests__/format.test.ts
grep -r "formatDate\|formatNumber" src/__tests__/
```

**Pattern 3: By module import**
```bash
# Find which tests import your module
grep -r "from.*theme-provider\|import.*theme-provider" src/__tests__/
```

**Pattern 4: Broad search**
```bash
# Find all test files
find src/__tests__ -name "*.test.ts*"
```

---

## Common Mistakes (Avoid These!)

❌ **Mistake 1**: Updating code but forgetting to search for tests
- **Fix**: Always search for tests FIRST, before touching code

❌ **Mistake 2**: Updating tests locally but not committing them
- **Fix**: Stage tests with `git add`, include in same commit as code

❌ **Mistake 3**: Changing behavior without updating test assertions
- **Fix**: Read tests, update expectations to match new behavior

❌ **Mistake 4**: Adding new functionality without adding new test cases
- **Fix**: If it's testable behavior, it needs a test

❌ **Mistake 5**: Committing with failing tests
- **Fix**: `npm test -- --run` MUST pass before pushing

---

## Pre-Commit Hook (Automated Enforcement)

A Git pre-commit hook automatically runs:
- ✅ TypeScript type checking
- ✅ ESLint validation
- ✅ Related test suite validation

**If any check fails, the commit is rejected.**

```bash
# This runs automatically on git commit:
# 1. Type checks TS files
# 2. Runs ESLint
# 3. Runs affected tests
# 4. Blocks commit if anything fails
```

**To bypass (ONLY in emergencies):**
```bash
git commit --no-verify  # NOT RECOMMENDED
```

---

## Testing Scenarios

### Scenario 1: Fix a Bug

**You found: Form validation always rejects valid emails**

```bash
# 1. Find tests
grep -r "validation\|email" src/__tests__/

# 2. Read email validation tests
cat src/__tests__/validation.test.ts

# 3. Fix the bug in src/lib/validation.ts

# 4. Add regression test that would have caught this:
it("should accept valid email addresses with subdomains", () => {
  expect(isValidEmail("user+tag@company.co.uk")).toBe(true);
});

# 5. Run tests
npm test -- --run validation

# 6. Commit both
git add src/lib/validation.ts src/__tests__/validation.test.ts
git commit -m "fix: email validation accepts subdomains (regression test added)"
```

### Scenario 2: Add New Feature

**You're adding: Theme system that respects system dark mode**

```bash
# 1. Search for existing theme tests
grep -r "theme\|ThemeProvider" src/__tests__/

# 2. Read theme-provider.test.tsx
cat src/__tests__/theme-provider.test.tsx

# 3. Implement feature in src/components/providers/theme-provider.tsx

# 4. Add test case for system dark mode:
it("respects system dark mode preference when theme is 'system'", () => {
  // Mock system preference
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: query === "(prefers-color-scheme: dark)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
  // Assert system dark mode is applied
});

# 5. Run tests
npm test -- --run theme

# 6. Commit
git add src/components/providers/theme-provider.tsx src/__tests__/theme-provider.test.tsx
git commit -m "feat: add system dark mode preference support in theme provider"
```

### Scenario 3: Refactor Without Behavior Change

**You're refactoring: Extract utility function from component**

```bash
# 1. Search for tests
grep -r "oldFunction\|OldComponent" src/__tests__/

# 2. Extract to new file src/lib/utils/extract-utility.ts
# 3. Update imports in src/components/my-component.tsx

# 4. UPDATE tests: change import paths, verify same behavior
// Old:
import { MyComponent } from src/components/my-component

// New:
import { MyComponent } from src/components/my-component
import { extractHelper } from src/lib/utils/extract-utility

# 5. Run tests
npm test -- --run my-component

# 6. Commit refactor + test update
git add src/lib/utils/extract-utility.ts src/components/my-component.tsx src/__tests__/my-component.test.tsx
git commit -m "refactor: extract helper utility, update imports"
```

---

## Quick Checklist

Use this before every commit:

- [ ] Found related tests with `grep -r` or `find`
- [ ] Read test file to understand current behavior
- [ ] Made code changes
- [ ] Updated test cases to match new behavior
- [ ] Added new test cases if needed
- [ ] `npm test -- --run [pattern]` passes ✅
- [ ] `npx tsc --noEmit` passes ✅
- [ ] `npx eslint [files]` passes ✅
- [ ] Git staged: both code AND tests
- [ ] Commit message explains code change + test change
- [ ] Ready to push ✅

---

## Resources

- **Guardrail #13**: This workflow in copilot-instructions.md
- **Affected Files**: Check CODEBASE_INVENTORY.md to find test locations
- **Test Patterns**: See TEST_AUDIT.md for testing conventions
- **Git Hooks**: Pre-commit hook at `.husky/pre-commit` enforces automatically

---

## Questions?

If you're unsure:
- "Which tests cover this feature?" → Use `grep` to search
- "Do I need a new test?" → If behavior is testable, yes
- "Can I skip the tests?" → No. Pre-commit hook will block you.
- "Can I commit broken tests?" → No. Tests must pass first.

**This workflow prevents silent bugs and makes refactoring safe.** ✅
