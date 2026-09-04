from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
import json
from pathlib import Path

from light_trip_data.collector import collect
from light_trip_data.config import load_manifest
from light_trip_data.database import (
    finish_export_run,
    migrate,
    open_database,
    start_export_run,
)
from light_trip_data.exporter import build_city_files, write_candidate
from light_trip_data.models import (
    Area,
    CityDataset,
    Observation,
    PlaceKind,
    SourceLevel,
    TransportSample,
)
from light_trip_data.quality import validate_city
from light_trip_data.reports import render_report, write_report_json


@dataclass(frozen=True)
class PipelinePaths:
    source_root: Path
    output_root: Path
    database_path: Path


def run_pipeline(
    stage: str,
    *,
    as_of: date,
    paths: PipelinePaths,
    collector=collect,
    city_id: str | None = None,
) -> int:
    if stage not in {"collect", "validate", "export", "all"}:
        return 2
    try:
        paths.output_root.mkdir(parents=True, exist_ok=True)
        with open_database(str(paths.database_path)) as connection:
            migrate(connection)
            run_id = start_export_run(connection, "0.1.0", _snapshot_hash(paths.source_root))
            if stage in {"collect", "all"}:
                _run_collect(paths, collector)
            if stage == "collect":
                _finish(connection, run_id, "passed", paths, {}, "")
                return 0

            datasets = load_datasets(paths.source_root, city_id=city_id)
            issues = tuple(issue for dataset in datasets for issue in validate_city(dataset))
            report_path = _write_reports(paths, connection, run_id, issues)
            if issues:
                finish_export_run(
                    connection,
                    run_id,
                    status="failed",
                    output_path="",
                    report_path=str(report_path),
                    record_counts=_record_counts(datasets),
                    failure_summary=f"{len(issues)} blocking issue(s)",
                )
                return 1

            if stage in {"export", "all"}:
                candidate_root = paths.output_root / "candidate"
                for dataset in datasets:
                    write_candidate(candidate_root, dataset.city_id, build_city_files(dataset))
            _finish(connection, run_id, "passed", paths, _record_counts(datasets), "")
            return 0
    except (OSError, ValueError, json.JSONDecodeError):
        return 2


def load_datasets(source_root: Path, city_id: str | None = None) -> tuple[CityDataset, ...]:
    areas_by_city = _load_areas(source_root / "areas.json")
    observation_dir = source_root / "observations"
    transport_dir = source_root / "transport"
    datasets = []
    city_ids = (city_id,) if city_id else tuple(sorted(areas_by_city))
    for current_city_id in city_ids:
        observation_path = observation_dir / f"{current_city_id}.json"
        datasets.append(
            CityDataset(
                city_id=current_city_id,
                areas=tuple(areas_by_city.get(current_city_id, ())),
                observations=_load_observations(observation_path)
                if observation_path.exists()
                else (),
                transport_samples=_load_transport_samples(transport_dir / f"{current_city_id}.json")
                if (transport_dir / f"{current_city_id}.json").exists()
                else (),
                origin_transport=(),
            )
        )
    if not datasets:
        raise ValueError("no city observation snapshots found")
    return tuple(datasets)


def _run_collect(paths: PipelinePaths, collector) -> None:
    manifest_path = paths.source_root / "manifest.json"
    if not manifest_path.exists():
        raise ValueError("manifest.json is missing")
    for spec in load_manifest(manifest_path):
        collector(spec)


def _write_reports(paths: PipelinePaths, connection, run_id: int, issues) -> Path:
    report_dir = paths.output_root / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    status = "failed" if issues else "passed"
    run = _report_run(connection, run_id, status)
    report_path = report_dir / "report.md"
    report_path.write_text(render_report(run, tuple(issues)), encoding="utf-8")
    write_report_json(report_dir / "report.json", tuple(issues))
    return report_path


def _finish(connection, run_id: int, status: str, paths: PipelinePaths, counts, summary: str) -> None:
    report_path = paths.output_root / "reports" / "report.md"
    if not report_path.exists():
        report_path.parent.mkdir(parents=True, exist_ok=True)
        run = _report_run(connection, run_id, status)
        report_path.write_text(render_report(run, ()), encoding="utf-8")
        write_report_json(report_path.parent / "report.json", ())
    finish_export_run(
        connection,
        run_id,
        status=status,
        output_path=str(paths.output_root / "candidate") if status == "passed" else "",
        report_path=str(report_path),
        record_counts=counts,
        failure_summary=summary,
    )


def _report_run(connection, run_id: int, status: str):
    from light_trip_data.models import ExportRun

    row = connection.execute("select * from export_runs where id = ?", (run_id,)).fetchone()
    return ExportRun(
        started_at=date.fromisoformat(row["started_at"][:10]),
        pipeline_version=row["pipeline_version"],
        source_snapshot_hash=row["source_snapshot_hash"],
        status=status,
    )


def _load_areas(path: Path) -> dict[str, tuple[Area, ...]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {
        city_id: tuple(
            Area(
                id=item["id"],
                city_id=item.get("cityId", city_id),
                name=item["name"],
                description=item["description"],
                center_note=item["centerNote"],
                fixed_rank=int(item["fixedRank"]),
                status=item.get("status", "candidate"),
            )
            for item in items
        )
        for city_id, items in raw.items()
    }


def _load_observations(path: Path) -> tuple[Observation, ...]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return tuple(
        Observation(
            city_id=item["cityId"],
            kind=PlaceKind(item["kind"]),
            name=item["name"],
            address=item["address"],
            source_url=item["sourceUrl"],
            collected_at=date.fromisoformat(item["collectedAt"]),
            published_at=date.fromisoformat(item["publishedAt"]) if item.get("publishedAt") else None,
            area_id=item.get("areaId"),
            category_tags=tuple(item.get("categoryTags", ())),
            price_value=Decimal(str(item["priceValue"])) if item.get("priceValue") is not None else None,
            duration_minutes=item.get("durationMinutes"),
            grade=item.get("grade"),
            spending_tiers=tuple(item.get("spendingTiers", ())),
            source_level=SourceLevel[item.get("sourceLevel", "D")],
            status_text=item.get("statusText", ""),
            notes=item.get("notes", ""),
        )
        for item in raw
    )


def _load_transport_samples(path: Path) -> tuple[TransportSample, ...]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return tuple(
        TransportSample(
            city_id=item["cityId"],
            from_area_id=item["fromAreaId"],
            to_area_id=item["toAreaId"],
            mode=item["mode"],
            distance_km_raw=Decimal(str(item["distanceKmRaw"])),
            duration_minutes_raw=int(item["durationMinutesRaw"]),
            price_raw=Decimal(str(item["priceRaw"])),
            pricing=item["pricing"],
            source_url=item["sourceUrl"],
            collected_at=date.fromisoformat(item["collectedAt"]),
            rounding_rule=item["roundingRule"],
            notes=item.get("notes", ""),
        )
        for item in raw.get("areaSamples", ())
    )


def _record_counts(datasets: tuple[CityDataset, ...]) -> dict[str, dict[str, int]]:
    return {
        dataset.city_id: {
            "areas": len(dataset.areas),
            "attractions": sum(1 for item in dataset.observations if item.kind == PlaceKind.ATTRACTION),
            "restaurants": sum(1 for item in dataset.observations if item.kind == PlaceKind.RESTAURANT),
            "hotels": sum(1 for item in dataset.observations if item.kind == PlaceKind.HOTEL),
            "transportSamples": len(dataset.transport_samples),
        }
        for dataset in datasets
    }


def _snapshot_hash(source_root: Path) -> str:
    parts = []
    for path in sorted(source_root.rglob("*.json")) if source_root.exists() else ():
        parts.append(f"{path.relative_to(source_root)}:{path.stat().st_size}")
    return "|".join(parts) or "empty"
