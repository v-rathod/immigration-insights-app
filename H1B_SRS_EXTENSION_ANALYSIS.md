# H-1B SRS Extension Analysis — Strategic Brainstorm

**Date:** March 20, 2026  
**Context:** Post-M10.81 (Portal fix deployed). Strategic planning session for future feature.  
**Status:** ANALYSIS ONLY — No code changes. Stored for future agent to evaluate.

---

## Problem Statement

**Why This Analysis?**

During P3 data investigation, discovered that **74.7% of H-1B employers (300,754 employers) have zero SRS rating** because:
- Current SRS (Employer Friendliness Score) rates only PERM-sponsoring employers
- H-1B and PERM serve different purposes (temporary work vs. permanent sponsorship)
- Many employers sponsor H-1B only: staffing agencies, contractors, short-term projects
- Example: Cognizant Worldwide has 877 H-1B filings but shows "Unrated" (no PERM activity)

**The Question:**
> Should we extend SRS to rate H-1B-only employers? If so, how?

---

## Data Findings

### Current State (PERM-Only)

```
EFS (Employer Friendliness Scores) in P2:
  - Coverage: 70,206 employers (PERM-based scoring)
  - Size: 6.1 MB (Parquet)
  - Valid scores: 17,836 employers
  - Data freshness: Monthly updates

H-1B Employer Universe:
  - Total H-1B employers: 402,585
  - H-1B only (no PERM): 300,754 (74.7%)
  - Both H-1B + PERM: 101,831 (25.3%)
  - Source: employer_salary_yearly.parquet (87M rows)
  - Data freshness: FY2023 (3 years stale as of 2026) ⚠️
  - Approval stats: fact_h1b_employer_hub.parquet (729K rows, FY2010–2023)
```

### Key Insight: Why H-1B-Only Is Common

| Employer Type | H-1B Only | Both | Example |
|---|---|---|---|
| Staffing agencies | 95%+ | 5% | ManpowerGroup: contractors, no GC sponsorship |
| IT contractors | 80%+ | 20% | Short 2–3 year engagements |
| Professional services | 60% | 40% | Project-based hiring |
| Tech megacorps | 10% | 90% | Google, Microsoft (sponsor PERM for key roles) |

**Conclusion:** H-1B-only is not anomalous; it's normal visa sponsorship strategy. Many employers choose NOT to pursue PERM (green cards) because:
1. Don't want long-term commitment
2. Cost/complexity not justified for temp workers
3. Regulatory compliance easier with H-1B only

---

## Three Strategic Options

### Option 1: Extend Existing SRS (Unified Score)
**Add H-1B employers to current `employer_friendliness_scores` with new weighting**

**How It Works:**
- P2 creates 1 combined score: `efs` = 40% PERM outcome + 15% H-1B outcome + 45% other factors
- P3: Same SRS widget; single toggle "Include H-1B scores"
- Result: 70K PERM + 300K H-1B-only employers in one table

**Pros:**
- ✅ Backward compatible (existing PERM scores untouched)
- ✅ Unified UX (one metric, one widget, one toggle)
- ✅ Simpler architecture (no dual-score branching)
- ✅ Lowest P3 complexity

**Cons:**
- ⚠️ **Philosophical mismatch** — PERM score (=GC friendliness) ≠ H-1B score (=temp sponsorship friendliness)
- ⚠️ Users won't understand the difference; tier becomes ambiguous
- ⚠️ **Data staleness** — FY2023 H-1B data mixed with monthly PERM data (confusing freshness marker)
- ⚠️ **Signal dilution** — "Good" rating could mean "great for PERM" or "great for H-1B only"

**Artifact Impact:**
- P2: +1.5 MB (add 5 H-1B columns to EFS)
- P3: +8–12 MB (new employers + fields in shards)
- AWS cost: +$0.02/month

**Effort:** 18 hours (P2: 8h, P3: 6h, test: 4h)

**Risk Level:** 🟡 **MEDIUM** — Low breaking risk, but confusing UX semantics

---

### Option 2: Dual-Score Model (Pure Signals)
**Maintain separate `efs` (PERM) + `h1b_score` (H-1B) in P2 output**

**How It Works:**
- P2 exports 2 tables: `employer_friendliness_scores.parquet` (PERM) + `h1b_reliability_scores.parquet` (H-1B)
- Each employer in EFS has fields: `efs`, `efs_tier` (PERM-only)
- H-1B-only employers get separate entry: `h1b_score`, `h1b_tier`, `h1b_approval_rate`
- P3: Dual widgets, dual toggles, conditional rendering
- Result: User sees "PERM Score: 82 (Good)" OR "H-1B Score: 76 (Good)"

**Pros:**
- ✅ Signals remain pure (each metric measures what it claims)
- ✅ **No breaking changes** (existing EFS untouched)
- ✅ Transparent to users ("PERM score" vs "H-1B score" are explicit)
- ✅ **Future-proof** — Can swap H-1B model later without breaking PERM
- ✅ Easy deprecation if H-1B quality issues arise

**Cons:**
- ⚠️ **Artifact bloat** — +3–4 MB in P2; +15–20 MB in P3 shards
- ⚠️ **UI complexity** — Dual widgets, dual toggles, conditional rendering needed
- ⚠️ **User confusion** — "Why are there two scores? Which should I trust?"
- ⚠️ **Data staleness** — FY2023 H-1B data must be clearly marked
- ⚠️ CloudFront bandwidth slightly higher (more fields per employer)

**Artifact Impact:**
- P2: +3–4 MB
- P3: +15–20 MB (new employers + 5 new fields)
- AWS cost: +$0.05/month

**Effort:** 28 hours (P2: 12h, P3: 10h, test: 6h)

**Risk Level:** 🟡 **LOW-MEDIUM** — Low code risk, moderate UX complexity

**Recommended for:** If you want to preserve signal purity and give users explicit choice

---

### Option 3: Separate H-1B Table (Safest)
**Create `h1b_reliability_scores.parquet` in P2, leave SRS untouched**

**How It Works:**
- P2: Creates new table `h1b_reliability_scores.parquet` (mirrors EFS structure)
- P3: Optional "Show H-1B Scores" toggle in SRS widget
- Search index tagged: "PERM-rated", "H-1B-rated", or "both"
- Result: Independent artifacts, zero coupling

**Pros:**
- ✅ **Zero breaking changes** (EFS completely untouched)
- ✅ **Clean separation** (H-1B is optional feature)
- ✅ **Easy to deprecate** — If data quality issues, just don't export it
- ✅ **Future extensibility** — Could add similar scores for EB-2, EB-3, etc. later
- ✅ **Minimal shard impact** — Only 300K new employers (vs 370K in dual-score)
- ✅ **Low UX complexity** — Just add a toggle for existing widget

**Cons:**
- ⚠️ **Fragmented UX** — Conditional rendering needed ("if PERM, show SRS; if H-1B, show H-1B score")
- ⚠️ **Search index complexity** — Need new `rating_type` field (PERM / H-1B / both)
- ⚠️ **Data staleness** — FY2023 H-1B data (same as Option 2)
- ⚠️ Moderate artifact size (+6–8 MB P2, +5–10 MB P3)

**Artifact Impact:**
- P2: +6–8 MB (new table, only H-1B employers)
- P3: +5–10 MB (smaller since only 300K new employers)
- AWS cost: +$0.03/month

**Effort:** 18 hours (P2: 6h, P3: 8h, test: 4h)

**Risk Level:** 🟢 **MEDIUM** — Very low code risk, moderate UX modeling

**Recommended for:** Safest path + future extensibility

---

## Shared Blockers (All Options)

### ⚠️ Data Freshness Crisis: FY2023 H-1B Data Is 3 Years Stale

**Problem:**
- fact_h1b_employer_hub: Last freeze at FY2023 (fiscal year ends Sept 2023)
- USCIS FOIA data release: ~6 months lag (FY2023 data released ~Mar 2024)
- Current date: March 2026
- **Gap:** FY2024 and FY2025 H-1B employer approval stats are not in P2

**Impact:**
- Any H-1B score would show 2023 metrics (outdated)
- Users wouldn't know the freshness issue unless UI explicitly marks it
- Mitigates if marked as "Last updated: Sept 2023"

**Solution Before Launch:**
1. Check if USCIS released FY2024/FY2025 H-1B employer data
2. Update P1 pipeline to ingest new USCIS files
3. Regenerate fact_h1b_employer_hub in P2
4. Only then enable H-1B scores in P3

**Timeline expectation:** USCIS likely to release FY2024 data in late 2024; FY2025 in late 2025.

---

## Comparative Summary

| Dimension | Option 1 | Option 2 | Option 3 |
|-----------|----------|----------|----------|
| **Breaking Risk** | ✅ None | ✅ None | ✅ None |
| **UX Complexity** | 🟢 Low | 🟡 Medium | 🟡 Medium |
| **Code Complexity** | 🟢 Low | 🟡 Medium | 🟡 Medium |
| **Artifact Size Δ** | 🟢 +10 MB | 🟡 +35 MB | 🟡 +15 MB |
| **AWS Cost Δ** | 🟢 +$0.02 | 🟡 +$0.05 | 🟢 +$0.03 |
| **Signal Clarity** | 🔴 Blurred | 🟢 Pure | 🟢 Pure |
| **User Confusion Risk** | 🟡 Medium | 🟡 Medium | 🟢 Low |
| **Future Extensibility** | 🟡 Hard | 🟡 Moderate | 🟢 Easy |
| **Effort Hours** | 18h | 28h | 18h |

---

## Recommendation

### 🏆 **Recommended: Option 3 (Separate H-1B Table)**

**Why?**
1. **Lowest risk** — Zero changes to existing SRS (can't break PERM scores)
2. **Cleanest UX** — Easy to add a toggle without complex conditional rendering
3. **Future-proof** — Extensible design (adds similar tables for other visa types later)
4. **Same effort as Option 1** — 18 hours, but delivers better long-term architecture
5. **Avoids signal confusion** — Each table measures one thing well

### Phased Approach

**Phase 1 (When ready):**
1. Create `h1b_reliability_scores.parquet` in P2
2. Use fact_h1b_employer_hub (FY2010–2023) but mark as stale
3. Export to P3 with `data_stale: true` flag
4. P3: Add toggle "Include H-1B Scores (experimental, FY2023 data)"
5. Test with 10–20 employers on stage before prod

**Phase 2 (After FY2024 H-1B data arrives):**
1. Update fact_h1b_employer_hub with fresh USCIS FY2024 data
2. Regenerate h1b_reliability_scores
3. Set `data_stale: false`
4. Enable by default (or keep as opt-in; user preference)

**Phase 3 (Optional, future):**
1. If H-1B adoption is high, consider Option 2 (dual-score consolidation)
2. Or maintain as separate metric (keeps signals pure)

---

## Effort Breakdown (Option 3 Recommended)

### P2 Changes (~6 hours)
1. Create `h1b_reliability_scores.py` (mirrors `employer_score.py` logic)
   - Load fact_h1b_employer_hub
   - Aggregate H-1B approval rates (initial + continuing)
   - Compute H-1B score: 50% approval rate + 25% volume signal + 25% wage competitiveness
   - Output: employer_name, h1b_score, h1b_tier, h1b_approval_rate, h1b_filings_36m
2. Add to P2 export pipeline (sync to P3)
3. Document new artifact in P2 README
4. QA: Validate 10 H-1B-only employers have scores
5. Update P2 artifact manifest

### P3 Changes (~8 hours)
1. Add `h1b_score` field to employer shard format
2. Update employer data loader: `getEmployerMetrics()` → return `{efs, h1b_score, data_sources}`
3. Extend score gauge component: conditional rendering for H-1B
4. Add toggle to SRS widget: "Show H-1B scores (experimental, FY2023)"
5. Update methodology card: explain H-1B scoring
6. Add data freshness badge: "Last updated: Sept 2023"
7. Update TypeScript types: `EmployerScore` now has `h1b_score?: number`
8. QA: Test toggle on mobile + desktop, verify Cognizant Worldwide shows H-1B score

### Testing (~4 hours)
1. Unit tests: P2 h1b_reliability_scores.py (5–10 test cases)
2. Integration tests: P3 employer data loader with dual scores
3. E2E: Playwright mobile tests for toggle functionality
4. Browser regression: Ensure no SRS regressions (PERM scores unchanged)
5. Data validation: 300K H-1B-only employers have scores; 101K dual employers have both

---

## Unknown Unknowns to Investigate Later

- [ ] USCIS FY2024/FY2025 H-1B data: When will P1 ingest?
- [ ] H-1B continuing vs initial approvals: Should we weight them differently?
- [ ] Visa type within H-1B: O-1 (specialty), L-1 (intra-company), etc. — separate scores?
- [ ] Wage data quality for H-1B: Is median salary reliable (vs PERM wage_ratio)?

---

## Related Context

- **M10.81** (Mar 20, 2026): Deployed portal fix for dropdown alignment. After deployment, discovered Cognizant Worldwide (877 H-1B filings, Unrated) → triggered this analysis.
- **SRS/EFS Architecture**: See `src/models/employer_score.py` in P2 for current scoring logic (40 PERM outcome / 25 wage / 15 sustainability / 10 H-1B signal / 10 retention).
- **Data freshness**: fact_h1b_employer_hub is archival only (USCIS discontinued updates after FY2023).

---

## Next Steps for Future Agent

1. **If extending SRS is approved:**
   - [ ] Verify USCIS released FY2024/2025 H-1B data to P1
   - [ ] If not, decide: wait for fresh data or launch with FY2023?
   - [ ] Pick Option 1, 2, or 3 based on strategy
   - [ ] Create issue/task in project tracker

2. **If deferring for now:**
   - [ ] Archive this document for reference
   - [ ] Monitor USCIS data releases
   - [ ] Revisit in Q2/Q3 2026 after fresh H-1B data becomes available

3. **For user comms:**
   - [ ] Current behavior (Cognizant Worldwide = Unrated) is correct
   - [ ] SRS measures PERM/GC sponsorship, not H-1B temp sponsorship
   - [ ] If users want H-1B metrics, add as separate indicator (don't dilute SRS)

---

## Document Metadata

- **Created:** March 20, 2026 (post-M10.81)
- **Analysis type:** Strategic brainstorm (no code changes)
- **Data sources:** P2 fact_h1b_employer_hub, employer_salary_yearly, employer_friendliness_scores
- **Stakeholders:** Product (feature prioritization), P2 (artifact design), P3 (UX/widget)
- **Owner:** Team (future agent should review with stakeholders before implementation)

---

**For future agent:** Read this fully, then discuss Option 1/2/3 choice with team. Only proceed if (1) fresh H-1B data available, (2) option is approved, and (3) H-1B SRS feature is prioritized over other work.
