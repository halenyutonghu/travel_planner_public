import unittest
from datetime import datetime, timezone

from light_trip_data.models import ExportRun, QualityIssue
from light_trip_data.reports import UNVERIFIED_STATEMENT, render_report


class ReportTests(unittest.TestCase):
    def test_failed_report_contains_required_plain_chinese_fields(self):
        run = ExportRun(
            started_at=datetime(2026, 7, 23, tzinfo=timezone.utc),
            pipeline_version="0.1.0",
            source_snapshot_hash="snapshot-hash",
            status="failed",
        )
        issue = QualityIssue(
            city_id="beijing",
            severity="error",
            code="QUOTA_ATTRACTIONS",
            message="类别: attraction；记录: 合成景点；规则: 需要30，实际29；来源: https://example.gov.cn/source.html；处理: 不导出",
            subject="合成景点",
        )

        report = render_report(run, (issue,))

        self.assertIn("beijing", report)
        self.assertIn("QUOTA_ATTRACTIONS", report)
        self.assertIn("类别: attraction", report)
        self.assertIn("记录: 合成景点", report)
        self.assertIn("规则: 需要30，实际29", report)
        self.assertIn("来源: https://example.gov.cn/source.html", report)
        self.assertIn("处理: 不导出", report)
        self.assertIn(UNVERIFIED_STATEMENT, report)
        self.assertTrue(report.endswith("本次没有生成最终 JSON，网站原有数据未被修改。\n"))


if __name__ == "__main__":
    unittest.main()
