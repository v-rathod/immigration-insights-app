#!/usr/bin/env python3
"""
CI-safe regression tests for consolidate_employer_shards() in sync_p2_data.py.

Unlike predeploy-checks.test.ts (which needs a real build + real P2 parquet
data, ~1.3 GB, dev-machine only), these tests use tiny synthetic JSON fixtures
and run entirely in a temp directory. No P2 data, no pyarrow, no network.
Only dependency is pandas (already required to import sync_p2_data.py).

This exists because the exact bug it guards against (shards silently missing
wage_roles/srs, _search.json/srs_overview.json silently corrupted when the
monolithic wage/SRS inputs are missing) has recurred more than once, and
predeploy-checks.test.ts is excluded from CI — so this is the only automated
backstop that runs on every push/PR.

Usage:
    python3 scripts/test_consolidation.py
    python3 -m unittest scripts.test_consolidation -v
"""
from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sync_p2_data as s  # noqa: E402


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data))


class ConsolidationTestBase(unittest.TestCase):
    def setUp(self):
        self.tmpdir = Path(tempfile.mkdtemp(prefix="compass-consolidation-test-"))
        self._orig_out_dir = s.OUT_DIR
        self._orig_out_dashboards = s.OUT_DASHBOARDS
        s.OUT_DIR = self.tmpdir / "data"
        s.OUT_DASHBOARDS = s.OUT_DIR / "dashboards"

    def tearDown(self):
        s.OUT_DIR = self._orig_out_dir
        s.OUT_DASHBOARDS = self._orig_out_dashboards
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _seed_index_and_shards(self, employers: dict[str, str]) -> None:
        """employers: {employer_name: employer_id}"""
        employers_dir = s.OUT_DIR / "employers"
        _write_json(employers_dir / "_index.json", employers)
        for name, eid in employers.items():
            _write_json(employers_dir / f"{eid}.json", {
                "employer_name": name,
                "employer_id": eid,
                "lca": [],
                "lca_total": 0,
            })


class TestNormalEmbedding(ConsolidationTestBase):
    """The happy path: monolithic inputs present -> shards get enriched."""

    def test_embeds_wage_and_srs_into_shard(self):
        self._seed_index_and_shards({"Acme Corp": "id-acme", "Beta Inc": "id-beta"})

        wage_dir = s.OUT_DASHBOARDS / "wage"
        employer_dir = s.OUT_DASHBOARDS / "employer"

        _write_json(wage_dir / "employer_role_profiles.json", [
            {"employer_name": "Acme Corp", "soc_code": "15-1252", "median_salary": 120000, "n_filings": 10},
        ])
        _write_json(wage_dir / "employer_salary_trend.json", [
            {"employer_name": "Acme Corp", "fiscal_year": 2025, "median_salary": 120000, "total_filings": 10},
        ])
        _write_json(wage_dir / "employer_role_trends.json", [
            {"employer_name": "Acme Corp", "soc_code": "15-1252", "fiscal_year": 2025, "median_salary": 120000},
        ])
        _write_json(wage_dir / "employer_search_index.json", [
            {"employer_name": "Acme Corp", "total_filings": 10, "n_soc_codes": 1, "latest_median_salary": 120000, "latest_year": 2025},
            {"employer_name": "Beta Inc", "total_filings": 5, "n_soc_codes": 1, "latest_median_salary": 90000, "latest_year": 2024},
        ])
        _write_json(employer_dir / "employer_friendliness_scores.json", [
            {"employer_id": "id-acme", "employer_name": "Acme Corp", "scope": "overall", "efs": 88.5, "efs_tier": "Excellent"},
        ])
        _write_json(employer_dir / "employer_monthly_metrics.json", [
            {"employer_id": "id-acme", "employer_name": "Acme Corp", "month": "2025-01", "n_cases": 3},
        ])

        s.consolidate_employer_shards()

        acme_shard = json.loads((s.OUT_DIR / "employers" / "id-acme.json").read_text())
        self.assertIn("wage_roles", acme_shard)
        self.assertIn("wage_trend", acme_shard)
        self.assertIn("wage_role_trends", acme_shard)
        self.assertIn("srs", acme_shard)
        self.assertEqual(acme_shard["srs"]["efs_tier"], "Excellent")
        self.assertIn("srs_monthly", acme_shard)

        beta_shard = json.loads((s.OUT_DIR / "employers" / "id-beta.json").read_text())
        self.assertNotIn("wage_roles", beta_shard)  # no role profile fixture for Beta
        self.assertNotIn("srs", beta_shard)  # no SRS fixture for Beta

        search = json.loads((s.OUT_DIR / "employers" / "_search.json").read_text())
        self.assertEqual(len(search), 2)
        acme_entry = next(e for e in search if e["n"] == "Acme Corp")
        self.assertEqual(acme_entry["st"], "Excellent")

        overview = json.loads((employer_dir / "srs_overview.json").read_text())
        self.assertEqual(overview["totalEmployers"], 1)
        self.assertEqual(overview["tierDistribution"]["Excellent"], 1)

        # Monolithic inputs must be deleted after a successful consolidation.
        self.assertFalse((wage_dir / "employer_role_profiles.json").exists())
        self.assertFalse((employer_dir / "employer_friendliness_scores.json").exists())


class TestGuardsAgainstCorruption(ConsolidationTestBase):
    """
    Regression test for the exact incident this test suite was created for:
    monolithic inputs missing (e.g. already deleted by a prior consolidation
    run) must NOT silently overwrite a healthy _search.json / srs_overview.json
    with an empty/tiny one.
    """

    def test_refuses_to_shrink_search_json(self):
        self._seed_index_and_shards({"Acme Corp": "id-acme"})
        # Pre-existing healthy _search.json with many entries.
        healthy_search = [{"n": f"Employer {i}", "id": f"id-{i}", "f": 10} for i in range(2000)]
        _write_json(s.OUT_DIR / "employers" / "_search.json", healthy_search)

        # No monolithic wage/SRS inputs written -> search_index_raw etc all empty,
        # simulating them having already been deleted by a prior run.
        with self.assertRaises(RuntimeError):
            s.consolidate_employer_shards()

        # The healthy file must be untouched, not overwritten with an empty one.
        still_there = json.loads((s.OUT_DIR / "employers" / "_search.json").read_text())
        self.assertEqual(len(still_there), 2000)

    def test_refuses_to_zero_out_srs_overview(self):
        self._seed_index_and_shards({"Acme Corp": "id-acme"})
        employer_dir = s.OUT_DASHBOARDS / "employer"
        # Existing search.json is small (below the 1000-entry guard threshold)
        # so the _search.json guard doesn't fire first, letting us reach the
        # srs_overview.json guard in isolation.
        _write_json(s.OUT_DIR / "employers" / "_search.json", [{"n": "Acme Corp", "id": "id-acme", "f": 10}])
        _write_json(employer_dir / "srs_overview.json", {"totalEmployers": 500, "ratedEmployers": 400})

        with self.assertRaises(RuntimeError):
            s.consolidate_employer_shards()

        still_there = json.loads((employer_dir / "srs_overview.json").read_text())
        self.assertEqual(still_there["totalEmployers"], 500)


if __name__ == "__main__":
    unittest.main(verbosity=2)
