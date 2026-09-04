import sqlite3
import unittest
from datetime import date, datetime
from decimal import Decimal

from light_trip_data.database import (
    finish_export_run,
    migrate,
    open_database,
    save_area,
    save_observation,
    save_origin_transport,
    save_source,
    save_transport_sample,
    start_export_run,
)
from light_trip_data.models import (
    Area,
    Observation,
    OriginTransport,
    PlaceKind,
    SourceLevel,
    SourceRecord,
    SourceType,
    TransportSample,
)


def source_record(url: str = "https://example.gov.cn/source.html") -> SourceRecord:
    return SourceRecord(
        url=url,
        domain="example.gov.cn",
        source_type=SourceType.GOVERNMENT,
        publisher="Example Government",
        title="Official List",
        fetched_at=datetime(2026, 7, 23, 10, 0, 0),
        http_status=200,
        content_hash="abc123",
        source_level=SourceLevel.A,
        published_at=date(2026, 6, 1),
    )


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.db = open_database(":memory:")
        self.connection = self.db.__enter__()
        migrate(self.connection)

    def tearDown(self):
        self.db.__exit__(None, None, None)

    def test_migration_creates_exact_application_tables(self):
        tables = {
            row[0]
            for row in self.connection.execute(
                "select name from sqlite_master where type='table' and name not like 'sqlite_%'"
            )
        }

        self.assertEqual(
            {
                "sources",
                "areas",
                "places",
                "place_sources",
                "transport_samples",
                "origin_transport",
                "export_runs",
            },
            tables,
        )

    def test_source_urls_are_unique(self):
        first_id = save_source(self.connection, source_record())
        second_id = save_source(self.connection, source_record())

        self.assertEqual(first_id, second_id)
        self.assertEqual(1, self.connection.execute("select count(*) from sources").fetchone()[0])

    def test_save_observation_upserts_place_and_appends_field_evidence(self):
        save_source(self.connection, source_record())
        save_area(
            self.connection,
            Area(
                id="beijing-palace",
                city_id="beijing",
                name="故宫王府井片区",
                description="核心历史文化活动区",
                center_note="故宫博物院附近",
                fixed_rank=1,
            ),
        )
        observation = Observation(
            city_id="beijing",
            kind=PlaceKind.ATTRACTION,
            name="故宫博物院",
            address="北京市东城区景山前街4号",
            source_url="https://example.gov.cn/source.html",
            collected_at=date(2026, 7, 23),
            area_id="beijing-palace",
            category_tags=("museum", "heritage"),
            price_value=Decimal("60"),
            duration_minutes=180,
            source_level=SourceLevel.A,
        )

        first_place_id = save_observation(self.connection, observation)
        second_place_id = save_observation(
            self.connection,
            Observation(
                city_id="beijing",
                kind=PlaceKind.ATTRACTION,
                name="故宫博物院",
                address="北京市东城区景山前街4号",
                source_url="https://example.gov.cn/source.html",
                collected_at=date(2026, 7, 23),
                price_value=Decimal("80"),
                source_level=SourceLevel.A,
            ),
        )

        self.assertEqual(first_place_id, second_place_id)
        self.assertEqual(1, self.connection.execute("select count(*) from places").fetchone()[0])
        price_values = [
            row[0]
            for row in self.connection.execute(
                "select observed_value from place_sources where field_name = 'price_value' order by id"
            )
        ]
        self.assertEqual(["60", "80"], price_values)

    def test_rejected_observations_are_preserved(self):
        save_source(self.connection, source_record())
        place_id = save_observation(
            self.connection,
            Observation(
                city_id="beijing",
                kind=PlaceKind.RESTAURANT,
                name="示例餐厅",
                address="北京市东城区示例路1号",
                source_url="https://example.gov.cn/source.html",
                collected_at=date(2026, 7, 23),
                status_text="rejected: source expired",
                source_level=SourceLevel.C,
            ),
        )

        row = self.connection.execute(
            "select status, unverified from places where id = ?", (place_id,)
        ).fetchone()
        self.assertEqual(("rejected", 1), tuple(row))

    def test_foreign_keys_are_enforced(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.connection.execute(
                """
                insert into place_sources (place_id, source_id, field_name, observed_value, observed_at)
                values (?, ?, ?, ?, ?)
                """,
                (999, 999, "name", "missing", "2026-07-23"),
            )

    def test_transport_and_export_repository_methods(self):
        source_id = save_source(self.connection, source_record())
        save_area(
            self.connection,
            Area(
                id="beijing-palace",
                city_id="beijing",
                name="故宫王府井片区",
                description="核心历史文化活动区",
                center_note="故宫博物院附近",
                fixed_rank=1,
            ),
        )
        save_area(
            self.connection,
            Area(
                id="beijing-lakes",
                city_id="beijing",
                name="什刹海片区",
                description="湖区和胡同活动区",
                center_note="什刹海附近",
                fixed_rank=2,
            ),
        )

        sample_id = save_transport_sample(
            self.connection,
            TransportSample(
                city_id="beijing",
                from_area_id="beijing-palace",
                to_area_id="beijing-lakes",
                mode="taxi",
                distance_km_raw=Decimal("4.2"),
                duration_minutes_raw=24,
                price_raw=Decimal("28"),
                pricing="metered",
                source_url="https://example.gov.cn/source.html",
                collected_at=date(2026, 7, 23),
                rounding_rule="round duration up to nearest 5 minutes",
            ),
        )
        origin_id = save_origin_transport(
            self.connection,
            OriginTransport(
                city_id="beijing",
                origin_name="北京首都国际机场",
                origin_aliases=("首都机场", "PEK"),
                mode="taxi",
                duration_minutes=65,
                price_per_person=Decimal("120"),
                is_fallback=False,
                source_url="https://example.gov.cn/source.html",
                collected_at=date(2026, 7, 23),
            ),
        )
        run_id = start_export_run(self.connection, "0.1.0", "snapshot-hash")
        finish_export_run(
            self.connection,
            run_id,
            status="passed",
            output_path="data-pipeline/output/run-1",
            report_path="data-pipeline/output/run-1/report.md",
            record_counts={"beijing": {"attractions": 30}},
            failure_summary="",
        )

        self.assertGreater(sample_id, 0)
        self.assertGreater(origin_id, 0)
        self.assertEqual(source_id, self.connection.execute("select source_id from origin_transport").fetchone()[0])
        self.assertEqual("passed", self.connection.execute("select status from export_runs").fetchone()[0])

    def test_save_observation_rolls_back_when_evidence_insert_fails(self):
        save_source(self.connection, source_record())
        self.connection.execute(
            """
            create trigger fail_place_sources_insert
            before insert on place_sources
            begin
                select raise(abort, 'forced evidence failure');
            end
            """
        )

        with self.assertRaises(sqlite3.IntegrityError):
            save_observation(
                self.connection,
                Observation(
                    city_id="beijing",
                    kind=PlaceKind.HOTEL,
                    name="示例酒店",
                    address="北京市东城区示例路2号",
                    source_url="https://example.gov.cn/source.html",
                    collected_at=date(2026, 7, 23),
                    grade="four_star",
                    source_level=SourceLevel.A,
                ),
            )

        self.assertEqual(0, self.connection.execute("select count(*) from places").fetchone()[0])


if __name__ == "__main__":
    unittest.main()
