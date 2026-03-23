#!/usr/bin/env python3
"""
Full consolidation: Embed wage + SRS data into ALL employer shards (production ready).
"""

import json
import math as _math
from pathlib import Path
from collections import defaultdict

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "public" / "data"
OUT_DASHBOARDS = OUT_DIR / "dashboards"

def _load_json_safe(path: Path) -> list:
    if not path.exists():
        print(f"  ⚠ {path.name} not found")
        return []
    print(f"  Loading {path.name}...", end=" ", flush=True)
    try:
        with open(path) as f:
            data = json.load(f)
        count = len(data) if isinstance(data, list) else 0
        print(f"({count} items)")
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"⚠ Error: {e}")
        return []

def _group_by(records: list, key: str = "employer_name") -> dict:
    grouped: dict = defaultdict(list)
    for r in records:
        k = r.get(key)
        if k:
            grouped[k].append(r)
    return dict(grouped)

def _nan_to_null(v):
    if isinstance(v, float) and (v != v or _math.isinf(v)):
        return None
    if isinstance(v, dict):
        return {kk: _nan_to_null(vv) for kk, vv in v.items()}
    if isinstance(v, list):
        return [_nan_to_null(x) for x in v]
    return v

def _strip_emp_fields(records: list) -> list:
    return [{k: v for k, v in r.items() if k not in ("employer_name", "employer_id")} for r in records]

print("=" * 70)
print("FULL CONSOLIDATION: Embed Wage + SRS into ALL Shards")
print("=" * 70)

employers_dir = OUT_DIR / "employers"
employer_dir = OUT_DASHBOARDS / "employer"
wage_dir = OUT_DASHBOARDS / "wage"

# Load index
index_path = employers_dir / "_index.json"
if not index_path.exists():
    print("❌ _index.json missing")
    exit(1)

with open(index_path) as f:
    emp_index: dict = json.load(f)

print(f"\n📋 Loaded {len(emp_index):,} employers")

# Load wage + SRS JSONs
print("\n💰 Loading wage data...")
role_profiles_raw = _load_json_safe(wage_dir / "employer_role_profiles.json")
salary_trend_raw = _load_json_safe(wage_dir / "employer_salary_trend.json")
role_trends_raw = _load_json_safe(wage_dir / "employer_role_trends.json")

print("\n🏢 Loading SRS data...")
srs_scores_raw = _load_json_safe(employer_dir / "employer_friendliness_scores.json")
srs_monthly_raw = _load_json_safe(employer_dir / "employer_monthly_metrics.json")

# Group
print("\n🔄 Grouping by employer...")
role_profiles_by_emp = _group_by(role_profiles_raw)
salary_trend_by_emp = _group_by(salary_trend_raw)
role_trends_by_emp = _group_by(role_trends_raw)

def _group_by_id(records: list, key: str = "employer_id") -> dict:
    grouped: dict = defaultdict(list)
    for r in records:
        k = r.get(key)
        if k:
            grouped[k].append(r)
    return dict(grouped)

srs_scores_by_id = _group_by_id(srs_scores_raw)
srs_monthly_by_id = _group_by_id(srs_monthly_raw)

# Consolidate ALL shards
print(f"\n🔗 Consolidating {len(emp_index):,} shards...")
shards_enriched = 0
shards_corrupted = 0
shards_skipped = 0

for i, (emp_name, emp_id) in enumerate(emp_index.items()):
    if i > 0 and i % 5000 == 0:
        print(f"  Progress: {i:,} / {len(emp_index):,}")
    
    shard_path = employers_dir / f"{emp_id}.json"
    if not shard_path.exists():
        shards_skipped += 1
        continue

    try:
        with open(shard_path) as f:
            shard = json.load(f)
    except (json.JSONDecodeError, ValueError):
        shards_corrupted += 1
        continue

    # Embed wage data
    if emp_name in role_profiles_by_emp:
        shard["wage_roles"] = _strip_emp_fields(role_profiles_by_emp[emp_name])
    if emp_name in salary_trend_by_emp:
        shard["wage_trend"] = _strip_emp_fields(salary_trend_by_emp[emp_name])
    if emp_name in role_trends_by_emp:
        shard["wage_role_trends"] = _strip_emp_fields(role_trends_by_emp[emp_name])

    # Embed SRS data
    srs_records = srs_scores_by_id.get(emp_id, [])
    srs_overall = [r for r in srs_records if r.get("scope") == "overall"]
    if srs_overall:
        srs_entry = srs_overall[0].copy()
        for k in ("employer_name", "employer_id"):
            srs_entry.pop(k, None)
        shard["srs"] = srs_entry
    
    srs_monthly = srs_monthly_by_id.get(emp_id, [])
    if srs_monthly:
        shard["srs_monthly"] = _strip_emp_fields(srs_monthly)

    # Write back
    shard_path.write_text(json.dumps(_nan_to_null(shard)))
    shards_enriched += 1

print(f"\n✅ CONSOLIDATION COMPLETE!")
print(f"  ✓ {shards_enriched:,} shards enriched")
if shards_corrupted:
    print(f"  ⚠ {shards_corrupted:,} corrupted (skipped)")
if shards_skipped:
    print(f"  ↷ {shards_skipped:,} not found")
