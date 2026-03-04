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
        "employer_features.parquet",
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
    "dim_employer.parquet",
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
    """Write DataFrame to JSON, return row count."""
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

    records = df.to_dict(orient=orient)
    with open(out_path, "w") as f:
        json.dump(records, f, separators=(",", ":"), default=str)

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

        # ── 4a. employer_search_index — ALL employers (no cutoff) for search ───
        esy = read_parquet_safe(P2_TABLES / "employer_salary_yearly.parquet")
        if not esy.empty:
            # Export ALL H-1B employers with minimal metadata for full-text search
            esy_all = esy[esy["visa_type"] == "H-1B"].copy()
            
            # Get total filings per employer
            employer_stats = (
                esy_all.groupby("employer_name")
                .agg({
                    "total_filings": "sum",
                    "n_soc_codes": "max",  # latest unique job titles
                    "median_salary": lambda x: x[x.notna()].median(),
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
            
            # Sort by filing count (most relevant first)
            employer_stats = employer_stats.sort_values("total_filings", ascending=False).reset_index(drop=True)
            
            n = df_to_json(employer_stats, out_dir / "employer_search_index.json")
            size_kb = (out_dir / "employer_search_index.json").stat().st_size / 1024
            print(f"    ✓ employer_search_index: {n:,} rows (ALL employers) → {size_kb:.0f} KB")

        # ── 4b. employer_salary_trend — top 300 employers' wage trend ───────
        if not esy.empty:
            # Get top employers by total filings (for trend visualization)
            top_employers = (
                esy[esy["visa_type"] == "H-1B"]
                .groupby("employer_name")["total_filings"]
                .sum()
                .nlargest(300)
                .index.tolist()
            )
            esy_top = esy[
                (esy["employer_name"].isin(top_employers))
                & (esy["fiscal_year"] >= 2016)
            ].copy()
            for col in ["mean_salary", "median_salary"]:
                esy_top[col] = esy_top[col].fillna(0).round(0).astype(int)
            n = df_to_json(esy_top, out_dir / "employer_salary_trend.json")
            size_kb = (out_dir / "employer_salary_trend.json").stat().st_size / 1024
            print(f"    ✓ employer_salary_trend: {n:,} rows (top 300) → {size_kb:.0f} KB")

        # ── 4c. employer_role_profiles — employer-centric role breakdown ─────
        # Top 500 employers × their top 25 H-1B roles by filing count.
        # This is the CORRECT data source for EmployerProfile's "Top Roles" section.
        # employer_wage_rankings.json is SOC-centric (top employers per SOC) which
        # causes large firms like Cognizant to appear for only 2 of their 33 roles.
        erp = esp[
            (esp["visa_type"] == "H-1B")
            & esp["employer_name"].notna()
        ].copy()

        # Identify top 500 employers by cumulative H-1B filings from yearly table
        if not esy.empty:
            top_500_by_filings = (
                esy[esy["visa_type"] == "H-1B"]
                .groupby("employer_name")["total_filings"]
                .sum()
                .nlargest(500)
                .index.tolist()
            )
        else:
            # Fallback: use all employers present in profiles
            top_500_by_filings = erp["employer_name"].unique().tolist()

        erp = erp[erp["employer_name"].isin(top_500_by_filings)].copy()

        # For each employer use their own latest available year (not a global benchmark)
        latest_year_per_emp = (
            erp.groupby("employer_name")["fiscal_year"].max().reset_index()
            .rename(columns={"fiscal_year": "latest_year"})
        )
        erp = erp.merge(latest_year_per_emp, on="employer_name")
        erp = erp[erp["fiscal_year"] == erp["latest_year"]].drop(columns=["latest_year"])

        # Drop roles with implausibly few filings or missing salary
        erp = erp[(erp["n_filings"] >= 2) & erp["median_salary"].notna()]

        # Rank by filing count per employer, keep top 25
        erp = erp.sort_values(["employer_name", "n_filings"], ascending=[True, False])
        erp_top = erp.groupby("employer_name").head(25).reset_index(drop=True)

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

        # Same top 500 employers as role_profiles
        ert = ert[ert["employer_name"].isin(top_500_by_filings)].copy()

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


def write_manifest():
    """Write a build manifest with timestamps and sizes."""
    manifest = {
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "p2_root": str(P2_ROOT),
        "files": {},
    }

    for json_path in OUT_DIR.rglob("*.json"):
        rel = json_path.relative_to(OUT_DIR)
        manifest["files"][str(rel)] = {
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
        sync_dimensions()
        sync_models()
        sync_rag()

    write_manifest()
    print("\n✅ Sync complete!")


if __name__ == "__main__":
    main()
