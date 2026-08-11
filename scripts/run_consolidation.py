#!/usr/bin/env python3
"""
Run the wage/SRS re-consolidation step from sync_p2_data.py.

sync_p2_data.py's own main() already calls consolidate_employer_shards()
once, right after generating the wage + SRS "monolithic" JSONs — and then
DELETES those monolithic files (employer_role_profiles.json,
employer_salary_trend.json, employer_role_trends.json,
employer_search_index.json, employer_friendliness_scores.json,
employer_monthly_metrics.json) to save ~338 MB of build output.

That means those inputs are GONE by the time a full `npm run sync-data`
finishes, so re-running consolidation standalone with stale/missing inputs
silently embeds nothing (and can corrupt _search.json, since it also gets
rebuilt from the now-empty employer_search_index.json).

This script is for the case where LCA shards are already up to date but the
wage/SRS dashboards need to be regenerated and re-embedded WITHOUT paying the
cost of the full multi-hour employer_raw_filings() shard rebuild. It
regenerates the required monolithic inputs itself (via sync_dashboards() +
sync_wage_dashboard()) before running consolidation, so it is self-sufficient
and safe to run at any time, standalone or after a full sync.

Run this BEFORE scripts/_regen_search.py — consolidation writes the raw
(non-deduped) _search.json; _regen_search.py then merges duplicate/typo
employer names on top of it.

Usage:
    python3 scripts/run_consolidation.py
"""
import sys
import os

# Add the scripts dir to the path so we can import from sync_p2_data
sys.path.insert(0, os.path.dirname(__file__))

# Import the sync functions that produce the monolithic wage/SRS inputs,
# plus the consolidation function itself.
from sync_p2_data import sync_dashboards, sync_wage_dashboard, consolidate_employer_shards

if __name__ == "__main__":
    print("🔗 Regenerating wage + SRS dashboards, then consolidating into shards...")
    print()
    sync_dashboards(dashboard_filter="employer")
    sync_wage_dashboard()
    print()
    print("   Reading from: public/data/dashboards/wage/ and employer/")
    print("   Writing to:   public/data/employers/*.json")
    print()
    consolidate_employer_shards()
    print()
    print("✅ Consolidation complete!")
    print("   Next steps:")
    print("   1. python3 scripts/_regen_search.py   (dedupe employer names in _search.json)")
    print("   2. npm run build                       (regenerate out/ from updated public/)")
    print("   3. bash scripts/deploy.sh --skip-build  (deploy shards to S3)")

