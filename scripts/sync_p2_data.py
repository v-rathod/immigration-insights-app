#!/usr/bin/env python3
"""
sync_p2_data.py — Sync P2 Meridian artifacts to P3 Compass static JSON

Reads Parquet tables + model JSON + RAG artifacts from the sibling
immigration-model-builder project and converts them to optimized JSON
slices in public/data/ for static site consumption.

Usage:
    python3 scripts/sync_p2_data.py              # Full sync
    python3 scripts/sync_p2_data.py --dashboard 1 # Sync only dashboard 1 data
    python3 scripts/sync_p2_data.py --rag-only    # Sync only RAG data
"""

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
P2_ROOT = PROJECT_ROOT.parent / "immigration-model-builder"
P2_TABLES = P2_ROOT / "artifacts" / "tables"
P2_MODELS = P2_ROOT / "artifacts" / "models"
P2_RAG = P2_ROOT / "artifacts" / "rag"

OUT_DIR = PROJECT_ROOT / "public" / "data"
OUT_DASHBOARDS = OUT_DIR / "dashboards"
OUT_DIMS = OUT_DIR / "dims"
OUT_MODELS = OUT_DIR / "models"
OUT_RAG = OUT_DIR / "rag"


# ---------------------------------------------------------------------------
# Dashboard → artifact mapping
# ---------------------------------------------------------------------------
DASHBOARD_ARTIFACTS = {
    "visa-bulletin": [
        "fact_cutoff_trends.parquet",
        "fact_cutoffs_all.parquet",
    ],
    "employer": [
        "employer_friendliness_scores.parquet",
        "employer_friendliness_scores_ml.parquet",
        "employer_monthly_metrics.parquet",
        # employer_features.parquet removed — not consumed by any P3 component
        "employer_risk_features.parquet",
    ],
    "eb-category": [
        "category_movement_metrics.parquet",
    ],
    "geographic": [
        "worksite_geo_metrics.parquet",
    ],
    # wage handled by sync_wage_dashboard() below for smart aggregations
    # "wage": ["salary_benchmarks.parquet"],
    "soc-demand": [
        "soc_demand_metrics.parquet",
    ],
    "processing": [
        "processing_times_trends.parquet",
        "fact_uscis_approvals.parquet",
    ],
    "backlog": [
        "backlog_estimates.parquet",
        "queue_depth_estimates.parquet",
    ],
}

DIMENSION_ARTIFACTS = [
    "dim_country.parquet",
    "dim_soc.parquet",
    "dim_area.parquet",
    "dim_visa_class.parquet",
    "dim_visa_ceiling.parquet",
    # dim_employer.parquet removed — 52 MB, never loaded by any P3 component
]

MODEL_ARTIFACTS = [
    "pd_forecasts.parquet",
]

MODEL_JSON = [
    "pd_forecast_model.json",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Artifact-specific transforms applied during sync to reduce payload sizes
# ---------------------------------------------------------------------------

def _normalize_employer_names(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize ALL-CAPS employer names to Title Case.
    
    P2 Meridian data contains un-normalized ALL-CAPS names like:
    - "SONY CORPORATION OF AMERICA" → "Sony Corporation Of America"
    - "NW SERVICES CO DBA AQUANIMA" → "Nw Services Co Dba Aquanima"
    
    Excludes "UNKNOWN" sentinel and names that are legitimate abbreviations.
    """
    if df.empty or "employer_name" not in df.columns:
        return df
    
    def should_normalize(name: str) -> bool:
        """Check if a name should be title-cased."""
        if not name or name == "UNKNOWN":
            return False
        if name != name.upper():  # Already mixed case
            return False
        if not any(c.isupper() for c in name):  # No letters
            return False
        # Spaced single-letter initials like "C C T S" are legitimate abbreviations
        words = name.strip().split()
        longest_word = max((len(w) for w in words), default=0)
        return longest_word > 2  # Has at least one multi-letter word
    
    count_normalized = 0
    def normalize(name: str) -> str:
        nonlocal count_normalized
        if should_normalize(name):
            count_normalized += 1
            return name.title()
        return name
    
    df["employer_name"] = df["employer_name"].apply(normalize)
    if count_normalized > 0:
        print(f"      [name normalize] {count_normalized:,} employer names normalized to Title Case")
    return df


def _transform_worksite_geo_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """Keep only state-grain rows.

    P3 Geographic dashboard exclusively uses grain='state' aggregates.
    Dropping city/area/soc_area rows eliminates ~134K of 134.8K rows,
    reducing file size from ~37 MB to <50 KB.
    """
    if df.empty or "grain" not in df.columns:
        return df
    result = df[df["grain"] == "state"].reset_index(drop=True)
    print(f"      [geo filter] {len(df):,} → {len(result):,} rows (state grain only)")
    return result


def _transform_employer_monthly_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """Keep only employers with ≥ 6 months of data.

    91K+ employers with 1-2 monthly entries create 51 MB of sparse data.
    Keeping only employers with meaningful time series (≥6 months) preserves
    trend charts while cutting the file to ~10 MB.
    """
    if df.empty or "employer_id" not in df.columns:
        return df
    month_col = "month" if "month" in df.columns else df.columns[2]
    month_counts = df.groupby("employer_id")[month_col].nunique()
    keep_ids = month_counts[month_counts >= 6].index
    result = df[df["employer_id"].isin(keep_ids)].reset_index(drop=True)
    print(f"      [monthly filter] {len(df):,} → {len(result):,} rows ({result['employer_id'].nunique():,} employers with ≥6 months)")
    # Apply name normalization too
    result = _normalize_employer_names(result)
    return result


# Maps artifact stem → transform function applied before writing JSON
ARTIFACT_TRANSFORMS: dict = {
    "worksite_geo_metrics": _transform_worksite_geo_metrics,
    "employer_monthly_metrics": _transform_employer_monthly_metrics,
    "employer_friendliness_scores": _normalize_employer_names,
}


def read_parquet_safe(path: Path) -> pd.DataFrame:
    """Read a Parquet file or partitioned directory."""
    if path.is_dir():
        return pd.read_parquet(path)
    elif path.exists():
        return pd.read_parquet(path)
    else:
        print(f"  ⚠ Missing: {path.name}")
        return pd.DataFrame()


def df_to_json(df: pd.DataFrame, out_path: Path, orient: str = "records") -> int:
    """Write DataFrame to JSON, return row count.

    Uses pandas to_json() rather than json.dump() so that float NaN values
    are serialised as JSON null instead of the invalid bare NaN token.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Convert timestamps to ISO strings for JSON serialization
    for col in df.select_dtypes(include=["datetime64", "datetimetz"]).columns:
        df[col] = df[col].dt.strftime("%Y-%m-%d")

    # Convert date columns
    for col in df.columns:
        if df[col].dtype == "object":
            continue
        try:
            if hasattr(df[col].dtype, "name") and "date" in df[col].dtype.name.lower():
                df[col] = df[col].astype(str)
        except Exception:
            pass

    # pandas to_json correctly serialises NaN → null (JSON spec compliant).
    # default_handler=str catches any remaining non-serialisable types.
    df.to_json(out_path, orient=orient, default_handler=str, force_ascii=False)

    return len(df)


# ---------------------------------------------------------------------------
# Sync functions
# ---------------------------------------------------------------------------
def sync_dashboards(dashboard_filter: str | None = None):
    """Sync dashboard artifacts (Parquet → JSON)."""
    print("\n📊 Syncing dashboard data...")
    total = 0
    for slug, artifacts in DASHBOARD_ARTIFACTS.items():
        if dashboard_filter and slug != dashboard_filter:
            continue
        print(f"\n  Dashboard: {slug}")
        for artifact_name in artifacts:
            path = P2_TABLES / artifact_name
            df = read_parquet_safe(path)
            if df.empty:
                continue
            stem = Path(artifact_name).stem
            # Apply artifact-specific transform if registered
            if stem in ARTIFACT_TRANSFORMS:
                df = ARTIFACT_TRANSFORMS[stem](df)
            out_path = OUT_DASHBOARDS / slug / f"{stem}.json"
            n = df_to_json(df, out_path)
            size_kb = out_path.stat().st_size / 1024
            print(f"    ✓ {stem}: {n:,} rows → {size_kb:.0f} KB")
            total += n
    print(f"\n  Total dashboard rows: {total:,}")


def sync_dimensions():
    """Sync dimension tables (Parquet → JSON)."""
    print("\n📐 Syncing dimension tables...")
    for artifact_name in DIMENSION_ARTIFACTS:
        path = P2_TABLES / artifact_name
        df = read_parquet_safe(path)
        if df.empty:
            continue
        stem = Path(artifact_name).stem
        out_path = OUT_DIMS / f"{stem}.json"
        n = df_to_json(df, out_path)
        size_kb = out_path.stat().st_size / 1024
        print(f"  ✓ {stem}: {n:,} rows → {size_kb:.0f} KB")


def sync_models():
    """Sync model outputs (Parquet → JSON + copy JSON weights)."""
    print("\n🤖 Syncing model artifacts...")
    for artifact_name in MODEL_ARTIFACTS:
        path = P2_TABLES / artifact_name
        df = read_parquet_safe(path)
        if df.empty:
            continue
        stem = Path(artifact_name).stem
        out_path = OUT_MODELS / f"{stem}.json"
        n = df_to_json(df, out_path)
        size_kb = out_path.stat().st_size / 1024
        print(f"  ✓ {stem}: {n:,} rows → {size_kb:.0f} KB")

    for json_name in MODEL_JSON:
        src = P2_MODELS / json_name
        if src.exists():
            dst = OUT_MODELS / json_name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            size_kb = dst.stat().st_size / 1024
            print(f"  ✓ {json_name}: → {size_kb:.0f} KB")


def sync_rag():
    """Copy RAG artifacts (already JSON)."""
    print("\n🔍 Syncing RAG data...")
    OUT_RAG.mkdir(parents=True, exist_ok=True)

    rag_files = ["all_chunks.json", "qa_cache.json", "catalog.json", "build_summary.json"]
    for fname in rag_files:
        src = P2_RAG / fname
        if src.exists():
            dst = OUT_RAG / fname
            shutil.copy2(src, dst)
            size_kb = dst.stat().st_size / 1024
            print(f"  ✓ {fname}: → {size_kb:.0f} KB")
        else:
            print(f"  ⚠ Missing: {fname}")


def sync_wage_dashboard():
    """
    Sync wage dashboard artifacts with smart aggregations.

    Generates 3 optimised JSON slices for the Wage Intelligence Hub:
      1. salary_benchmarks.json  — BLS percentile distribution per SOC × metro
                                    (joined with dim_soc/dim_area for titles)
      2. soc_salary_market.json  — Market trend 2016-2026 per SOC × visa type
      3. employer_wage_rankings.json — Top employers per SOC, latest 2 years
    """
    print("\n💰 Syncing wage dashboard (custom aggregations)...")
    out_dir = OUT_DASHBOARDS / "wage"
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── Load dimension tables ──────────────────────────────────────────────
    dim_soc = read_parquet_safe(P2_TABLES / "dim_soc.parquet")
    soc_map = {}
    if not dim_soc.empty:
        soc_map = dim_soc.set_index("soc_code")["soc_title"].to_dict()

    dim_area = read_parquet_safe(P2_TABLES / "dim_area.parquet")
    area_map = {}
    if not dim_area.empty:
        # Prefer metro areas; fall back to state names
        dim_area_dedup = dim_area.sort_values("ref_year", ascending=False).drop_duplicates("area_code")
        area_map = dim_area_dedup.set_index("area_code")["area_title"].to_dict()

    # ── 1. salary_benchmarks — split into national + metro slices ────────
    sb = read_parquet_safe(P2_TABLES / "salary_benchmarks.parquet")
    if not sb.empty:
        sb = sb.copy()
        sb["soc_title"] = sb["soc_code"].map(soc_map).fillna("")
        sb["area_title"] = sb["area_code"].astype(str).map(area_map).fillna("")
        sb = sb.dropna(subset=["median"])
        for col in ["p10", "p25", "median", "p75", "p90"]:
            sb[col] = sb[col].fillna(0).astype(int)

        # National slice (area_code == "99") — one row per SOC, ~1800 rows
        sb_national = sb[sb["area_code"].astype(str) == "99"].copy()
        n = df_to_json(sb_national, out_dir / "salary_benchmarks_national.json")
        size_kb = (out_dir / "salary_benchmarks_national.json").stat().st_size / 1024
        print(f"    ✓ salary_benchmarks_national: {n:,} rows → {size_kb:.0f} KB")

        # Top-15 states per SOC slice — compact geographic comparison dataset
        # Derive state area codes from dim_area (area_type == "STATE") or numeric 2-digit codes
        if not dim_area.empty and "area_type" in dim_area.columns:
            state_codes = set(
                dim_area[dim_area["area_type"].astype(str).str.upper() == "STATE"]["area_code"].astype(str)
            )
        else:
            # Fallback: 2-digit numeric FIPS state codes 01–56 (excluding 03,07,14,43,52)
            state_codes = {str(i).zfill(2) for i in range(1, 57)}
        # Only keep the 15 highest-paying states per SOC, keeping file size ~1MB
        sb_states = sb[sb["area_code"].astype(str).isin(state_codes)].copy()
        sb_states_top = (
            sb_states.sort_values(["soc_code", "median"], ascending=[True, False])
            .groupby("soc_code")
            .head(15)
            .reset_index(drop=True)
        )
        n = df_to_json(sb_states_top, out_dir / "salary_benchmarks_states.json")
        size_kb = (out_dir / "salary_benchmarks_states.json").stat().st_size / 1024
        print(f"    ✓ salary_benchmarks_states (top-15 per SOC): {n:,} rows → {size_kb:.0f} KB")

    # ── 2. soc_salary_market — H-1B + PERM trends 2016–present ───────────
    ssm = read_parquet_safe(P2_TABLES / "soc_salary_market.parquet")
    if not ssm.empty:
        ssm = ssm[ssm["fiscal_year"] >= 2016].copy()
        ssm["soc_title"] = ssm["soc_code"].map(soc_map).fillna("")
        for col in ["market_mean", "market_median", "market_p10", "market_p25", "market_p75", "market_p90"]:
            if col in ssm.columns:
                ssm[col] = ssm[col].fillna(0).round(0).astype(int)
        ssm = ssm.sort_values(["soc_code", "visa_type", "fiscal_year"])
        n = df_to_json(ssm, out_dir / "soc_salary_market.json")
        size_kb = (out_dir / "soc_salary_market.json").stat().st_size / 1024
        print(f"    ✓ soc_salary_market: {n:,} rows → {size_kb:.0f} KB")

    # ── 3. employer_wage_rankings — top employers per SOC (recent years) ──
    esp = read_parquet_safe(P2_TABLES / "employer_salary_profiles.parquet")
    if not esp.empty:
        # Find the most complete recent year (highest row count among last 3 years)
        all_years = sorted(esp["fiscal_year"].unique())
        candidate_years = all_years[-4:]  # check last 4 years
        year_counts = {
            yr: ((esp["fiscal_year"] == yr) & (esp["n_filings"] >= 5) &
                 esp["median_salary"].notna() & esp["employer_name"].notna()).sum()
            for yr in candidate_years
        }
        # Use the year with the most complete records (not the absolute latest if sparse)
        benchmark_year = max(year_counts, key=lambda y: year_counts[y])
        print(f"      Using benchmark year: {benchmark_year} ({year_counts[benchmark_year]:,} rows)")

        esp_benchmark = esp[
            (esp["fiscal_year"] == benchmark_year)
            & (esp["n_filings"] >= 5)
            & (esp["median_salary"].notna())
            & (esp["employer_name"].notna())
        ].copy()

        # Top 50 employers per SOC by median_salary (includes both H-1B and PERM)
        esp_benchmark = esp_benchmark.sort_values(
            ["soc_code", "median_salary"], ascending=[True, False]
        )
        esp_top = esp_benchmark.groupby("soc_code").head(50).reset_index(drop=True)

        # Keep essential columns only
        cols = [
            "soc_code", "employer_name", "fiscal_year", "n_filings",
            "mean_salary", "median_salary", "p25_salary", "p75_salary",
            "prevailing_wage_median", "wage_premium_pct", "wage_vs_pw_pct",
            "oews_national_median", "visa_type", "job_title_top", "worksite_state_top",
        ]
        cols = [c for c in cols if c in esp_top.columns]
        esp_out = esp_top[cols].copy()
        esp_out["soc_title"] = esp_out["soc_code"].map(soc_map).fillna("")

        # Round wages to integers
        for col in ["mean_salary", "median_salary", "p25_salary", "p75_salary",
                    "prevailing_wage_median", "oews_national_median"]:
            if col in esp_out.columns:
                esp_out[col] = esp_out[col].fillna(0).round(0).astype(int)
        for col in ["wage_premium_pct", "wage_vs_pw_pct"]:
            if col in esp_out.columns:
                esp_out[col] = esp_out[col].fillna(0).round(1)

        n = df_to_json(esp_out, out_dir / "employer_wage_rankings.json")
        size_kb = (out_dir / "employer_wage_rankings.json").stat().st_size / 1024
        print(f"    ✓ employer_wage_rankings: {n:,} rows → {size_kb:.0f} KB")

        # ── 4a. employer_search_index — employers with ≥5 filings for search ──
        esy = read_parquet_safe(P2_TABLES / "employer_salary_yearly.parquet")
        if not esy.empty:
            # Export H-1B employers (≥5 filings) with minimal metadata for full-text search
            esy_all = esy[esy["visa_type"] == "H-1B"].copy()
            
            # Get total filings per employer
            employer_stats = (
                esy_all.groupby("employer_name")
                .agg({
                    "total_filings": "sum",
                    "n_soc_codes": "max",  # latest unique job titles
                    "median_salary": lambda x: float(x.median()) if len(x) > 0 else None,
                    "fiscal_year": "max"  # latest year
                })
                .reset_index()
                .rename({
                    "total_filings": "total_filings",
                    "n_soc_codes": "n_soc_codes",
                    "median_salary": "latest_median_salary",
                    "fiscal_year": "latest_year"
                }, axis=1)
            )
            
            # Round salary
            employer_stats["latest_median_salary"] = employer_stats["latest_median_salary"].fillna(0).round(0).astype(int)
            employer_stats["latest_year"] = employer_stats["latest_year"].fillna(0).astype(int)
            
            # Prune to employers with ≥5 H-1B filings — captures every employer
            # important enough to have meaningful activity, even those with just a
            # handful of filings over a decade.  Eliminates ~74% of single/double
            # filing shell entries while keeping all substantive employers.
            employer_stats = employer_stats[employer_stats["total_filings"] >= 5].copy()

            # Sort by filing count (most relevant first)
            employer_stats = employer_stats.sort_values("total_filings", ascending=False).reset_index(drop=True)

            n = df_to_json(employer_stats, out_dir / "employer_search_index.json")
            size_kb = (out_dir / "employer_search_index.json").stat().st_size / 1024
            print(f"    ✓ employer_search_index: {n:,} rows (≥5 filings) → {size_kb:.0f} KB")

        # ── 4b. employer_salary_trend — ALL employers with ≥5 filings ────────
        if not esy.empty:
            # Include ALL employers with ≥5 total H-1B filings.
            # Only H-1B rows are kept (the wage hub UI defaults to H-1B; PERM data
            # is never shown for employer trends). This halves the output file.
            # ~102K employers × ~4 avg year-rows = ~394K rows.
            # Gzipped by CloudFront to ~5 MB over the wire.
            _h1b_totals_for_trend = (
                esy[esy["visa_type"] == "H-1B"]
                .groupby("employer_name")["total_filings"]
                .sum()
            )
            qualified_employer_names = _h1b_totals_for_trend[
                _h1b_totals_for_trend >= 5
            ].index.tolist()
            esy_top = esy[
                (esy["employer_name"].isin(qualified_employer_names))
                & (esy["fiscal_year"] >= 2016)
                & (esy["visa_type"] == "H-1B")
            ].copy()
            for col in ["mean_salary", "median_salary"]:
                esy_top[col] = esy_top[col].fillna(0).round(0).astype(int)
            # Include employer_id so P3 can resolve raw filing shards
            if "employer_id" not in esy_top.columns:
                esy_top["employer_id"] = ""
            # Keep only the columns the UI actually needs to minimise payload
            trend_cols = [
                "employer_name", "employer_id", "fiscal_year", "visa_type",
                "median_salary", "mean_salary", "total_filings", "n_soc_codes",
            ]
            trend_cols = [c for c in trend_cols if c in esy_top.columns]
            esy_top = esy_top[trend_cols].copy()
            n_trend_employers = esy_top["employer_name"].nunique()
            n = df_to_json(esy_top, out_dir / "employer_salary_trend.json")
            size_kb = (out_dir / "employer_salary_trend.json").stat().st_size / 1024
            print(f"    ✓ employer_salary_trend: {n:,} rows ({n_trend_employers:,} employers, ≥5 filings, H-1B) → {size_kb:.0f} KB")

        # ── 4c. employer_role_profiles — employer-centric role breakdown ─────
        # ALL employers with ≥5 H-1B filings × their top 25 roles by filing count.
        # Uses last 3 fiscal years (≈36 months) to pick up roles that are active
        # across the window but may not clear minimums in any single year alone.
        # (e.g. Optum Services has many roles across FY22-FY24 but few in FY24 only)
        erp = esp[
            (esp["visa_type"] == "H-1B")
            & esp["employer_name"].notna()
        ].copy()

        # Build two coverage tiers from yearly table:
        #   all_qualified (≥5 filings) — for role_profiles (all searchable employers)
        #   top_5000_by_filings — for role_trends (5-year percentile charts, ~12MB)
        if not esy.empty:
            _h1b_employer_totals = (
                esy[esy["visa_type"] == "H-1B"]
                .groupby("employer_name")["total_filings"]
                .sum()
            )
            all_qualified_by_filings = _h1b_employer_totals[
                _h1b_employer_totals >= 5
            ].index.tolist()
            top_5000_by_filings = _h1b_employer_totals.nlargest(5000).index.tolist()
        else:
            # Fallback: use all employers present in profiles
            all_qualified_by_filings = erp["employer_name"].unique().tolist()
            top_5000_by_filings = all_qualified_by_filings

        erp = erp[erp["employer_name"].isin(all_qualified_by_filings)].copy()

        # Use last 3 fiscal years per employer to aggregate role activity across ~36 months.
        # This prevents roles that dipped below the single-year threshold from disappearing.
        latest_year_per_emp = erp.groupby("employer_name")["fiscal_year"].max()
        erp["latest_year"] = erp["employer_name"].map(latest_year_per_emp)
        erp = erp[erp["fiscal_year"] >= erp["latest_year"] - 2].copy()  # last 3 years

        # Drop roles with missing salary
        erp = erp[erp["median_salary"].notna()].copy()

        # Aggregate: sum filings across the window, take salary from most recent year
        # Step 1: find the most recent year each employer×role has data
        latest_role_year = (
            erp.groupby(["employer_name", "soc_code"])["fiscal_year"]
            .max()
            .reset_index()
            .rename(columns={"fiscal_year": "latest_role_year"})
        )
        # Step 2: sum filings across all years in the window
        role_filings = (
            erp.groupby(["employer_name", "soc_code"])["n_filings"]
            .sum()
            .reset_index()
            .rename(columns={"n_filings": "n_filings_36mo"})
        )
        # Step 3: salary metrics from the most recent year only
        erp_latest = erp.merge(latest_role_year, on=["employer_name", "soc_code"])
        erp_latest = erp_latest[erp_latest["fiscal_year"] == erp_latest["latest_role_year"]].copy()
        erp_latest = erp_latest.drop_duplicates(subset=["employer_name", "soc_code"], keep="last")

        # Step 4: merge 36-month filing counts back onto latest-year salary rows
        erp_merged = erp_latest.merge(role_filings, on=["employer_name", "soc_code"])
        erp_merged["n_filings"] = erp_merged["n_filings_36mo"]  # replace with 36mo total
        erp_merged = erp_merged.drop(columns=["latest_role_year", "n_filings_36mo", "latest_year"])

        # No min-filing filter — include every role that had >=1 filing in the 36-month window.
        # User requirement: "Even if one of the role had just 1 filling then show it"
        erp_merged = erp_merged[erp_merged["n_filings"] >= 1].copy()

        # Rank by 36-month filing count per employer, keep top 25 (UI shows top 10)
        erp_merged = erp_merged.sort_values(["employer_name", "n_filings"], ascending=[True, False])
        erp_top = erp_merged.groupby("employer_name").head(25).reset_index(drop=True)

        # Enrich and round
        erp_top["soc_title"] = erp_top["soc_code"].map(soc_map).fillna("")
        erp_cols = [
            "employer_name", "soc_code", "soc_title", "fiscal_year", "n_filings",
            "mean_salary", "median_salary", "p10_salary", "p25_salary", "p75_salary",
            "p90_salary", "prevailing_wage_median", "wage_premium_pct", "wage_vs_pw_pct",
            "oews_national_median", "visa_type", "job_title_top", "worksite_state_top",
        ]
        erp_cols = [c for c in erp_cols if c in erp_top.columns]
        erp_out = erp_top[erp_cols].copy()
        for col in ["mean_salary", "median_salary", "p10_salary", "p25_salary",
                    "p75_salary", "p90_salary", "prevailing_wage_median",
                    "oews_national_median"]:
            if col in erp_out.columns:
                erp_out[col] = erp_out[col].fillna(0).round(0).astype(int)
        for col in ["wage_premium_pct", "wage_vs_pw_pct"]:
            if col in erp_out.columns:
                erp_out[col] = erp_out[col].fillna(0).round(1)

        n_employers = erp_out["employer_name"].nunique()
        n = df_to_json(erp_out, out_dir / "employer_role_profiles.json")
        size_kb = (out_dir / "employer_role_profiles.json").stat().st_size / 1024
        print(f"    ✓ employer_role_profiles: {n:,} rows ({n_employers} employers × top-25 roles) → {size_kb:.0f} KB")

        # ── 4d. employer_role_trends — multi-year percentile history per employer×role ──
        # For role drill-down widget: last 5 years of p10/p25/p50/p75/p90 per employer+role.
        ert = esp[
            (esp["visa_type"] == "H-1B")
            & esp["employer_name"].notna()
            & esp["n_filings"].ge(2)
            & esp["median_salary"].notna()
        ].copy()

        # Top 5000 employers for percentile trend charts (larger set for deeper coverage)
        ert = ert[ert["employer_name"].isin(top_5000_by_filings)].copy()

        # Keep last 5 fiscal years of data per employer
        max_year = ert["fiscal_year"].max()
        ert = ert[ert["fiscal_year"] >= max_year - 4]

        # Enrich with SOC title
        ert["soc_title"] = ert["soc_code"].map(soc_map).fillna("")

        ert_cols = [
            "employer_name", "soc_code", "soc_title", "fiscal_year", "n_filings",
            "p10_salary", "p25_salary", "median_salary", "p75_salary", "p90_salary",
            "mean_salary", "oews_national_median", "visa_type",
        ]
        ert_cols = [c for c in ert_cols if c in ert.columns]
        ert_out = ert[ert_cols].copy()
        for col in ["p10_salary", "p25_salary", "median_salary", "p75_salary",
                    "p90_salary", "mean_salary", "oews_national_median"]:
            if col in ert_out.columns:
                ert_out[col] = ert_out[col].fillna(0).round(0).astype(int)

        ert_out = ert_out.sort_values(
            ["employer_name", "soc_code", "fiscal_year"], ascending=[True, True, True]
        ).reset_index(drop=True)

        n_ert = df_to_json(ert_out, out_dir / "employer_role_trends.json")
        n_ert_employers = ert_out["employer_name"].nunique()
        size_kb_ert = (out_dir / "employer_role_trends.json").stat().st_size / 1024
        print(f"    ✓ employer_role_trends: {n_ert:,} rows ({n_ert_employers} employers × roles × 5yr) → {size_kb_ert:.0f} KB")


def sync_employer_raw_filings():
    """
    Generate per-employer raw filing shards for the Wage dashboard's
    "Raw Filings" table.  Two data sources are merged into one file per employer:

      • LCA filings (DOL): per-case H-1B job offer records, last 36 months.
        Columns: case_number, job_title, soc_title, city, state, annual salary
                 (annualized from wage_unit), status, received_date, decision_date,
                 full_time, fiscal_year.
        No cap — every filing in the window is included.

      • Petition history (USCIS): annual aggregate petition outcomes FY2010-2023.
        Columns: fiscal_year, initial_approvals, initial_denials,
                 continuing_approvals, continuing_denials, total_petitions,
                 approval_rate.
        Sourced from fact_h1b_employer_hub; matched by fuzzy employer name.

    Output: public/data/employers/{employer_id}.json  (one per employer)
            public/data/employers/_index.json          (name → id mapping)
    """
    print("\n📋 Syncing employer raw filing shards...")
    out_dir = OUT_DIR / "employers"
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── Load supporting tables ─────────────────────────────────────────────
    esy = read_parquet_safe(P2_TABLES / "employer_salary_yearly.parquet")
    if esy.empty:
        print("  ⚠  employer_salary_yearly missing — skipping raw filings sync")
        return

    # ALL employers with ≥5 total H-1B filings (matching search index threshold)
    _all_emp = (
        esy[esy["visa_type"] == "H-1B"]
        .groupby(["employer_name", "employer_id"])["total_filings"]
        .sum()
        .reset_index()
        .sort_values("total_filings", ascending=False)
    )
    top_employers_series = _all_emp[_all_emp["total_filings"] >= 5].copy()
    # employer_name → employer_id mapping (canonical)
    emp_id_map: dict = top_employers_series.set_index("employer_name")["employer_id"].to_dict()

    # ── Load LCA filings (last 36 months) ─────────────────────────────────
    # Filter LCA to last 3 fiscal years (latest 36 months of data).
    # Use fiscal_year-based filtering (not received_date) to ensure consistent,
    # fiscal-year-aligned views that match user expectations and dashboard labels.
    print(f"  Loading fact_lca (latest 3 fiscal years)...")
    lca = read_parquet_safe(P2_TABLES / "fact_lca")
    if not lca.empty:
        if "fiscal_year" in lca.columns:
            lca["fiscal_year"] = lca["fiscal_year"].astype(int)
            max_fy = int(lca["fiscal_year"].max())
            lca = lca[lca["fiscal_year"] >= max_fy - 3].copy()
            print(f"    Filtered to FY >= {max_fy - 3} (FY {max_fy - 3}-{max_fy}): {len(lca):,} rows")

    # Annualise wages (wage_rate_from → annual equivalent)
    def _to_annual(row):
        amt = row.get("wage_rate_from")
        if amt is None or (isinstance(amt, float) and (amt != amt)):  # NaN check
            return 0
        amt = float(amt)
        unit = str(row.get("wage_unit") or "Year").strip().lower()
        if "hour" in unit:
            return round(amt * 2080)
        elif "week" in unit:
            return round(amt * 52)
        elif "bi-week" in unit or "biweek" in unit:
            return round(amt * 26)
        elif "month" in unit:
            return round(amt * 12)
        else:  # Year / Annual
            return round(amt)

    def _to_annual_high(row):
        hi = row.get("wage_rate_to")
        if hi is None or (isinstance(hi, float) and (hi != hi)) or hi <= 0:
            return None
        hi = float(hi)
        unit = str(row.get("wage_unit") or "Year").strip().lower()
        if "hour" in unit:
            return round(hi * 2080)
        elif "week" in unit:
            return round(hi * 52)
        elif "bi-week" in unit or "biweek" in unit:
            return round(hi * 26)
        elif "month" in unit:
            return round(hi * 12)
        else:
            return round(hi)

    if not lca.empty:
        # Vectorized annualization — much faster than row-wise apply
        w = lca["wage_rate_from"].fillna(0)
        unit = lca["wage_unit"].fillna("Year").str.lower().str.strip()
        multiplier = pd.Series(1, index=lca.index, dtype="float64")
        multiplier = multiplier.where(~unit.str.contains("hour"), 2080)
        multiplier = multiplier.where(~(unit.str.contains("week") & ~unit.str.contains("bi")), 52)
        multiplier = multiplier.where(~unit.str.contains("bi-?week"), 26)
        multiplier = multiplier.where(~unit.str.contains("month"), 12)
        lca["wage_annual"] = (w * multiplier).round(0).astype(int)

        w_hi = lca["wage_rate_to"].fillna(0)
        lca["wage_annual_high"] = (w_hi * multiplier).round(0).astype("Int64")
        # Set null where high == 0 or <= wage_annual
        lca.loc[lca["wage_annual_high"] <= 0, "wage_annual_high"] = pd.NA

    # ── Load H-1B Employer Hub (petition history) ─────────────────────────
    hub = read_parquet_safe(P2_TABLES / "fact_h1b_employer_hub.parquet")
    hub_by_employer: dict = {}  # canonical_name → list[dict]
    if not hub.empty:
        # NOTE: fact_h1b_employer_hub is full historical data (FY2010–FY2023).
        # USCIS discontinued publishing this dataset after FY2023, so ALL rows are
        # flagged is_stale=True by P2's ingestion pipeline. We keep all rows here
        # because the historical data is still valid and useful for trend display.
        hub = hub.copy()
        # Build lookup: lower-cased raw hub name → list of rows
        hub_lower = hub.copy()
        hub_lower["_name_lower"] = hub_lower["employer_name"].str.lower().str.strip()

        def _match_hub_rows(canonical_name: str) -> list:
            """Find h1b_employer_hub rows matching a canonical employer name."""
            # Try several progressively looser strategies
            cn_lower = canonical_name.lower().strip()
            # Strategy 1: exact lower match
            rows = hub_lower[hub_lower["_name_lower"] == cn_lower]
            if len(rows) == 0:
                # Strategy 2: canonical name is a substring of hub name
                rows = hub_lower[hub_lower["_name_lower"].str.contains(
                    cn_lower[:30], regex=False, na=False
                )]
            if len(rows) == 0:
                # Strategy 3: first 3 significant words of canonical name
                words = [w for w in cn_lower.split() if len(w) > 2][:3]
                if words:
                    pattern = " ".join(words)
                    rows = hub_lower[hub_lower["_name_lower"].str.contains(
                        pattern, regex=False, na=False
                    )]
            if len(rows) == 0:
                return []

            # Group by fiscal_year
            agg_cols = [
                "fiscal_year", "initial_approvals", "initial_denials",
                "continuing_approvals", "continuing_denials", "total_petitions",
            ]
            agg_cols = [c for c in agg_cols if c in rows.columns]
            grouped = rows[agg_cols].groupby("fiscal_year").sum().reset_index()
            grouped["total_petitions"] = (
                grouped.get("initial_approvals", 0)
                + grouped.get("initial_denials", 0)
                + grouped.get("continuing_approvals", 0)
                + grouped.get("continuing_denials", 0)
            )
            grouped["approval_rate"] = (
                (grouped.get("initial_approvals", 0) + grouped.get("continuing_approvals", 0))
                / grouped["total_petitions"].replace(0, 1)
            ).round(4)
            grouped = grouped.sort_values("fiscal_year", ascending=False)
            return grouped.to_dict(orient="records")

        for emp_name in emp_id_map.keys():
            hub_by_employer[emp_name] = _match_hub_rows(emp_name)

    # ── Build per-employer shard files ────────────────────────────────────
    LCA_KEEP_COLS = [
        "case_number", "job_title", "soc_title", "worksite_city", "worksite_state",
        "wage_annual", "wage_annual_high", "case_status", "visa_class",
        "received_date", "decision_date", "is_fulltime", "fiscal_year",
    ]
    index_map: dict = {}
    shards_written = 0
    skipped = 0

    # No row cap — include every LCA filing in the 36-month window.
    # User requirement: "each and every LCA filing from last 36 months".

    for emp_name, emp_id in emp_id_map.items():
        if not emp_id:
            skipped += 1
            continue

        # --- LCA rows for this employer (last 5 fiscal years)
        lca_rows: list = []
        lca_total: int = 0          # total cases in window (before cap)
        lca_fy_range: list = []     # [min_fy, max_fy] actually present
        if not lca.empty and "employer_id" in lca.columns:
            emp_lca = lca[lca["employer_id"] == emp_id].copy()
            # LCA data is already filtered to 36-month window globally above.
            # No per-employer cap — include every filing.

            if not emp_lca.empty:
                lca_total = len(emp_lca)
                fy_present = emp_lca["fiscal_year"].dropna().astype(int)
                lca_fy_range = [int(fy_present.min()), int(fy_present.max())] if len(fy_present) > 0 else []

                # Sort by FY descending then received_date descending
                sort_cols = [c for c in ["fiscal_year", "received_date"] if c in emp_lca.columns]
                emp_lca = emp_lca.sort_values(sort_cols, ascending=[False] * len(sort_cols))

                # Keep only useful columns
                keep = [c for c in LCA_KEEP_COLS if c in emp_lca.columns]
                emp_lca = emp_lca[keep].copy()
                # Sanitise NaN/inf/pd.NA → 0 for numerics, None for wage_annual_high
                for col in emp_lca.select_dtypes(include=["float64", "float32"]).columns:
                    emp_lca[col] = emp_lca[col].fillna(0).astype(int)
                # wage_annual_high: convert nullable Int64 pd.NA → None for JSON
                # (pd.NA in Int64 becomes float NaN after .where(); use list comp instead)
                if "wage_annual_high" in emp_lca.columns:
                    emp_lca["wage_annual_high"] = [
                        int(v) if pd.notna(v) and v and int(v) > 0 else None
                        for v in emp_lca["wage_annual_high"]
                    ]
                emp_lca["is_fulltime"] = emp_lca["is_fulltime"].fillna(False).astype(bool)
                lca_rows = emp_lca.to_dict(orient="records")

        # --- H-1B petition history rows
        petition_rows = hub_by_employer.get(emp_name, [])

        if not lca_rows and not petition_rows:
            skipped += 1
            continue

        shard = {
            "employer_name": emp_name,
            "employer_id": emp_id,
            "lca": lca_rows,
            # Metadata so the UI can show "5,000 of 18,234 records · FY2021–FY2025"
            "lca_total": lca_total,
            "lca_fy_range": lca_fy_range,
            "h1b_petitions": petition_rows,
        }
        shard_path = out_dir / f"{emp_id}.json"
        # Use json.dumps with a NaN→null encoder to produce spec-compliant JSON
        import json as _json
        import math as _math
        class _NaNSafeEncoder(_json.JSONEncoder):
            def default(self, obj):
                return str(obj)
            def iterencode(self, o, _one_shot=False):
                # Replace NaN/Infinity with null at float serialisation level
                for chunk in super().iterencode(o, _one_shot):
                    yield chunk
        def _nan_to_null(v):
            """Recursively convert NaN/pd.NA/Inf values to None."""
            import pandas as _pd
            if v is _pd.NA:
                return None
            if isinstance(v, float) and (v != v or _math.isinf(v)):
                return None
            if isinstance(v, dict):
                return {kk: _nan_to_null(vv) for kk, vv in v.items()}
            if isinstance(v, list):
                return [_nan_to_null(x) for x in v]
            return v
        shard_path.write_text(_json.dumps(_nan_to_null(shard)))
        index_map[emp_name] = emp_id
        shards_written += 1

    # Write index file
    index_path = out_dir / "_index.json"
    import json as _json
    index_path.write_text(_json.dumps(index_map))
    index_kb = index_path.stat().st_size / 1024

    total_kb = sum(
        (out_dir / f"{eid}.json").stat().st_size
        for eid in index_map.values()
        if (out_dir / f"{eid}.json").exists()
    ) / 1024
    print(f"  ✓ {shards_written:,} employer shards written  ({total_kb:,.0f} KB total)")
    print(f"  ✓ _index.json: {len(index_map):,} employers → {index_kb:.0f} KB")
    if skipped:
        print(f"  ↷ {skipped} employers skipped (no LCA data in window)")


def consolidate_employer_shards():
    """
    Consolidate monolithic employer JSON files into per-employer shards.

    Reads already-generated monolithic JSON files (wage + SRS) and embeds
    employer-specific slices into existing per-employer shard files.  Also
    generates:
      • _search.json  — unified employer search index (~16 MB, <20 MB CloudFront limit)
      • srs_overview.json — pre-computed SRS aggregate statistics (~200 bytes)
      • _freshness.json  — sync timestamp (~50 bytes, replaces 14 MB _manifest.json for UI)

    After consolidation the monolithic files are removed from the build output,
    cutting ~400 MB of redundant data.
    """
    import math as _math

    print("\n🔗 Consolidating employer shards (embedding wage + SRS data)...")
    employers_dir = OUT_DIR / "employers"
    employer_dir = OUT_DASHBOARDS / "employer"
    wage_dir = OUT_DASHBOARDS / "wage"

    # ── Read the shard index ───────────────────────────────────────────────
    index_path = employers_dir / "_index.json"
    if not index_path.exists():
        print("  ⚠ _index.json missing — run sync_employer_raw_filings() first")
        return
    with open(index_path) as f:
        emp_index: dict = json.load(f)  # employer_name → employer_id (hash)

    # Build reverse map: employer_id → employer_name
    id_to_name = {v: k for k, v in emp_index.items()}

    # ── Load monolithic wage JSONs ─────────────────────────────────────────
    def _load_json_safe(path: Path) -> list:
        if not path.exists():
            print(f"  ⚠ {path.name} not found — skipping")
            return []
        with open(path) as f:
            data = json.load(f)
        return data if isinstance(data, list) else []

    role_profiles_raw = _load_json_safe(wage_dir / "employer_role_profiles.json")
    salary_trend_raw = _load_json_safe(wage_dir / "employer_salary_trend.json")
    role_trends_raw = _load_json_safe(wage_dir / "employer_role_trends.json")
    search_index_raw = _load_json_safe(wage_dir / "employer_search_index.json")

    # ── Load monolithic SRS JSONs ──────────────────────────────────────────
    srs_scores_raw = _load_json_safe(employer_dir / "employer_friendliness_scores.json")
    srs_monthly_raw = _load_json_safe(employer_dir / "employer_monthly_metrics.json")

    # ── Group by employer_name ─────────────────────────────────────────────
    def _group_by(records: list, key: str = "employer_name") -> dict:
        grouped: dict = {}
        for r in records:
            k = r.get(key)
            if k:
                grouped.setdefault(k, []).append(r)
        return grouped

    role_profiles_by_emp = _group_by(role_profiles_raw)
    salary_trend_by_emp = _group_by(salary_trend_raw)
    role_trends_by_emp = _group_by(role_trends_raw)

    def _group_by_id(records: list, key: str = "employer_id") -> dict:
        grouped: dict = {}
        for r in records:
            k = r.get(key)
            if k:
                grouped.setdefault(k, []).append(r)
        return grouped

    srs_scores_by_id = _group_by_id(srs_scores_raw)
    srs_monthly_by_id = _group_by_id(srs_monthly_raw)

    # Build search index lookup by name for SRS enrichment
    search_index_map = {r["employer_name"]: r for r in search_index_raw}

    # ── NaN sanitizer ──────────────────────────────────────────────────────
    def _nan_to_null(v):
        if isinstance(v, float) and (v != v or _math.isinf(v)):
            return None
        if isinstance(v, dict):
            return {kk: _nan_to_null(vv) for kk, vv in v.items()}
        if isinstance(v, list):
            return [_nan_to_null(x) for x in v]
        return v

    # ── Strip redundant employer_name/employer_id from embedded arrays ─────
    # These fields are already on the shard root, no need to repeat in every
    # child record (saves ~10-20% shard size for large employers).
    def _strip_emp_fields(records: list) -> list:
        return [
            {k: v for k, v in r.items() if k not in ("employer_name", "employer_id")}
            for r in records
        ]

    # ── Consolidate into each shard ────────────────────────────────────────
    shards_enriched = 0
    for emp_name, emp_id in emp_index.items():
        shard_path = employers_dir / f"{emp_id}.json"
        if not shard_path.exists():
            continue

        with open(shard_path) as f:
            shard = json.load(f)

        # Embed wage data
        wage_roles = role_profiles_by_emp.get(emp_name, [])
        wage_trend = salary_trend_by_emp.get(emp_name, [])
        wage_role_trends = role_trends_by_emp.get(emp_name, [])
        if wage_roles:
            shard["wage_roles"] = _strip_emp_fields(wage_roles)
        if wage_trend:
            shard["wage_trend"] = _strip_emp_fields(wage_trend)
        if wage_role_trends:
            shard["wage_role_trends"] = _strip_emp_fields(wage_role_trends)

        # Embed SRS data — filter to overall scope only
        srs_records = srs_scores_by_id.get(emp_id, [])
        srs_overall = [r for r in srs_records if r.get("scope") == "overall"]
        if srs_overall:
            srs_entry = srs_overall[0].copy()
            # Remove redundant fields (already on shard root)
            for k in ("employer_name", "employer_id"):
                srs_entry.pop(k, None)
            shard["srs"] = srs_entry
        srs_monthly = srs_monthly_by_id.get(emp_id, [])
        if srs_monthly:
            shard["srs_monthly"] = _strip_emp_fields(srs_monthly)

        shard_path.write_text(json.dumps(_nan_to_null(shard)))
        shards_enriched += 1

    print(f"  ✓ {shards_enriched:,} shards enriched with wage + SRS data")

    # ── Sample shard sizes ─────────────────────────────────────────────────
    import random
    sample_ids = random.sample(list(emp_index.values()), min(100, len(emp_index)))
    sample_sizes = []
    for sid in sample_ids:
        sp = employers_dir / f"{sid}.json"
        if sp.exists():
            sample_sizes.append(sp.stat().st_size)
    if sample_sizes:
        avg_kb = sum(sample_sizes) / len(sample_sizes) / 1024
        max_kb = max(sample_sizes) / 1024
        print(f"    Sample shard stats: avg {avg_kb:.1f} KB, max {max_kb:.1f} KB (n={len(sample_sizes)})")

    # ── Generate unified search index (_search.json) ───────────────────────
    # Enriches existing search index with SRS score/tier for cross-dashboard search.
    unified_search = []
    # Build SRS lookup: employer_name → {srs_score, srs_tier}
    srs_lookup: dict = {}
    for rec in srs_scores_raw:
        if rec.get("scope") == "overall":
            name = rec.get("employer_name")
            if name:
                efs_val = rec.get("efs")
                srs_val = efs_val if efs_val is not None and not (isinstance(efs_val, float) and efs_val != efs_val) else None
                srs_tier = rec.get("efs_tier", "Unrated") if srs_val is not None else "Unrated"
                srs_lookup[name] = {"srs_score": srs_val, "srs_tier": srs_tier}

    # Compact key names keep _search.json under the 20 MB CloudFront object limit.
    # TypeScript loadEmployerSearch() in employer-shard.ts detects format via
    # the presence of the 'n' key and maps compact → full field names.
    for rec in search_index_raw:
        name = rec["employer_name"]
        srs_info = srs_lookup.get(name)
        entry = {
            "n": name,                                      # employer_name
            "id": emp_index.get(name, ""),                  # employer_id
            "f": rec.get("total_filings", 0),              # total_filings
            "sc": rec.get("n_soc_codes", 0),               # n_soc_codes
            "ms": rec.get("latest_median_salary", 0),      # latest_median_salary
            "y": rec.get("latest_year", 0),                # latest_year
            "ss": srs_info["srs_score"] if srs_info else None,  # srs_score
            "st": srs_info["srs_tier"] if srs_info else "Unrated",  # srs_tier
        }
        unified_search.append(entry)

    # Also add SRS-only employers not in the wage search index
    wage_names = {r["employer_name"] for r in search_index_raw}
    for rec in srs_scores_raw:
        if rec.get("scope") != "overall":
            continue
        name = rec.get("employer_name")
        if name and name not in wage_names:
            emp_id = emp_index.get(name, "")
            efs_val = rec.get("efs")
            srs_val = efs_val if efs_val is not None and not (isinstance(efs_val, float) and efs_val != efs_val) else None
            srs_tier = rec.get("efs_tier", "Unrated") if srs_val is not None else "Unrated"
            unified_search.append({
                "n": name,          # employer_name
                "id": emp_id,       # employer_id
                "f": 0,             # total_filings
                "sc": 0,            # n_soc_codes
                "ms": 0,            # latest_median_salary
                "y": 0,             # latest_year
                "ss": srs_val,      # srs_score
                "st": srs_tier,     # srs_tier
            })

    # Sort by filing count desc
    unified_search.sort(key=lambda x: x.get("total_filings", 0), reverse=True)

    search_path = employers_dir / "_search.json"
    search_path.write_text(json.dumps(_nan_to_null(unified_search)))
    search_kb = search_path.stat().st_size / 1024
    print(f"  ✓ _search.json: {len(unified_search):,} employers → {search_kb:.0f} KB")

    # ── Generate SRS overview stats ────────────────────────────────────────
    overall_scores = [r for r in srs_scores_raw if r.get("scope") == "overall"]
    rated = []
    tier_counts = {"Excellent": 0, "Good": 0, "Moderate": 0, "Below Average": 0, "Poor": 0, "Unrated": 0}
    for r in overall_scores:
        efs_val = r.get("efs")
        srs_val = efs_val if efs_val is not None and not (isinstance(efs_val, float) and efs_val != efs_val) else None
        tier = r.get("efs_tier", "Unrated")
        if tier not in tier_counts:
            tier = "Unrated"
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
        if srs_val is not None:
            rated.append(srs_val)

    rated.sort()
    avg_score = round(sum(rated) / len(rated), 1) if rated else 0
    mid = len(rated) // 2
    median_score = rated[mid] if rated else 0
    if len(rated) > 0 and len(rated) % 2 == 0:
        median_score = round((rated[mid - 1] + rated[mid]) / 2, 1)

    srs_overview = {
        "totalEmployers": len(overall_scores),
        "ratedEmployers": len(rated),
        "avgScore": avg_score,
        "medianScore": median_score,
        "tierDistribution": tier_counts,
    }
    overview_path = employer_dir / "srs_overview.json"
    overview_path.parent.mkdir(parents=True, exist_ok=True)
    overview_path.write_text(json.dumps(srs_overview))
    print(f"  ✓ srs_overview.json: {len(overall_scores):,} employers → {overview_path.stat().st_size} bytes")

    # ── Generate _freshness.json ───────────────────────────────────────────
    freshness_path = OUT_DIR / "_freshness.json"
    freshness_path.write_text(json.dumps({"synced_at": datetime.now(timezone.utc).isoformat()}))
    print(f"  ✓ _freshness.json: {freshness_path.stat().st_size} bytes")

    # ── Remove monolithic files (now embedded in shards) ───────────────────
    monolithic_files = [
        wage_dir / "employer_role_profiles.json",
        wage_dir / "employer_salary_trend.json",
        wage_dir / "employer_role_trends.json",
        wage_dir / "employer_search_index.json",
        employer_dir / "employer_friendliness_scores.json",
        employer_dir / "employer_monthly_metrics.json",
        OUT_DIMS / "dim_employer.json",
    ]
    removed = 0
    freed_mb = 0
    for fp in monolithic_files:
        if fp.exists():
            freed_mb += fp.stat().st_size / (1024 * 1024)
            fp.unlink()
            removed += 1
    print(f"  ✓ Removed {removed} monolithic files ({freed_mb:.0f} MB freed)")


def write_manifest():
    """Write a build manifest with timestamps and sizes (for ops/debugging)."""
    manifest = {
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "p2_root": str(P2_ROOT),
        "files": {},
    }

    # Only catalog non-shard files (avoid listing 95K+ shard files)
    for json_path in OUT_DIR.rglob("*.json"):
        rel = json_path.relative_to(OUT_DIR)
        # Skip individual employer shards to keep manifest manageable
        rel_str = str(rel)
        if rel_str.startswith("employers/") and rel_str != "employers/_index.json" and rel_str != "employers/_search.json":
            continue
        manifest["files"][rel_str] = {
            "size_bytes": json_path.stat().st_size,
            "modified": datetime.fromtimestamp(
                json_path.stat().st_mtime, tz=timezone.utc
            ).isoformat(),
        }

    manifest_path = OUT_DIR / "_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n📋 Manifest: {len(manifest['files'])} files")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("P2 Meridian → P3 Compass Data Sync")
    print("=" * 60)

    # Validate P2 exists
    if not P2_TABLES.exists():
        print(f"❌ P2 artifacts not found at: {P2_TABLES}")
        print("   Make sure immigration-model-builder is at the expected path.")
        sys.exit(1)

    # Parse args
    rag_only = "--rag-only" in sys.argv
    dashboard_filter = None
    if "--dashboard" in sys.argv:
        idx = sys.argv.index("--dashboard")
        if idx + 1 < len(sys.argv):
            dashboard_filter = sys.argv[idx + 1]

    # Ensure output dirs exist
    for d in [OUT_DASHBOARDS, OUT_DIMS, OUT_MODELS, OUT_RAG]:
        d.mkdir(parents=True, exist_ok=True)

    if rag_only:
        sync_rag()
    else:
        sync_dashboards(dashboard_filter)
        sync_wage_dashboard()
        sync_employer_raw_filings()
        consolidate_employer_shards()
        sync_dimensions()
        sync_models()
        sync_rag()

    write_manifest()
    print("\n✅ Sync complete!")


if __name__ == "__main__":
    main()
