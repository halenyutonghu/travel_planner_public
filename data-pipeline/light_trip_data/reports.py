from __future__ import annotations

import json
from pathlib import Path

from light_trip_data.models import ExportRun, QualityIssue


UNVERIFIED_STATEMENT = (
    "根据公开网页自动整理、未经人工核验的静态参考数据。价格、营业状态、开放时间和交通信息可能变化，实际出行前请通过官方渠道核实。"
)


def render_report(run: ExportRun, issues: tuple[QualityIssue, ...]) -> str:
    lines = [
        "# 公开数据整理报告",
        "",
        f"- 状态: {run.status}",
        f"- 管道版本: {run.pipeline_version}",
        f"- 来源快照: {run.source_snapshot_hash}",
        f"- 声明: {UNVERIFIED_STATEMENT}",
        "",
        "## 自动检查结果",
        "",
    ]
    if not issues:
        lines.append("未发现阻止导出的自动检查问题。")
    else:
        for issue in sorted(issues, key=lambda item: (item.city_id, item.code, item.subject)):
            lines.extend(
                [
                    f"### {issue.city_id} / {issue.code}",
                    "",
                    f"- 严重程度: {issue.severity}",
                    f"- 记录: {issue.subject}",
                    f"- 说明: {issue.message}",
                    "",
                ]
            )
    if run.status == "failed" or issues:
        lines.append("本次没有生成最终 JSON，网站原有数据未被修改。")
    return "\n".join(lines) + "\n"


def write_report_json(path: str | Path, issues: tuple[QualityIssue, ...]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = [
        {
            "cityId": issue.city_id,
            "severity": issue.severity,
            "code": issue.code,
            "subject": issue.subject,
            "message": issue.message,
        }
        for issue in sorted(issues, key=lambda item: (item.city_id, item.code, item.subject))
    ]
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
