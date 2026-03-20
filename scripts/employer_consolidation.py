#!/usr/bin/env python3
"""
Employer Name Consolidation for P3 Search Index.

Uses industry-standard techniques for entity resolution:
1. Normalize spacing: "U S" -> "US"
2. Collapse typo-duplicates: triple letters -> double
3. Build canonical name map: aliases -> canonical (highest-filing variant)
4. Merge filing counts, SOC codes, and statistics for consolidated entities

This runs during _regen_search.py to produce a deduplicated _search.json.
"""

import re
from collections import defaultdict


def normalize_employer_name(name: str) -> str:
    """
    Produce a canonical key for employer name matching.

    Steps (industry-standard entity resolution):
    1. Lowercase + strip whitespace
    2. Normalize "U S" / "U.S." / "U. S." spacing patterns to "US"
    3. Collapse triple+ repeated characters to double (typo fix)
    4. Collapse multiple spaces to single
    5. Remove trailing punctuation noise (commas, periods, dashes)
    """
    if not name:
        return ""
    key = name.lower().strip()
    # Normalize U.S. patterns: "u s" / "u. s." / "u.s." -> "us"
    key = re.sub(r'\bu\s*\.\s*s\s*\.?\b', 'us', key)
    key = re.sub(r'\bu\s+s\b', 'us', key)
    # Collapse any repeated consonant runs (2+ of same letter -> 1)
    # This catches "worrldwide" -> "worldwie", "kellly" -> "kely", "sierrra" -> "siera"
    # but we only collapse runs of 2+ SAME consecutive chars to a single char
    key = re.sub(r'(.)\1+', r'\1', key)
    # Collapse multiple spaces
    key = re.sub(r'\s+', ' ', key)
    # Strip trailing punctuation noise
    key = key.strip(' ,.-')
    return key


def clean_canonical_name(name: str) -> str:
    """
    Fix abbreviation capitalization in the canonical employer name.

    DOL/USCIS data often has all-caps names (e.g. "COGNIZANT TECHNOLOGY SOLUTIONS US")
    which get title-cased to "Cognizant Technology Solutions Us". This re-applies
    proper casing for known abbreviations.
    """
    # Fix "U S" (space-separated) → "US"
    name = re.sub(r'\bU S\b', 'US', name)
    # Fix title-cased abbreviation at word boundary: "Us" → "US" (country code)
    # Use negative lookbehind to avoid affecting words like "Focus", "Bonus"
    name = re.sub(r'(?<=[A-Za-z0-9] )Us\b', 'US', name)
    # Fix other common title-case manglings of company abbreviations
    name = re.sub(r'\bLlc\b', 'LLC', name)
    name = re.sub(r'\bLlp\b', 'LLP', name)
    name = re.sub(r'\bN\.a\b', 'N.A.', name)
    return name


def build_consolidation_map(entries: list[dict]) -> dict[str, list[dict]]:
    """
    Group entries by their normalized canonical key.

    Returns: {canonical_key: [entry, entry, ...]}
    Each entry is a dict with keys: n, id, f, sc, ms, y, ss, st
    """
    groups = defaultdict(list)
    for e in entries:
        key = normalize_employer_name(e.get("n", ""))
        if key:
            groups[key].append(e)
    return dict(groups)


def consolidate_entries(entries: list[dict]) -> list[dict]:
    """
    Merge duplicate employer entries, keeping the highest-filing variant as canonical.

    Merging rules:
    - name (n): use the variant with the most total filings
    - id: use the id from the canonical variant (may have shard data)
    - total_filings (f): sum across all variants
    - n_soc_codes (sc): max across all variants
    - median_salary (ms): weighted average by filings (if available)
    - latest_year (y): max across all variants
    - srs_score (ss): use from canonical variant (rated one preferred)
    - srs_tier (st): use from canonical variant (rated one preferred)
    """
    groups = build_consolidation_map(entries)

    consolidated = []
    merge_log = []

    for key, group in groups.items():
        if len(group) == 1:
            # Still apply name cleaning to single entries (fix "Us"→"US" etc.)
            entry = dict(group[0])
            entry["n"] = clean_canonical_name(entry["n"])
            consolidated.append(entry)
            continue

        # Sort by filings desc, then by having a shard id, then by having SRS score
        group.sort(key=lambda e: (
            e.get("f", 0),
            1 if e.get("id") else 0,
            1 if e.get("ss") is not None else 0,
        ), reverse=True)

        canonical = group[0]  # highest-filing variant

        # Merge statistics
        total_filings = sum(e.get("f", 0) for e in group)
        max_soc = max(e.get("sc", 0) for e in group)
        max_year = max(e.get("y", 0) for e in group)

        # Weighted average salary
        weighted_salary_sum = sum(
            e.get("ms", 0) * e.get("f", 1)
            for e in group if e.get("ms", 0) > 0
        )
        total_salary_filings = sum(
            e.get("f", 1)
            for e in group if e.get("ms", 0) > 0
        )
        merged_salary = (
            round(weighted_salary_sum / total_salary_filings)
            if total_salary_filings > 0 else canonical.get("ms", 0)
        )

        # Prefer SRS data from rated variant
        srs_score = canonical.get("ss")
        srs_tier = canonical.get("st", "Unrated")
        for e in group:
            if e.get("ss") is not None:
                srs_score = e["ss"]
                srs_tier = e.get("st", "Unrated")
                break

        # Prefer id from variant that has one
        emp_id = canonical.get("id", "")
        for e in group:
            if e.get("id"):
                emp_id = e["id"]
                break

        merged = {
            "n": clean_canonical_name(canonical["n"]),  # fix "Us"→"US", "Llc"→"LLC" etc.
            "id": emp_id,
            "f": total_filings,
            "sc": max_soc,
            "ms": merged_salary,
            "y": max_year,
            "ss": srs_score,
            "st": srs_tier,
        }
        consolidated.append(merged)

        # Log the merge for debugging
        aliases = [e["n"] for e in group if e["n"] != canonical["n"]]
        if aliases:
            merge_log.append({
                "canonical": canonical["n"],
                "aliases": aliases,
                "total_filings": total_filings,
                "canonical_filings": canonical.get("f", 0),
            })

    # Sort by total filings descending (same as original)
    consolidated.sort(key=lambda e: e.get("f", 0), reverse=True)

    if merge_log:
        print(f"\n[consolidation] Merged {len(merge_log)} employer groups:")
        for m in sorted(merge_log, key=lambda x: -x["total_filings"])[:25]:
            print(f"  {m['canonical']!r:50s} <- {m['aliases']!r}")
            print(f"    combined filings: {m['total_filings']:>10,}")

    return consolidated


def get_merge_stats(entries: list[dict]) -> dict:
    """Return consolidation statistics without modifying data."""
    groups = build_consolidation_map(entries)
    multi = {k: v for k, v in groups.items() if len(v) > 1}
    total_merged = sum(len(v) - 1 for v in multi.values())
    return {
        "total_entries": len(entries),
        "unique_groups": len(groups),
        "multi_groups": len(multi),
        "entries_merged": total_merged,
        "after_count": len(entries) - total_merged,
    }


if __name__ == "__main__":
    # Quick self-test
    test_entries = [
        {"n": "Cognizant Technology Solutions Us", "id": "abc", "f": 131220, "sc": 32, "ms": 89128, "y": 2026, "ss": 81.3, "st": "Good"},
        {"n": "Cognizant Technology Solutions U S", "id": "def", "f": 20905, "sc": 30, "ms": 68078, "y": 2019, "ss": None, "st": "Unrated"},
        {"n": "Kelly Services", "id": "ghi", "f": 1001, "sc": 5, "ms": 70000, "y": 2025, "ss": 65.0, "st": "Fair"},
        {"n": "Kellly Services", "id": "", "f": 1, "sc": 1, "ms": 60000, "y": 2020, "ss": None, "st": "Unrated"},
        {"n": "Cognizant Worldwide", "id": "jkl", "f": 877, "sc": 15, "ms": 112000, "y": 2026, "ss": None, "st": "Unrated"},
        {"n": "Cognizant Worrldwide", "id": "", "f": 7, "sc": 3, "ms": 97802, "y": 2020, "ss": None, "st": "Unrated"},
    ]

    print("Before:", len(test_entries), "entries")
    result = consolidate_entries(test_entries)
    print(f"After: {len(result)} entries")
    for e in result:
        print(f"  {e['n']!r:45s} filings={e['f']:>10,}  srs={e['ss']}")
