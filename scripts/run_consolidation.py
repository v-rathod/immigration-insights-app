#!/usr/bin/env python3
"""
Run ONLY the consolidate_employer_shards() step from sync_p2_data.py.
Use this when wage/SRS dashboard JSONs are up-to-date but the shard files
were regenerated without re-running consolidation.

Usage:
    python3 scripts/run_consolidation.py
"""
import sys
import os

# Add the scripts dir to the path so we can import from sync_p2_data
sys.path.insert(0, os.path.dirname(__file__))

# Import the consolidation function from the main sync script
from sync_p2_data import consolidate_employer_shards

if __name__ == "__main__":
    print("🔗 Running shard consolidation only (embedding wage + SRS data)...")
    print("   Reading from: public/data/dashboards/wage/ and employer/")
    print("   Writing to:   public/data/employers/*.json")
    print()
    consolidate_employer_shards()
    print()
    print("✅ Consolidation complete!")
    print("   Next steps:")
    print("   1. npm run build        (regenerate out/ from updated public/)")
    print("   2. bash scripts/deploy.sh --skip-build  (deploy shards to S3)")
