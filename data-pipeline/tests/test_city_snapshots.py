import json
import unittest
from pathlib import Path

from light_trip_data.config import load_manifest
from light_trip_data.exporter import build_city_files
from light_trip_data.pipeline import _load_transport_samples
from test_exporter import synthetic_dataset


SOURCE_ROOT = Path(__file__).parents[1] / "sources"
CITY_IDS = {"beijing", "shanghai", "guangzhou", "kunming", "nanjing"}


class CitySnapshotConfigTests(unittest.TestCase):
    def test_area_definitions_cover_exactly_five_cities(self):
        areas = json.loads((SOURCE_ROOT / "areas.json").read_text(encoding="utf-8"))

        self.assertEqual(CITY_IDS, set(areas))
        for city_id, city_areas in areas.items():
            with self.subTest(city_id=city_id):
                self.assertGreaterEqual(len(city_areas), 4)
                self.assertLessEqual(len(city_areas), 6)
                self.assertEqual(len(city_areas), len({item["id"] for item in city_areas}))
                self.assertEqual(list(range(1, len(city_areas) + 1)), [item["fixedRank"] for item in city_areas])
                self.assertTrue(all("行政区" not in item["description"] for item in city_areas))

    def test_manifest_has_unique_official_a_level_source_for_each_city(self):
        specs = load_manifest(SOURCE_ROOT / "manifest.json")

        self.assertEqual(len(specs), len({item.source_id for item in specs}))
        self.assertEqual(len(specs), len({item.url for item in specs}))
        for city_id in CITY_IDS:
            with self.subTest(city_id=city_id):
                self.assertTrue(
                    any(item.city_id == city_id and item.source_level.name == "A" for item in specs),
                    f"{city_id} needs at least one A-level source",
                )

    def test_origin_samples_never_appear_in_exported_json(self):
        city_id = "beijing"
        raw_transport = json.loads((SOURCE_ROOT / "transport" / f"{city_id}.json").read_text(encoding="utf-8"))
        samples = _load_transport_samples(SOURCE_ROOT / "transport" / f"{city_id}.json")

        files = build_city_files(synthetic_dataset())
        payload = json.dumps(files, ensure_ascii=False)

        self.assertIn("originSamples", raw_transport)
        self.assertGreater(len(samples), 0)
        self.assertNotIn("originSamples", payload)
        self.assertNotIn("北京首都国际机场", payload)


if __name__ == "__main__":
    unittest.main()
