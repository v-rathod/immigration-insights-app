#!/usr/bin/env python3
"""
Fix NaN values in all P3 JSON data files.
Python's json.dump() outputs bare NaN (invalid JSON spec).
This script replaces all bare NaN tokens with null.
Also fixes the df_to_json() in sync_p2_data.py to prevent regression.
"""
import re
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "public" / "data"

NAN_PATTERN = re.compile(r'(?<=[:\[,])\s*NaN\s*(?=[,}\]])')

fixed_count = 0
total_nans = 0

for json_path in sorted(DATA_DIR.rglob("*.json")):
    content = json_path.read_text(encoding="utf-8")
    if "NaN" not in content:
        continue
    count = content.count(":NaN") + content.count(": NaN") + content.count("[NaN") + content.count(",NaN")
    new_content = re.sub(r'(?<=[:\[,])\s*NaN(?=\s*[,}\]])', 'null', content)
    # Extra pass: handle NaN at end of array/object
    new_content = new_content.replace(':NaN}', ':null}').replace(',NaN}', ',null}').replace('[NaN]', '[null]')
    # Simple final sweep for any remaining bare NaN after colon
    new_content = re.sub(r':NaN\b', ':null', new_content)
    new_content = re.sub(r',NaN\b', ',null', new_content)
    new_content = re.sub(r'\[NaN\b', '[null', new_content)
    
    if new_content != content:
        json_path.write_text(new_content, encoding="utf-8")
        size_kb = json_path.stat().st_size // 1024
        print(f"  ✓ Fixed {json_path.relative_to(DATA_DIR.parent.parent)} ({size_kb} KB, ~{count} NaNs)")
        fixed_count += 1
        total_nans += count

print(f"\nFixed {fixed_count} files, ~{total_nans} NaN→null replacements")

# Verify no NaN remaining
remaining = [p for p in DATA_DIR.rglob("*.json") if "NaN" in p.read_text()]
if remaining:
    print(f"\n⚠ Still has NaN: {[str(p) for p in remaining]}")
else:
    print("✅ All JSON files are now valid JSON (no bare NaN)")
