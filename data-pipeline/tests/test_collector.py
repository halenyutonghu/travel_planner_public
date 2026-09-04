import json
import tempfile
import unittest
from pathlib import Path

from light_trip_data.collector import CollectionError, collect
from light_trip_data.config import load_manifest
from light_trip_data.models import SourceLevel, SourceSpec, SourceType


class FakeResponse:
    def __init__(
        self,
        *,
        status=200,
        body=b"<html><body>official list</body></html>",
        media_type="text/html; charset=utf-8",
        url="https://example.gov.cn/list.html",
    ):
        self.status = status
        self._body = body
        self.headers = {"Content-Type": media_type, "Content-Length": str(len(body))}
        self._url = url

    def read(self, size=-1):
        return self._body if size == -1 else self._body[:size]

    def geturl(self):
        return self._url

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


class FakeOpener:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def __call__(self, request, timeout):
        self.requests.append((request, timeout))
        if not self.responses:
            raise AssertionError("fake opener exhausted")
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


class FakeSleep:
    def __init__(self):
        self.calls = []

    def __call__(self, seconds):
        self.calls.append(seconds)


def spec(**overrides):
    values = {
        "source_id": "example-source",
        "city_id": "beijing",
        "url": "https://example.gov.cn/list.html",
        "source_level": SourceLevel.A,
        "source_type": SourceType.GOVERNMENT,
        "publisher": "Example Government",
        "content_format": "html",
        "parser": "html-table",
        "license_note": "公开页面，仅保存结构化事实和来源信息",
    }
    values.update(overrides)
    return SourceSpec(**values)


class CollectorTests(unittest.TestCase):
    def test_manifest_loads_valid_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "manifest.json"
            path.write_text(
                json.dumps(
                    [
                        {
                            "id": "bj-government-attractions",
                            "cityId": "beijing",
                            "url": "https://data.beijing.gov.cn/zyml/ajg/slyw/19605.htm",
                            "publisher": "北京市公共数据开放平台",
                            "level": "A",
                            "format": "html",
                            "parser": "html-table",
                            "allowHttp": False,
                            "licenseNote": "公开页面，仅保存结构化事实和来源信息",
                        }
                    ],
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            loaded = load_manifest(path)

        self.assertEqual("bj-government-attractions", loaded[0].source_id)
        self.assertEqual(SourceLevel.A, loaded[0].source_level)

    def test_manifest_rejects_duplicate_ids_and_d_level_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "manifest.json"
            path.write_text(
                json.dumps(
                    [
                        {
                            "id": "duplicate",
                            "cityId": "beijing",
                            "url": "https://example.gov.cn/one.html",
                            "publisher": "Example Government",
                            "level": "A",
                            "format": "html",
                            "parser": "html-table",
                            "allowHttp": False,
                            "licenseNote": "公开页面",
                        },
                        {
                            "id": "duplicate",
                            "cityId": "beijing",
                            "url": "https://example.gov.cn/two.html",
                            "publisher": "Example Government",
                            "level": "D",
                            "format": "html",
                            "parser": "html-table",
                            "allowHttp": False,
                            "licenseNote": "公开页面",
                        },
                    ],
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            with self.assertRaises(ValueError):
                load_manifest(path)

    def test_collect_accepts_html_and_pdf_without_writing_response_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            opener = FakeOpener(
                [
                    FakeResponse(body=b"<html>ok</html>", media_type="text/html"),
                    FakeResponse(body=b"%PDF-1.4", media_type="application/pdf"),
                ]
            )
            sleep = FakeSleep()

            html = collect(spec(), opener=opener, sleep=sleep)
            pdf = collect(spec(content_format="pdf"), opener=opener, sleep=sleep)

            self.assertEqual("text/html", html.media_type)
            self.assertEqual("application/pdf", pdf.media_type)
            self.assertEqual([], list(Path(tmp).iterdir()))

    def test_collect_rejects_redirect_to_undeclared_host(self):
        opener = FakeOpener([FakeResponse(url="https://evil.example/list.html")])

        with self.assertRaises(CollectionError):
            collect(spec(), opener=opener, sleep=FakeSleep())

    def test_collect_accepts_declared_subdomain_redirect(self):
        opener = FakeOpener(
            [FakeResponse(url="https://open.example.gov.cn/list.html")]
        )

        document = collect(
            spec(allowed_subdomains=("open.example.gov.cn",)),
            opener=opener,
            sleep=FakeSleep(),
        )

        self.assertEqual("https://open.example.gov.cn/list.html", document.url)

    def test_collect_rejects_http_unless_manifest_allows_it(self):
        with self.assertRaises(CollectionError):
            collect(spec(url="http://example.gov.cn/list.html"), opener=FakeOpener([]), sleep=FakeSleep())

        document = collect(
            spec(url="http://example.gov.cn/list.html", allow_http=True),
            opener=FakeOpener([FakeResponse(url="http://example.gov.cn/list.html")]),
            sleep=FakeSleep(),
        )
        self.assertEqual(200, document.http_status)

    def test_collect_retries_transient_statuses_three_total_attempts(self):
        opener = FakeOpener(
            [
                FakeResponse(status=429),
                FakeResponse(status=500),
                FakeResponse(body=b"<html>ok</html>"),
            ]
        )
        sleep = FakeSleep()

        document = collect(spec(), opener=opener, sleep=sleep)

        self.assertEqual(200, document.http_status)
        self.assertEqual(3, len(opener.requests))
        self.assertEqual([1, 1], sleep.calls)

    def test_collect_fails_immediately_for_forbidden_captcha_media_and_size(self):
        immediate_cases = [
            FakeResponse(status=401),
            FakeResponse(status=403),
            FakeResponse(body=b"<html>captcha required</html>"),
            FakeResponse(media_type="image/png", body=b"not allowed"),
            FakeResponse(
                body=b"",
                media_type="text/html",
                url="https://example.gov.cn/list.html",
            ),
        ]
        immediate_cases[-1].headers["Content-Length"] = str(10 * 1024 * 1024 + 1)

        for response in immediate_cases:
            opener = FakeOpener([response])
            with self.subTest(status=response.status, media_type=response.headers["Content-Type"]):
                with self.assertRaises(CollectionError):
                    collect(spec(), opener=opener, sleep=FakeSleep())
                self.assertEqual(1, len(opener.requests))


if __name__ == "__main__":
    unittest.main()
