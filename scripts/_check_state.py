#!/usr/bin/env python3
"""Quick data state check."""
import json, os, hashlib

base = "public/data"

# srs_overview
p = f"{base}/dashboards/employer/srs_overview.json"
if os.path.exists(p):
    d = json.load(open(p))
    print(f"srs_overview: totalEmployers={d.get('totalEmployers')}")
else:
    print("srs_overview: MISSING")

# _search.json
p2 = f"{base}/employers/_search.json"
if os.path.exists(p2):
    data = json.load(open(p2))
    has_ac = sum(1 for e in data if "ac" in e)
    print(f"_search: {len(data)} entries, {has_ac} with ac")
else:
    print("_search: MISSING")

# Infosys shard
h = hashlib.sha1("infosys".encode()).hexdigest()
p3 = f"{base}/employers/{h}.json"
if os.path.exists(p3):
    d = json.load(open(p3))
    print(f"Infosys: wage_roles={'wage_roles' in d}, wage_trend={'wage_trend' in d}")
else:
    print("Infosys: MISSING")

# Monolithic wage files
for fn in ["employer_role_profiles.json", "employer_salary_trend.json", "employer_role_trends.json"]:
    fp = f"{base}/dashboards/wage/{fn}"
    print(f"  {fn}: {'EXISTS' if os.path.exists(fp) else 'MISSING'}")
