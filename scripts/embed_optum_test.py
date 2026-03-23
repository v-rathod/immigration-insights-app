#!/usr/bin/env python3
import json
from pathlib import Path

# Load monolithic wage files
wage_dir = Path("public/data/dashboards/wage")
with open(wage_dir / "employer_role_profiles.json") as f:
    role_profiles = json.load(f)
with open(wage_dir / "employer_salary_trend.json") as f:
    salary_trend = json.load(f)
with open(wage_dir / "employer_role_trends.json") as f:
    role_trends = json.load(f)

# Load Optum shard
shard_path = Path("public/data/employers/78a46d3917846d886ef35fe989075cb353f21a1d.json")
with open(shard_path) as f:
    shard = json.load(f)

emp_name = shard["employer_name"]
print(f"Processing: {emp_name}")

# Find wage data for this employer
wage_roles_list = [r for r in role_profiles if r.get("employer_name") == emp_name]
wage_trend_list = [r for r in salary_trend if r.get("employer_name") == emp_name]
wage_role_trends_list = [r for r in role_trends if r.get("employer_name") == emp_name]

print(f"  wage_roles found: {len(wage_roles_list)}")
print(f"  salary_trend found: {len(wage_trend_list)}")
print(f"  role_trends found: {len(wage_role_trends_list)}")

# Strip employer fields and embed
def strip_emp(records):
    return [{k: v for k, v in r.items() if k not in ("employer_name", "employer_id")} for r in records]

if wage_roles_list:
    shard["wage_roles"] = strip_emp(wage_roles_list)
if wage_trend_list:
    shard["wage_trend"] = strip_emp(wage_trend_list)
if wage_role_trends_list:
    shard["wage_role_trends"] = strip_emp(wage_role_trends_list)

# Write back
shard_path.write_text(json.dumps(shard))

# Verify
with open(shard_path) as f:
    shard_check = json.load(f)

keys = list(shard_check.keys())
print(f"\n✅ Shard updated successfully!")
print(f"  Keys in shard: {keys}")
print(f"  wage_roles: {len(shard_check.get('wage_roles', []))} items")
print(f"  wage_trend: {len(shard_check.get('wage_trend', []))} items")
print(f"  wage_role_trends: {len(shard_check.get('wage_role_trends', []))} items")
