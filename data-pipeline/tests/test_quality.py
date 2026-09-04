import unittest
from dataclasses import replace
from datetime import date
from decimal import Decimal

from light_trip_data.models import (
    Area,
    CityDataset,
    Observation,
    PlaceKind,
    SourceLevel,
    TransportSample,
)
from light_trip_data.quality import validate_city


REQUIRED_CATEGORIES = (
    "museum",
    "heritage",
    "park",
    "landmark",
    "shopping",
    "performance",
    "nightlife",
)
REQUIRED_GRADES = ("budget", "comfort", "premium", "luxury")


def valid_city():
    areas = tuple(
        Area(
            id=f"beijing-area-{index}",
            city_id="beijing",
            name=f"北京片区{index}",
            description="合成测试片区",
            center_note="合成中心点",
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
                name=f"合成景点{index + 1}",
                address=f"北京市测试路{index + 1}号",
                source_url="https://example.gov.cn/source.html",
                collected_at=date(2026, 7, 23),
                published_at=date(2026, 6, 1),
                area_id=areas[index % len(areas)].id,
                category_tags=(REQUIRED_CATEGORIES[index % len(REQUIRED_CATEGORIES)],),
                price_value=Decimal("60"),
                duration_minutes=120,
                source_level=SourceLevel.A,
            )
        )
    for index in range(20):
        observations.append(
            Observation(
                city_id="beijing",
                kind=PlaceKind.RESTAURANT,
                name=f"合成餐厅{index + 1}",
                address=f"北京市餐饮路{index + 1}号",
                source_url="https://venue.example.cn/restaurant.html",
                collected_at=date(2026, 7, 23),
                published_at=date(2026, 6, 1),
                area_id=areas[index % len(areas)].id,
                price_value=Decimal("90"),
                spending_tiers=("mid",),
                source_level=SourceLevel.B,
            )
        )
    for index in range(12):
        observations.append(
            Observation(
                city_id="beijing",
                kind=PlaceKind.HOTEL,
                name=f"合成酒店{index + 1}",
                address=f"北京市住宿路{index + 1}号",
                source_url="https://hotel.example.cn/hotel.html",
                collected_at=date(2026, 7, 23),
                published_at=date(2026, 6, 1),
                area_id=areas[index % len(areas)].id,
                price_value=Decimal("420"),
                grade=REQUIRED_GRADES[index % len(REQUIRED_GRADES)],
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
                distance_km_raw=Decimal("1"),
                duration_minutes_raw=10,
                price_raw=Decimal("0"),
                pricing="free",
                source_url="https://example.gov.cn/transport.html",
                collected_at=date(2026, 7, 23),
                rounding_rule="default area transport",
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
                    mode="taxi",
                    distance_km_raw=Decimal("6"),
                    duration_minutes_raw=25,
                    price_raw=Decimal("35"),
                    pricing="metered",
                    source_url="https://example.gov.cn/transport.html",
                    collected_at=date(2026, 7, 23),
                    rounding_rule="directed pair",
                )
            )
    return CityDataset(
        city_id="beijing",
        areas=areas,
        observations=tuple(observations),
        transport_samples=tuple(samples),
        origin_transport=(),
    )


class QualityTests(unittest.TestCase):
    def assert_has_code(self, dataset, code):
        self.assertIn(code, [issue.code for issue in validate_city(dataset)])

    def test_valid_city_has_no_issues(self):
        self.assertEqual((), validate_city(valid_city()))

    def test_quota_and_area_count_issues(self):
        dataset = valid_city()
        self.assert_has_code(replace(dataset, observations=dataset.observations[:-1]), "QUOTA_HOTELS")
        self.assert_has_code(replace(dataset, areas=dataset.areas[:3]), "AREA_COUNT")

    def test_category_and_hotel_grade_coverage_issues(self):
        dataset = valid_city()
        without_category = tuple(
            replace(item, category_tags=("museum",)) if item.kind == PlaceKind.ATTRACTION else item
            for item in dataset.observations
        )
        without_grade = tuple(
            replace(item, grade="budget") if item.kind == PlaceKind.HOTEL else item
            for item in dataset.observations
        )

        self.assert_has_code(replace(dataset, observations=without_category), "CATEGORY_COVERAGE")
        self.assert_has_code(replace(dataset, observations=without_grade), "HOTEL_GRADE_COVERAGE")

    def test_area_transport_source_and_negative_number_issues(self):
        dataset = valid_city()
        missing_area = replace(
            dataset,
            observations=(replace(dataset.observations[0], area_id="missing-area"),)
            + dataset.observations[1:],
        )
        rejected = replace(
            dataset,
            observations=(replace(dataset.observations[0], status_text="rejected: stale source"),)
            + dataset.observations[1:],
        )
        missing_default = replace(dataset, transport_samples=dataset.transport_samples[1:])
        missing_directed = replace(dataset, transport_samples=dataset.transport_samples[:-1])

        self.assert_has_code(missing_area, "MISSING_AREA")
        self.assert_has_code(rejected, "SOURCE_REJECTED")
        self.assert_has_code(missing_default, "MISSING_DEFAULT_TRANSPORT")
        self.assert_has_code(missing_directed, "MISSING_DIRECTED_TRANSPORT")

    def test_missing_required_price_is_blocking(self):
        dataset = valid_city()
        missing_price = replace(
            dataset,
            observations=(replace(dataset.observations[0], price_value=None),)
            + dataset.observations[1:],
        )

        self.assert_has_code(missing_price, "MISSING_PRICE")


if __name__ == "__main__":
    unittest.main()
