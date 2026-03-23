#!/usr/bin/env python3
import json
with open("out/data/employers/78a46d3917846d886ef35fe989075cb353f21a1d.json") as f:
    shard = json.load(f)
wage_count = len(shard.get('wage_roles', []))
print(f"Built shard wage_roles count: {wage_count}")
if wage_count > 0:
    print("✅ SUCCESS! Wage data is in the built shard")
else:
    print("❌ Wage data still missing from built output")
