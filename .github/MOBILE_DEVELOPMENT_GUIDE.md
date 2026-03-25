# Mobile Development Guide

**Read this file when:** Building UI components, modifying pages, or working with forms/interactive elements.
**Auto-updated by:** Manual updates when mobile patterns are discovered or standards change.
**Referenced in:** copilot-instructions.md → "Refer to MOBILE_DEVELOPMENT_GUIDE.md"

---

## 🔄 How to Maintain This File

**When to update:**
- ✅ When mobile testing reveals a new pattern or issue
- ✅ When creating a new mobile E2E test spec (add it to Testing Patterns section)
- ✅ When breakpoints or touch target standards change

**How to update:**
```bash
# Before committing mobile UI changes:
# 1. Test on iPhone 14 (or 390px width)
# 2. Run mobile tests: npx playwright test -g mobile
# 3. If new pattern discovered → add to "Reference Implementations" section
# 4. If new E2E spec created → add entry to "Testing Patterns" section
# 5. Commit code + updated MOBILE_DEVELOPMENT_GUIDE.md
```

**Who should do it:** Frontend developer building mobile UI (while testing on device).

**Frequency**: As needed when new mobile patterns emerge (not frequent, not per-commit).

---

## Overview

Compass is used heavily on mobile. Every UI change must be verified at iPhone 14 resolution (390×844px). These rules apply to all future component and page changes.

### Viewport Target
- **Primary mobile baseline**: iPhone 14 — 390px wide, 844px tall, touch-enabled
- **Breakpoint reference**: `sm:` = 640px, `md:` = 768px, `lg:` = 1024px. On iPhone 14 (390px), nothing above `sm:` is active.

---

## 11 Mobile Rules (MANDATORY)

### 1. Touch targets ≥ 44px
All interactive elements (buttons, links, pills, toggles) must be at least 44px tall. This is WCAG 2.1 AA. 
- Use `py-3` minimum for buttons 
- Use `py-2 sm:py-1` for pills 
- Verify with Playwright `boundingBox()`

### 2. No fixed pixel widths without overflow-hidden
Never use `w-[Npx]` or `max-w-[Npx]` on elements that could hold dynamic or varying text content. When fixed widths are needed (e.g. a date input), ensure the parent has `overflow-hidden` or the element is capped with `w-full sm:max-w-[Npx]`.

### 3. No horizontal overflow
`document.documentElement.scrollWidth` must never exceed `clientWidth` at 390px. 
- The Playwright helper `expectNoHorizontalOverflow()` (defined in every `e2e/` spec) checks this
- Any new page section that uses negative margins or absolute-positioned wide elements MUST be wrapped in `overflow-hidden`

### 4. Responsive stacking
Default to `flex-col` for button groups, CTAs, and form rows. Use `sm:flex-row` to unlock side-by-side layout at 640px+. Never use `flex-row` alone without a responsive override.

### 5. Responsive grids
Use `grid-cols-1` as mobile base. Add `sm:grid-cols-N` for small-screen grids and `lg:grid-cols-M` for desktop.

**Quick reference:**
- Stat cards: `grid-cols-2`
- Quick access: `grid-cols-1 sm:grid-cols-3`
- Dashboard grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

### 6. Active states, not just hover
`hover:` styles are invisible on touch devices. For all interactive surfaces:
- Pair `hover:` with `active:` (e.g. `hover:bg-white/10 active:bg-white/15`)
- For links and buttons, add `active:scale-[0.98]` for haptic-like feedback

### 7. Avoid 100vw or full-bleed widths without containment
`w-screen`, `100vw`, and negative margin patterns (`-mx-4`) must be wrapped in `overflow-hidden` on the parent.

### 8. Font sizes ≥ 12px
Never use `text-[Npx]` below 12px in body copy. The `text-[9px]` exception is only for decorative micro-badges (e.g. tech stack badges) where the text is non-essential.

### 9. SVG/canvas containers must be responsive
Never set `width={N}` and `height={N}` on SVG elements with fixed pixel values that could clip on mobile. 
- Use `width="100%" height="100%"` inside a container with `max-w-[Npx]` and `aspect-ratio`
- See `score-gauge.tsx` as the reference implementation

### 10. Recharts wrappers must use percentage widths
Use `<ResponsiveContainer width="100%" height={N}>` for all chart wrappers. Never set a fixed pixel width on `ResponsiveContainer`.

### 11. Run Playwright mobile tests after every page-level UI change
Any change to a page component that has a corresponding `e2e/[page]-mobile.spec.ts` file must pass all its mobile tests before committing. 
- Run with: `npx playwright test [name]-mobile`

---

## When to add a new Playwright mobile spec

Add `e2e/[page]-mobile.spec.ts` for:
- Any new page route (copy `home-mobile.spec.ts` as a template)
- Any major UI refactor of an existing page (new sections, rearranged layout)
- Any new page that has interactive elements (filters, inputs, toggles, navigation)

### Existing e2e specs

| File | Page | Tests |
|------|------|-------|
| `e2e/pd-cortex-mobile.spec.ts` | `/dashboard/visa-bulletin` | 44 |
| `e2e/home-mobile.spec.ts` | `/` (home/landing) | 41 |

---

## Reference implementation patterns

```tsx
{/* BAD — fixed px width will clip on mobile */}
<input className="w-[200px]" />

{/* GOOD — full width on mobile, capped on tablet+ */}
<input className="w-full sm:max-w-[200px]" />

{/* BAD — buttons side-by-side on mobile (no room at 390px) */}
<div className="flex flex-row gap-3">
  <button>Primary</button>
  <button>Secondary</button>
</div>

{/* GOOD — stack on mobile, row on tablet+ */}
<div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
  <button>Primary</button>
  <button>Secondary</button>
</div>

{/* BAD — pill with tiny touch target */}
<button className="px-3 py-1 text-xs">EB2</button>

{/* GOOD — adequate touch target on mobile */}
<button className="px-3 py-2 sm:py-1 text-xs">EB2</button>
```
