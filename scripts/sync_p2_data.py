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
    "wage": [
        "salary_benchmarks.parquet",
    ],
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
        sync_dimensions()
        sync_models()
        sync_rag()

    write_manifest()
    print("\n✅ Sync complete!")


if __name__ == "__main__":
    main()
