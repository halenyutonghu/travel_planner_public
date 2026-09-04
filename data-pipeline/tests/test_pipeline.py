import json
import sqlite3
import tempfile
import unittest
from datetime import date
from pathlib import Path

from test_exporter import _hashes
from test_quality import valid_city

from light_trip_data.pipeline import PipelinePaths, run_pipeline
from run import main


def write_snapshot_sources(source_root: Path, dataset=None):
    dataset = dataset or valid_city()
    (source_root / "observations").mkdir(parents=True, exist_ok=True)
    (source_root / "transport").mkdir(parents=True, exist_ok=True)
    (source_root / "manifest.json").write_text("[]\n", encoding="utf-8")
    (source_root / "areas.json").write_text(
        json.dumps(
            {
                dataset.city_id: [
                    {
                        "id": area.id,
                        "cityId": area.city_id,
                        "name": area.name,
                        "description": area.description,
                        "centerNote": area.center_note,
                        "fixedRank": area.fixed_rank,
                        "status": area.status,
                    }
                    for area in dataset.areas
                ]
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (source_root / "observations" / f"{dataset.city_id}.json").write_text(
        json.dumps([_observation_json(item) for item in dataset.observations], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (source_root / "transport" / f"{dataset.city_id}.json").write_text(
        json.dumps(
            {
                "areaSamples": [_transport_json(item) for item in dataset.transport_samples],
                "originSamples": [],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return dataset


class PipelineTests(unittest.TestCase):
    def test_export_success_writes_candidates_and_export_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source_root = root / "sources"
            output_root = root / "output"
            database_path = root / "curation.sqlite3"
            write_snapshot_sources(source_root)

            status = run_pipeline(
                "export",
                as_of=date(2026, 7, 23),
                paths=PipelinePaths(source_root, output_root, database_path),
            )

            self.assertEqual(0, status)
            self.assertTrue((output_root / "candidate" / "beijing" / "attractions.json").exists())
            self.assertFalse((root / "src" / "data").exists())
            with sqlite3.connect(database_path) as connection:
                self.assertEqual("passed", connection.execute("select status from export_runs").fetchone()[0])

    def test_failed_quota_records_report_and_skips_candidate_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dataset = valid_city()
            short_dataset = type(dataset)(
                dataset.city_id,
                dataset.areas,
                dataset.observations[:-1],
                dataset.transport_samples,
                dataset.origin_transport,
            )
            source_root = root / "sources"
            output_root = root / "output"
            database_path = root / "curation.sqlite3"
            write_snapshot_sources(source_root, short_dataset)

            status = run_pipeline(
                "validate",
                as_of=date(2026, 7, 23),
                paths=PipelinePaths(source_root, output_root, database_path),
            )

            self.assertEqual(1, status)
            self.assertFalse((output_root / "candidate").exists())
            report = (output_root / "reports" / "report.md").read_text(encoding="utf-8")
            self.assertIn("本次没有生成最终 JSON，网站原有数据未被修改。", report)

    def test_repeated_exports_are_byte_identical(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source_root = root / "sources"
            output_root = root / "output"
            database_path = root / "curation.sqlite3"
            write_snapshot_sources(source_root)

            first_status = run_pipeline("export", as_of=date(2026, 7, 23), paths=PipelinePaths(source_root, output_root, database_path))
            first_hashes = _hashes(output_root / "candidate" / "beijing")
            second_status = run_pipeline("export", as_of=date(2026, 7, 23), paths=PipelinePaths(source_root, output_root, database_path))
            second_hashes = _hashes(output_root / "candidate" / "beijing")

            self.assertEqual((0, 0), (first_status, second_status))
            self.assertEqual(first_hashes, second_hashes)

    def test_validate_city_reports_data_gate_failure_for_missing_observations(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source_root = root / "sources"
            output_root = root / "output"
            database_path = root / "curation.sqlite3"
            (source_root / "observations").mkdir(parents=True)
            (source_root / "transport").mkdir(parents=True)
            (source_root / "manifest.json").write_text("[]\n", encoding="utf-8")
            write_snapshot_sources(source_root)
            (source_root / "observations" / "beijing.json").unlink()

            status = run_pipeline(
                "validate",
                as_of=date(2026, 7, 23),
                paths=PipelinePaths(source_root, output_root, database_path),
                city_id="beijing",
            )

            self.assertEqual(1, status)
            report = (output_root / "reports" / "report.md").read_text(encoding="utf-8")
            self.assertIn("QUOTA_ATTRACTIONS", report)

    def test_cli_accepts_city_filter(self):
        self.assertEqual(2, main(["validate", "--as-of", "bad-date", "--city", "beijing"]))


def _observation_json(item):
    return {
        "cityId": item.city_id,
        "kind": item.kind.value,
        "name": item.name,
        "address": item.address,
        "sourceUrl": item.source_url,
        "collectedAt": item.collected_at.isoformat(),
        "publishedAt": item.published_at.isoformat() if item.published_at else None,
        "areaId": item.area_id,
        "categoryTags": list(item.category_tags),
        "priceValue": str(item.price_value) if item.price_value is not None else None,
        "durationMinutes": item.duration_minutes,
        "grade": item.grade,
        "spendingTiers": list(item.spending_tiers),
        "sourceLevel": item.source_level.name,
        "statusText": item.status_text,
        "notes": item.notes,
    }


def _transport_json(item):
    return {
        "cityId": item.city_id,
        "fromAreaId": item.from_area_id,
        "toAreaId": item.to_area_id,
        "mode": item.mode,
        "distanceKmRaw": str(item.distance_km_raw),
        "durationMinutesRaw": item.duration_minutes_raw,
        "priceRaw": str(item.price_raw),
        "pricing": item.pricing,
        "sourceUrl": item.source_url,
        "collectedAt": item.collected_at.isoformat(),
        "roundingRule": item.rounding_rule,
        "notes": item.notes,
    }


if __name__ == "__main__":
    unittest.main()
