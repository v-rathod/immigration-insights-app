"""Quick regeneration of _search.json with compact keys from P2 Parquet source."""
import pandas as pd
import json
from pathlib import Path

P2 = Path("/Users/vrathod1/dev/NorthStar/immigration-model-builder/artifacts/tables")
OUT = Path("/Users/vrathod1/dev/NorthStar/immigration-insights-app/public/data/employers")

print("Loading employer_salary_yearly...")
esy = pd.read_parquet(P2 / "employer_salary_yearly.parquet")
esy_h1b = esy[esy["visa_type"] == "H-1B"].copy()

stats = (
    esy_h1b.groupby("employer_name")
    .agg({
        "total_filings": "sum",
        "n_soc_codes": "max",
        "median_salary": "median",
        "fiscal_year": "max",
    })
    .reset_index()
    .rename(columns={"median_salary": "latest_median_salary", "fiscal_year": "latest_year"})
)
stats = stats[stats["total_filings"] >= 5].sort_values("total_filings", ascending=False)
stats["latest_median_salary"] = stats["latest_median_salary"].fillna(0).round(0).astype(int)
stats["latest_year"] = stats["latest_year"].fillna(0).astype(int)
print(f"  {len(stats):,} employers with >=5 H-1B filings")

with open(OUT / "_index.json") as f:
    emp_index = json.load(f)
print(f"  _index.json: {len(emp_index):,} employers")

# Load SRS scores for enrichment
srs_lookup = {}
srs_path = P2 / "employer_friendliness_scores.parquet"
if srs_path.exists():
    srs = pd.read_parquet(srs_path)
    srs_overall = srs[srs["scope"] == "overall"] if "scope" in srs.columns else srs
    for _, row in srs_overall.iterrows():
        name = row.get("employer_name")
        if name:
            efs = row.get("efs")
            srs_lookup[name] = {
                "ss": None if (efs is None or (isinstance(efs, float) and efs != efs)) else round(float(efs), 1),
                "st": row.get("efs_tier", "Unrated"),
            }
    print(f"  SRS scores loaded: {len(srs_lookup):,} employers")

# Build compact entries
entries = []
for _, row in stats.iterrows():
    name = row["employer_name"]
    srs = srs_lookup.get(name, {})
    entries.append({
        "n": name,
        "id": emp_index.get(name, ""),
        "f": int(row["total_filings"]),
        "sc": int(row["n_soc_codes"]),
        "ms": int(row["latest_median_salary"]),
        "y": int(row["latest_year"]),
        "ss": srs.get("ss"),
        "st": srs.get("st", "Unrated"),
    })

out_path = OUT / "_search.json"
out_path.write_text(json.dumps(entries))
size_kb = out_path.stat().st_size / 1024
print(f"\n+ _search.json: {len(entries):,} employers -> {size_kb:.0f} KB")

first = entries[0]
print(f"  Sample: {first['n']} (id={first['id'][:8]}..., f={first['f']:,}, ss={first['ss']}, st={first['st']})")

# Verify Optum Services is present
optum_matches = [e for e in entries if "optum" in e["n"].lower()]
for e in optum_matches[:3]:
    print(f"  Optum: {e['n']} -> id={e['id'][:8]}..., f={e['f']:,}")
