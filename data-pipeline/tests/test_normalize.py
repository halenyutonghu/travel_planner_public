import unittest
from datetime import date
from decimal import Decimal

from light_trip_data.models import Observation, PlaceKind, SourceLevel
from light_trip_data.normalize import (
    deduplicate,
    evaluate_evidence,
    normalize_address,
    normalize_name,
    round_value,
)


def observation(**overrides):
    values = {
        "city_id": "beijing",
        "kind": PlaceKind.ATTRACTION,
        "name": "故宫博物院",
        "address": "北京市东城区景山前街4号",
        "source_url": "https://example.gov.cn/source.html",
        "collected_at": date(2026, 7, 23),
        "published_at": date(2026, 6, 1),
        "area_id": "beijing-palace",
        "price_value": Decimal("60"),
        "source_level": SourceLevel.A,
    }
    values.update(overrides)
    return Observation(**values)


class NormalizeTests(unittest.TestCase):
    def test_normalize_name_and_address_are_deterministic(self):
        self.assertEqual("故宫博物院(午门)", normalize_name("　故宫博物院（午门） "))
        self.assertEqual("北京市东城区景山前街4号", normalize_address("北京市  东城区　景山前街４号"))

    def test_round_value_uses_documented_increments(self):
        cases = [
            (Decimal("23"), "duration_10", Decimal("20")),
            (Decimal("23"), "transit_5", Decimal("25")),
            (Decimal("4.26"), "distance_0_5", Decimal("4.5")),
            (Decimal("59.4"), "ticket_1", Decimal("59")),
            (Decimal("84"), "restaurant_10", Decimal("80")),
            (Decimal("231"), "hotel_20", Decimal("240")),
            (Decimal("276"), "hotel_50", Decimal("300")),
        ]
        for value, rule, expected in cases:
            with self.subTest(rule=rule):
                self.assertEqual(expected, round_value(value, rule))

    def test_deduplicate_merges_exact_name_and_address(self):
        unique, issues = deduplicate(
            [
                observation(name="故宫博物院", address="北京市东城区景山前街4号"),
                observation(name="　故宫博物院", address="北京市 东城区 景山前街４号"),
            ]
        )

        self.assertEqual(1, len(unique))
        self.assertEqual((), issues)

    def test_deduplicate_merges_same_name_area_and_similar_address(self):
        unique, issues = deduplicate(
            [
                observation(address="北京市东城区景山前街4号", area_id="beijing-palace"),
                observation(address="北京市东城区景山前街4号院内", area_id="beijing-palace"),
            ]
        )

        self.assertEqual(1, len(unique))
        self.assertEqual((), issues)

    def test_deduplicate_rejects_city_or_address_conflicts_and_ambiguity(self):
        unique, issues = deduplicate(
            [
                observation(name="合成地点", address="北京市东城区A路1号"),
                observation(name="合成地点", address="上海市黄浦区B路2号", city_id="shanghai"),
                observation(name="另一地点", address="北京市东城区C路3号", area_id=None),
                observation(name="另一地点", address="北京市西城区D路4号", area_id=None),
            ]
        )

        self.assertEqual(2, len(unique))
        self.assertEqual(["DEDUP_CONFLICT", "DEDUP_AMBIGUOUS"], [issue.code for issue in issues])

    def test_evaluate_evidence_passes_fresh_a_source(self):
        result = evaluate_evidence([observation()], as_of=date(2026, 7, 23))

        self.assertTrue(result.identity_pass)
        self.assertTrue(result.price_pass)
        self.assertEqual((), result.issues)

    def test_evaluate_evidence_requires_independent_support_for_b_identity(self):
        result = evaluate_evidence(
            [
                observation(source_level=SourceLevel.B, source_url="https://venue.example.cn/a.html"),
                observation(source_level=SourceLevel.C, source_url="https://institution.example.edu.cn/b.html"),
            ],
            as_of=date(2026, 7, 23),
        )

        self.assertTrue(result.identity_pass)

    def test_evaluate_evidence_rejects_stale_or_undated_price(self):
        result = evaluate_evidence(
            [
                observation(published_at=None),
                observation(published_at=date(2024, 1, 1), source_url="https://other.gov.cn/source.html"),
            ],
            as_of=date(2026, 7, 23),
        )

        self.assertTrue(result.identity_pass)
        self.assertFalse(result.price_pass)
        self.assertEqual("PRICE_EVIDENCE_MISSING", result.issues[0].code)


if __name__ == "__main__":
    unittest.main()
