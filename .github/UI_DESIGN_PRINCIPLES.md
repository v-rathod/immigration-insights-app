# UI Design Principles — Aurora Design System

**Read this file when:** Building new components, styling pages, or updating design tokens.
**Auto-updated by:** Manual updates when Aurora design system evolves.
**Referenced in:** copilot-instructions.md → "Refer to UI_DESIGN_PRINCIPLES.md for design direction"

---

## 🔄 How to Maintain This File

**When to update:**
- ✅ When a new color token is added to Aurora design system
- ✅ When a new component pattern is established (e.g., new card style)
- ✅ When animation standards or typography changes
- ✅ When accessibility guidelines are refined

**How to update:**
```bash
# Adding a new design token?
# 1. Update Aurora colors in src/app/globals.css (CSS variables)
# 2. Document the token in this file:
#    - Variable name (e.g., --color-accent-500)
#    - Usage (where to use it? When?)
#    - Examples (show reference implementations)
# 3. Commit design file + UI_DESIGN_PRINCIPLES.md together
```

**Who should do it:** Designer or frontend lead (when design system changes).

**Frequency**: As needed when design decisions are made (not frequent, not per-commit).

---

## Design System — "Aurora"

### Aesthetic
**Linear / Vercel / Raycast-inspired** — light-first, glassmorphism, fluid micro-interactions, bold typography. Award-winning modern sleek UI.

### Color Tokens (CSS variables in `src/app/globals.css`)
```
--background:      Dark: #09090b    Light: #fafafa
--foreground:      Dark: #fafafa   Light: #09090b
--card:            Dark: rgba(255,255,255,0.03)
--accent-blue:     #3b82f6
--accent-purple:   #8b5cf6
--accent-emerald:  #10b981
--accent-amber:    #f59e0b
--accent-rose:     #f43f5e
--gradient-primary: linear-gradient(135deg, #3b82f6, #8b5cf6)
```

### Signature Patterns
- **Glassmorphic cards**: `backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl`
- **Gradient text**: `bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent`
- **Number tickers**: Animated count-up on stat cards (Framer Motion)
- **Staggered reveals**: Dashboard cards animate in sequence on page load
- **Chart glow**: Subtle glow effect on chart hover states
- **Typography**: Geist Sans for UI, Geist Mono for data/numbers
- **Generous whitespace**: Let the data breathe

### Component Conventions
- All components in `src/components/` use `"use client"` only when needed (event handlers, state, effects)
- Naming: PascalCase files matching component name (`StatCard.tsx`, `ChartContainer.tsx`)
- shadcn/ui primitives in `src/components/ui/` — do not modify these directly
- Custom components wrap shadcn/ui with Aurora design tokens
- All charts wrapped in `<ChartContainer>` with consistent theming

---

## Design Editorial — "Apple Quality Standard"

### Visual Bar
Every pixel must justify its existence. The UI should feel like it was crafted by Apple's design team — precise, intentional, and delightful. Zero clutter, zero noise.

### Key Principles
- **Clarity over cleverness** — Data should be immediately comprehensible
- **Generous whitespace** — Let content breathe; never crowd
- **Purposeful animation** — Every motion communicates state change, never decorative
- **Light-first clarity** — The light theme is the primary experience; dark mode is fully supported via toggle
- **Glass and depth** — Glassmorphic layers create visual hierarchy without heavy borders
- **Typography hierarchy** — Geist Sans for UI text, Geist Mono for data/numbers; clear size steps
- **Color restraint** — Use accent colors sparingly and meaningfully; gradient text for headlines only

### Animation Standards
- Easing: `[0.25, 0.1, 0.25, 1]` (cubic bezier) for all transitions
- Stagger: 50ms between sequential card reveals
- Duration: 200ms for micro-interactions, 400ms for page transitions
- Number tickers: Spring animation for stat counters on viewport entry
- Never block interaction for animation completion

---

## Smart Visibility Principle (MANDATORY)

**Never render a widget whose only possible output is a "please provide input" message.** If a component requires user input to be meaningful, hide it entirely until that input exists and replace it with a single, clear call-to-action instead.

### Rules

| Widget type | Visibility rule |
|-------------|----------------|
| **Input-gated results** (predictions, personal forecasts, scores for a specific selection) | Hidden until required input is present. Show a tasteful CTA placeholder. |
| **Always-useful context** (aggregate stats, historical charts, search boxes, overview bars) | Always visible — they provide value independently of user input. |
| **State-dependent details** (score gauges, trend charts, detail cards for a selected entity) | Rendered only after the relevant entity is selected. Show a rich empty state below the search/select control. |

### Implementation pattern

```tsx
{/* BAD — widget that shows "enter your data above" */}
{hasData && <PredictionCard hasPriorityDate={!!pd} ... />}

{/* GOOD — hide the widget; show CTA; reveal on input */}
{hasData && !pd && (
  <div className="... rounded-2xl border border-dashed border-blue-500/[0.15] py-8 text-center">
    <Target className="h-5 w-5 text-blue-400/70" />
    <p>Enter your priority date to see predictions</p>
  </div>
)}
{hasData && !!pd && <PredictionCard ... />}
```

### Applied examples

| Page | Widget | Trigger |
|------|--------|---------|
| `/dashboard/visa-bulletin` | DFF + FAD Prediction Cards | Hidden until priority date is entered; animated reveal on input |
| `/dashboard/employer` | Score gauge, detail card, trend chart | Hidden until employer is selected; rich empty state with icon guides next action |
