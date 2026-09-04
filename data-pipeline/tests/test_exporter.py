import hashlib
import tempfile
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

from light_trip_data.exporter import build_city_files, write_candidate
from light_trip_data.models import Area, CityDataset, Observation, PlaceKind, SourceLevel, TransportSample


def synthetic_dataset():
    areas = tuple(
        Area(
            id=f"area-{index}",
            city_id="beijing",
            name=f"片区{index}",
            description="合成片区",
            center_note="中心点",
            fixed_rank=index,
        )
        for index in range(1, 5)
    )
    observations = []
    for index in range(30):
        observations.append(
            Observation(
                city_id="beijing",
                kind=PlaceKind.ATTRACTION,
                name=f"景点{index + 1:02d}",
                address=f"地址{index + 1:02d}",
                source_url="https://example.gov.cn/source.html",
                collected_at=date(2026, 7, 23),
                area_id=areas[index % 4].id,
                category_tags=("nightlife",),
                price_value=Decimal("60"),
                duration_minutes=120,
                spending_tiers=("economy", "comfortable"),
                source_level=SourceLevel.A,
            )
        )
    for index in range(20):
        observations.append(
            Observation(
                city_id="beijing",
                kind=PlaceKind.RESTAURANT,
                name=f"餐厅{index + 1:02d}",
                address=f"餐厅地址{index + 1:02d}",
                source_url="https://venue.example.cn/source.html",
                collected_at=date(2026, 7, 23),
                area_id=areas[index % 4].id,
                category_tags=("local",),
                price_value=Decimal("90"),
                duration_minutes=60,
                source_level=SourceLevel.B,
            )
        )
    for index in range(12):
        observations.append(
            Observation(
                city_id="beijing",
                kind=PlaceKind.HOTEL,
                name=f"酒店{index + 1:02d}",
                address=f"酒店地址{index + 1:02d}",
                source_url="https://hotel.example.cn/source.html",
                collected_at=date(2026, 7, 23),
                area_id=areas[index % 4].id,
                price_value=Decimal("420"),
                grade="comfort",
                source_level=SourceLevel.B,
            )
        )
    samples = []
    for area in areas:
        samples.append(
            TransportSample(
                city_id="beijing",
                from_area_id=area.id,
                to_area_id=area.id,
                mode="walk",
                distance_km_raw=Decimal("1.2"),
                duration_minutes_raw=18,
                price_raw=Decimal("0"),
                pricing="perPerson",
                source_url="https://example.gov.cn/transport.html",
                collected_at=date(2026, 7, 23),
                rounding_rule="default",
            )
        )
    for from_area in areas:
        for to_area in areas:
            if from_area.id == to_area.id:
                continue
            samples.append(
                TransportSample(
                    city_id="beijing",
                    from_area_id=from_area.id,
                    to_area_id=to_area.id,
                    mode="publicTransit",
                    distance_km_raw=Decimal("8"),
                    duration_minutes_raw=35,
                    price_raw=Decimal("5"),
                    pricing="perPerson",
                    source_url="https://example.gov.cn/transport.html",
                    collected_at=date(2026, 7, 23),
                    rounding_rule="directed",
                )
            )
    return CityDataset("beijing", areas, tuple(observations), tuple(samples), ())


class ExporterTests(unittest.TestCase):
    def test_build_city_files_match_existing_json_shapes(self):
        files = build_city_files(synthetic_dataset())

        self.assertEqual(
            {
                "areas.json",
                "attractions.json",
                "restaurants.json",
                "hotels.json",
                "travel-matrix.json",
            },
            set(files),
        )
        self.assertEqual(
            {"id", "name", "areaId", "categories", "durationMinutes", "ticketPerPerson", "tiers", "fixedRank"},
            set(files["attractions.json"][0]),
        )
        self.assertNotIn("sourceUrl", files["attractions.json"][0])
        self.assertEqual({"id", "name", "areaId", "cuisines", "costPerPerson", "durationMinutes", "fixedRank"}, set(files["restaurants.json"][0]))
        self.assertEqual({"id", "name", "areaId", "grade", "pricePerRoomNight", "fixedRank"}, set(files["hotels.json"][0]))
        self.assertEqual({"id", "name", "defaultTransports"}, set(files["areas.json"][0]))
        self.assertEqual({"fromAreaId", "toAreaId", "mode", "distanceKm", "durationMinutes", "pricing", "price"}, set(files["travel-matrix.json"][0]))

    def test_ids_and_fixed_ranks_are_stable_and_continuous(self):
        files = build_city_files(synthetic_dataset())

        self.assertEqual("bj-a01", files["attractions.json"][0]["id"])
        self.assertEqual("bj-r01", files["restaurants.json"][0]["id"])
        self.assertEqual("bj-h01", files["hotels.json"][0]["id"])
        self.assertEqual(list(range(1, 31)), [item["fixedRank"] for item in files["attractions.json"]])

    def test_export_values_are_frontend_schema_compatible(self):
        files = build_city_files(synthetic_dataset())

        self.assertEqual(["landmark", "food", "shopping"], files["attractions.json"][0]["categories"])
        self.assertEqual(["economy", "comfortable"], files["attractions.json"][0]["tiers"])
        self.assertEqual("three-star", files["hotels.json"][0]["grade"])

    def test_write_candidate_is_utf8_stable_and_does_not_touch_src_data(self):
        files = build_city_files(synthetic_dataset())
        with tempfile.TemporaryDirectory() as tmp:
            output_root = Path(tmp)
            first = write_candidate(output_root, "beijing", files)
            first_hashes = _hashes(first)
            second = write_candidate(output_root, "beijing", files)
            second_hashes = _hashes(second)

            attractions = (second / "attractions.json").read_text(encoding="utf-8")

        self.assertEqual(first_hashes, second_hashes)
        self.assertTrue(attractions.endswith("\n"))
        self.assertIn('  "id": "bj-a01"', attractions)
        self.assertFalse(Path("src/data/beijing/attractions.json.tmp").exists())


def _hashes(root: Path):
    return {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.glob("*.json"))
    }


if __name__ == "__main__":
    unittest.main()
