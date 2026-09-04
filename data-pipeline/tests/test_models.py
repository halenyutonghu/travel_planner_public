import unittest
from datetime import date

from light_trip_data.models import Observation, PlaceKind, SourceLevel


class ModelTests(unittest.TestCase):
    def test_observation_requires_source_and_collection_date(self):
        with self.assertRaises(ValueError):
            Observation(
                city_id="beijing",
                kind=PlaceKind.ATTRACTION,
                name="故宫博物院",
                address="北京市东城区景山前街4号",
                source_url="",
                collected_at=date(2026, 7, 23),
            )

    def test_source_levels_are_ordered(self):
        self.assertLess(SourceLevel.A.value, SourceLevel.D.value)


if __name__ == "__main__":
    unittest.main()
