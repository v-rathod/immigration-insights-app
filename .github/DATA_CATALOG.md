# P2 Data Catalog & Artifact Registry

**Purpose**: Single source of truth for all P2 Meridian artifacts consumed by P3 Compass.  
**When to update**: Whenever a new artifact is added/removed in P2 Meridian, or a dashboard's data dependencies change.

---

## Data Pipeline Overview

```
P2 Meridian (artifacts/)
  │
  ├── tables/*.parquet          ← Parquet files (17.4M+ rows)
  ├── models/*.json             ← Model weights & outputs
  └── rag/                      ← Pre-computed RAG chunks + QA
      ├── all_chunks.json
      ├── qa_cache.json
      └── catalog.json
          │
          ▼
  scripts/sync_p2_data.py       ← Converts Parquet → optimized JSON slices
          │
          ▼
  public/data/                  ← Static JSON (bundled into S3 deploy)
  ├── dashboards/               ← One JSON per dashboard
  ├── dims/                     ← Dimension lookups
  ├── models/                   ← Model outputs (forecasts, scores)
  └── rag/                      ← RAG chunks + QA cache
```

### Sync Commands
```bash
python3 scripts/sync_p2_data.py       # Full sync: P2 artifacts → public/data/
python3 scripts/_regen_search.py      # Regenerate employer search index only
npm run build                          # Build P3 static export
```

---

## Artifact Inventory

### Dimensions (6)
`dim_country`, `dim_soc`, `dim_area`, `dim_employer`, `dim_visa_ceiling`, `dim_visa_class`

### Fact Tables (18)
`fact_perm`, `fact_lca`, `fact_oews`, `fact_cutoffs`, `fact_h1b_employer_hub`, `fact_niv_issuance`, `fact_visa_issuance`, `fact_visa_applications`, `fact_perm_unique_case`, `fact_perm_all`, `fact_cutoffs_all`, `fact_uscis_approvals`, `fact_dhs_admissions`, `fact_waiting_list`, `fact_warn_events`, `fact_bls_ces`, `fact_processing_times`, `fact_trac_adjudications`

### Feature/Metric Tables (14)
`employer_features`, `employer_monthly_metrics`, `salary_benchmarks`, `visa_demand_metrics`, `worksite_geo_metrics`, `backlog_estimates`, `category_movement_metrics`, `fact_cutoff_trends`, `soc_demand_metrics`, `queue_depth_estimates`, `processing_times_trends`, `employer_risk_features`, `employer_salary_profiles`, `employer_salary_yearly`, `soc_salary_market`

### Model Outputs (3)
`employer_friendliness_scores`, `employer_friendliness_scores_ml`, `pd_forecasts`

### P3-Derived Exports (1)
`employer_role_trends` — multi-year p10-p90 percentile data per employer x SOC x year

### RAG/QA Artifacts (4)
`catalog.json`, `all_chunks.json`, `qa_cache.json`, `build_summary.json`

### Stub Tables (0 rows, expected)
| Table | Reason |
|-------|--------|
| `fact_trac_adjudications` | TRAC requires paid subscription |
| `fact_acs_wages` | Census API HTTP 404 (available ~Sep 2026) |
| `fact_processing_times` | USCIS SPA, no P1 source |

### Stale Data
| Table | Reason |
|-------|--------|
| `fact_h1b_employer_hub` | USCIS discontinued after FY2023. Historical only. |

---

## P2 Data Scale

- **46+ artifact tables**, 18.5M+ total rows
- **6 dimensions**: employer (243K), SOC (1,801), country (249), area (587), visa_class (6), visa_ceiling (14)
- **15 fact tables**: PERM (1.7M), LCA (9.6M), OEWS (446K), cutoffs (14K), visa issuances, DHS admissions...
- **12 feature tables**: employer_features, salary_benchmarks, worksite_geo_metrics, soc_demand_metrics...
- **3 model outputs**: pd_forecasts (56 series x 24 months), SRS rules (70K), SRS ML (1,695)
- **RAG**: chunks across 10 topics, pre-computed QA pairs

---

## Dashboard → Artifact Mapping

| Dashboard | Route | P2 Artifacts Consumed |
|-----------|-------|----------------------|
| Visa Bulletin Trends | `/dashboard/visa-bulletin` | fact_cutoff_trends, pd_forecasts, fact_cutoffs_all |
| Sponsor Reliability Score | `/dashboard/employer` | employer_friendliness_scores (efs→srs), employer_friendliness_scores_ml, employer_monthly_metrics, employer_risk_features |
| EB Category Comparison | `/dashboard/eb-category` | category_movement_metrics |
| Geographic Heatmaps | `/dashboard/geographic` | worksite_geo_metrics |
| Wage Competitiveness | `/dashboard/wage` | salary_benchmarks, fact_oews |
| SOC Demand | `/dashboard/job-demand` | soc_demand_metrics |
| Processing Speed | `/dashboard/processing` | processing_times_trends, fact_uscis_approvals |
| Backlog Visualization | `/dashboard/backlog` | backlog_estimates, queue_depth_estimates, dim_visa_ceiling |
| Approval Trends | `/dashboard/approvals` | approval_denial data |

---

## Personalized Panels → Artifact Mapping

| Panel | User Input Used | P2 Artifacts |
|-------|----------------|--------------|
| Green Card Forecast | priority_date, country, category | pd_forecasts, fact_cutoff_trends |
| Employer Insights | employer_name | employer_friendliness_scores, employer_risk_features, employer_monthly_metrics |
| Job Market Insights | job_title, location, soc | worksite_geo_metrics, soc_demand_metrics, salary_benchmarks |
| Recommendations | All inputs | Composite logic from above |
| Visual Dashboards | All inputs | Personalized chart mosaic |

---

## User Input Schema (localStorage)

```typescript
interface UserProfile {
  priorityDate: string;          // ISO date: "2020-03-15"
  countryOfChargeability: string; // ISO-3166: "IND", "CHN", "ROW"
  category: string;              // "EB2", "EB3", etc.
  employerName: string;          // Free text, fuzzy-matched to dim_employer
  jobTitle: string;              // Free text
  location: string;              // "San Francisco, CA"
  wageOffered: number;           // Annual USD
  yearsOfExperience: number;     // Integer
}
```

---

## RAG Q&A Architecture (Deferred to Future Phase)

| Layer | Implementation |
|-------|---------------|
| Pre-computed answers | `qa_cache.json` — exact/fuzzy match first |
| Chunk retrieval | `all_chunks.json` — filtered by topic via Fuse.js |
| Topics | pd_forecast, employer, salary, visa_bulletin, geographic, occupation, processing, visa_demand, filings, general |
| LLM (Future) | Groq (Llama 3.3 70B) for dev; OpenAI GPT-4o-mini reserved for prod; Ollama local; Mock fallback |

---

## Key Paths

| What | Path |
|------|------|
| P2 Meridian (sibling) | `../immigration-model-builder/` |
| P2 artifacts source | `../immigration-model-builder/artifacts/` |
| P3 static data (JSON) | `public/data/` |
| RAG data | `public/data/rag/` |
| Sync script | `scripts/sync_p2_data.py` |
| Search index rebuild | `scripts/_regen_search.py` |

---

## ⚠️ Post-Consolidation Recovery

After any run of `consolidate_employer_shards()` in sync_p2_data.py, **ALWAYS** re-run:
1. `python3 scripts/_regen_search.py` — fixes _search.json (consolidation zeros it out)
2. Verify srs_overview.json is non-zero

See PROGRESS.md Milestone 11.5 for full details on this known issue.
