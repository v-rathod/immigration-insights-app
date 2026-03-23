#!/usr/bin/env python3
"""
Quick consolidation-only script: reads wage JSON + SRS data and embeds into existing shards.
Skips full sync and just focuses on embedding wage data into employer shards.
"""

import json
import math as _math
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = PROJECT_ROOT / "public" / "data"
OUT_DASHBOARDS = OUT_DIR / "dashboards"

def _load_json_safe(path: Path) -> list:
    if not path.exists():
        print(f"  ⚠ {path.name} not found — skipping")
        return []
    try:
        with open(path) as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception as e:
        print(f"  ⚠ Failed to load {path.name}: {e}")
        return []

def _group_by(records: list, key: str = "employer_name") -> dict:
    grouped: dict = {}
    for r in records:
        k = r.get(key)
        if k:
            grouped.setdefault(k, []).append(r)
    return grouped

def _nan_to_null(v):
    if isinstance(v, float) and (v != v or _math.isinf(v)):
        return None
    if isinstance(v, dict):
        return {kk: _nan_to_null(vv) for kk, vv in v.items()}
    if isinstance(v, list):
        return [_nan_to_null(x) for x in v]
    return v

def _strip_emp_fields(records: list) -> list:
    return [
        {k: v for k, v in r.items() if k not in ("employer_name", "employer_id")}
        for r in records
    ]

print("=" * 60)
print("Consolidation-Only: Embed Wage + SRS into Shards")
print("=" * 60)

employers_dir = OUT_DIR / "employers"
employer_dir = OUT_DASHBOARDS / "employer"
wage_dir = OUT_DASHBOARDS / "wage"

# Load index
index_path = employers_dir / "_index.json"
if not index_path.exists():
    print("❌ _index.json missing — run full sync first")
    exit(1)

with open(index_path) as f:
    emp_index: dict = json.load(f)

print(f"📋 Loaded {len(emp_index):,} employers from _index.json")

# Load wage + SRS JSONs
role_profiles_raw = _load_json_safe(wage_dir / "employer_role_profiles.json")
salary_trend_raw = _load_json_safe(wage_dir / "employer_salary_trend.json")
role_trends_raw = _load_json_safe(wage_dir / "employer_role_trends.json")
srs_scores_raw = _load_json_safe(employer_dir / "employer_friendliness_scores.json")
srs_monthly_raw = _load_json_safe(employer_dir / "employer_monthly_metrics.json")

print(f"💰 Loaded wage data: {len(role_profiles_raw):,} role profiles, {len(salary_trend_raw):,} salary trends, {len(role_trends_raw):,} role trends")
print(f"🏢 Loaded SRS data: {len(srs_scores_raw):,} scores, {len(srs_monthly_raw):,} monthly metrics")

# Group by employer
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

# Consolidate into shards
print("\n🔗 Consolidating into shards...")
shards_enriched = 0
shards_skipped = 0
shards_corrupted = 0

for emp_name, emp_id in list(emp_index.items())[:100]:  # Test on first 100 for now
    shard_path = employers_dir / f"{emp_id}.json"
    if not shard_path.exists():
        shards_skipped += 1
        continue

    try:
        with open(shard_path) as f:
            shard = json.load(f)
    except (json.JSONDecodeError, ValueError) as e:
        print(f"  ⚠ Corrupted shard: {emp_id} ({str(e)[:30]}...)")
        shards_corrupted += 1
        continue

    # Embed wage data
    wage_roles = role_profiles_by_emp.get(emp_name, [])
    wage_trend = salary_trend_by_emp.get(emp_name, [])
    wage_role_trends = role_trends_by_emp.get(emp_name, [])
    
    had_wage = False
    if wage_roles:
        shard["wage_roles"] = _strip_emp_fields(wage_roles)
        had_wage = True
    if wage_trend:
        shard["wage_trend"] = _strip_emp_fields(wage_trend)
        had_wage = True
    if wage_role_trends:
        shard["wage_role_trends"] = _strip_emp_fields(wage_role_trends)
        had_wage = True

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
    
    if shards_enriched % 10 == 0:
        print(f"  ✓ {shards_enriched} shards enriched ({shards_corrupted} corrupted skipped)")

print(f"\n✅ Consolidation complete!")
print(f"  ✓ {shards_enriched:,} shards enriched")
print(f"  ⚠ {shards_corrupted:,} corrupted shards skipped")
print(f"  ↷ {shards_skipped:,} shards not found")
