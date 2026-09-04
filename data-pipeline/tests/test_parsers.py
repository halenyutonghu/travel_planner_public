import json
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

from light_trip_data.collector import CollectedDocument
from light_trip_data.models import PlaceKind, SourceLevel, SourceSpec, SourceType
from light_trip_data.parsers import parse_document, write_snapshot


FIXTURES = Path(__file__).parent / "fixtures"


def document(body: bytes, media_type: str, url: str = "https://example.gov.cn/list.html"):
    return CollectedDocument(
        url=url,
        http_status=200,
        media_type=media_type,
        body=body,
        fetched_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
        content_hash="abc123",
    )


def spec(parser: str = "html-table", content_format: str = "html"):
    return SourceSpec(
        source_id="fixture-source",
        city_id="beijing",
        url="https://example.gov.cn/list.html",
        source_level=SourceLevel.A,
        source_type=SourceType.GOVERNMENT,
        publisher="Example Government",
        content_format=content_format,
        parser=parser,
        license_note="公开页面",
    )


class ParserTests(unittest.TestCase):
    def test_parse_html_table_into_observations(self):
        body = (FIXTURES / "official-list.html").read_bytes()

        observations = parse_document(document(body, "text/html"), spec(), date(2026, 7, 23))

        self.assertEqual(1, len(observations))
        self.assertEqual("合成博物馆", observations[0].name)
        self.assertEqual("示例市示例路1号", observations[0].address)
        self.assertEqual("AAAA", observations[0].grade)
        self.assertEqual("60", str(observations[0].price_value))
        self.assertEqual(PlaceKind.ATTRACTION, observations[0].kind)

    def test_parse_html_list_into_observations(self):
        body = """
        <main>
          <ul data-parser="html-list">
            <li><span class="name">合成餐厅</span><span class="address">示例市餐饮路2号</span><span class="price">80</span></li>
          </ul>
        </main>
        """.encode("utf-8")

        observations = parse_document(
            document(body, "text/html"),
            spec(parser="html-list"),
            date(2026, 7, 23),
        )

        self.assertEqual("合成餐厅", observations[0].name)
        self.assertEqual(PlaceKind.RESTAURANT, observations[0].kind)

    def test_parse_pdf_table_into_observations(self):
        body = (FIXTURES / "official-list.pdf").read_bytes()

        observations = parse_document(
            document(body, "application/pdf"),
            spec(parser="pdf-table", content_format="pdf"),
            date(2026, 7, 23),
        )

        self.assertEqual("合成博物馆", observations[0].name)
        self.assertEqual("示例市示例路1号", observations[0].address)

    def test_missing_required_name_or_address_fails(self):
        body = b"<table><tr><th>name</th><th>address</th></tr><tr><td></td><td>addr</td></tr></table>"

        with self.assertRaises(ValueError):
            parse_document(document(body, "text/html"), spec(), date(2026, 7, 23))

    def test_negative_price_fails(self):
        body = b"<table><tr><th>name</th><th>address</th><th>price</th></tr><tr><td>x</td><td>addr</td><td>-1</td></tr></table>"

        with self.assertRaises(ValueError):
            parse_document(document(body, "text/html"), spec(), date(2026, 7, 23))

    def test_empty_parse_result_fails(self):
        with self.assertRaises(ValueError):
            parse_document(document(b"<main>No records</main>", "text/html"), spec(), date(2026, 7, 23))

    def test_snapshot_contains_only_structured_observations(self):
        observations = parse_document(
            document((FIXTURES / "official-list.html").read_bytes(), "text/html"),
            spec(),
            date(2026, 7, 23),
        )
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "snapshot.json"
            write_snapshot(path, observations)
            payload = path.read_text(encoding="utf-8")

        data = json.loads(payload)
        self.assertTrue(payload.endswith("\n"))
        self.assertEqual("合成博物馆", data[0]["name"])
        self.assertNotIn("<html", payload)
        self.assertNotIn("首页 政务公开", payload)
        self.assertLessEqual(len(data[0]["notes"]), 300)


if __name__ == "__main__":
    unittest.main()
