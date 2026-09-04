from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal
import json
import sqlite3
from typing import Iterator

from light_trip_data.models import (
    Area,
    ExportRun,
    Observation,
    OriginTransport,
    PlaceKind,
    SourceLevel,
    SourceRecord,
    TransportSample,
)


@contextmanager
def open_database(path: str) -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(path, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("pragma foreign_keys = on")
    try:
        yield connection
    finally:
        connection.close()


@contextmanager
def _transaction(connection: sqlite3.Connection) -> Iterator[None]:
    connection.execute("begin")
    try:
        yield
    except Exception:
        connection.execute("rollback")
        raise
    else:
        connection.execute("commit")


def migrate(connection: sqlite3.Connection) -> None:
    with _transaction(connection):
        connection.execute(
            """
            create table if not exists sources (
                id integer primary key,
                url text not null unique,
                domain text not null,
                source_type text not null,
                publisher text not null,
                title text not null,
                published_at text,
                fetched_at text not null,
                http_status integer not null check (http_status >= 0),
                content_hash text not null,
                license_note text not null default '',
                confidence_base integer not null check (confidence_base between 1 and 4),
                notes text not null default ''
            )
            """
        )
        connection.execute(
            """
            create table if not exists areas (
                id text primary key,
                city_id text not null,
                name text not null,
                description text not null,
                center_note text not null,
                fixed_rank integer not null check (fixed_rank >= 0),
                status text not null
            )
            """
        )
        connection.execute(
            """
            create table if not exists places (
                id integer primary key,
                city_id text not null,
                kind text not null check (kind in ('attraction', 'restaurant', 'hotel')),
                name text not null,
                normalized_name text not null,
                area_id text,
                address text not null,
                category_tags text not null,
                price_value text,
                duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
                grade text,
                spending_tiers text not null,
                fixed_rank integer check (fixed_rank is null or fixed_rank >= 0),
                confidence integer not null check (confidence between 1 and 4),
                status text not null,
                unverified integer not null check (unverified in (0, 1)),
                notes text not null,
                unique (city_id, kind, normalized_name, address),
                foreign key (area_id) references areas(id)
            )
            """
        )
        connection.execute(
            """
            create table if not exists place_sources (
                id integer primary key,
                place_id integer not null,
                source_id integer not null,
                field_name text not null,
                observed_value text not null,
                observed_at text not null,
                foreign key (place_id) references places(id) on delete cascade,
                foreign key (source_id) references sources(id) on delete restrict
            )
            """
        )
        connection.execute(
            """
            create table if not exists transport_samples (
                id integer primary key,
                city_id text not null,
                from_area_id text not null,
                to_area_id text not null,
                mode text not null,
                distance_km_raw text not null check (cast(distance_km_raw as real) >= 0),
                duration_minutes_raw integer not null check (duration_minutes_raw >= 0),
                price_raw text not null check (cast(price_raw as real) >= 0),
                pricing text not null,
                source_url text not null,
                collected_at text not null,
                rounding_rule text not null,
                notes text not null,
                foreign key (from_area_id) references areas(id),
                foreign key (to_area_id) references areas(id)
            )
            """
        )
        connection.execute(
            """
            create table if not exists origin_transport (
                id integer primary key,
                city_id text not null,
                origin_name text not null,
                origin_aliases text not null,
                mode text not null,
                duration_minutes integer not null check (duration_minutes >= 0),
                price_per_person text not null check (cast(price_per_person as real) >= 0),
                is_fallback integer not null check (is_fallback in (0, 1)),
                source_id integer not null,
                collected_at text not null,
                foreign key (source_id) references sources(id) on delete restrict
            )
            """
        )
        connection.execute(
            """
            create table if not exists export_runs (
                id integer primary key,
                started_at text not null,
                finished_at text,
                pipeline_version text not null,
                source_snapshot_hash text not null,
                status text not null check (status in ('running', 'failed', 'passed')),
                output_path text not null default '',
                report_path text not null default '',
                record_counts text not null default '{}',
                failure_summary text not null default ''
            )
            """
        )


def save_source(connection: sqlite3.Connection, source: SourceRecord) -> int:
    with _transaction(connection):
        connection.execute(
            """
            insert or ignore into sources (
                url, domain, source_type, publisher, title, published_at, fetched_at,
                http_status, content_hash, license_note, confidence_base, notes
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source.url,
                source.domain,
                source.source_type.value,
                source.publisher,
                source.title,
                _iso_date(source.published_at),
                source.fetched_at.isoformat(),
                source.http_status,
                source.content_hash,
                source.license_note,
                int(source.source_level),
                source.notes,
            ),
        )
        return _source_id(connection, source.url)


def save_area(connection: sqlite3.Connection, area: Area) -> str:
    with _transaction(connection):
        connection.execute(
            """
            insert into areas (id, city_id, name, description, center_note, fixed_rank, status)
            values (?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
                city_id = excluded.city_id,
                name = excluded.name,
                description = excluded.description,
                center_note = excluded.center_note,
                fixed_rank = excluded.fixed_rank,
                status = excluded.status
            """,
            (
                area.id,
                area.city_id,
                area.name,
                area.description,
                area.center_note,
                area.fixed_rank,
                area.status,
            ),
        )
    return area.id


def save_observation(connection: sqlite3.Connection, observation: Observation) -> int:
    source_id = _source_id(connection, observation.source_url)
    normalized_name = normalize_name(observation.name)
    status = _place_status(observation)
    unverified = 1 if status == "rejected" or observation.source_level in {SourceLevel.C, SourceLevel.D} else 0

    with _transaction(connection):
        connection.execute(
            """
            insert into places (
                city_id, kind, name, normalized_name, area_id, address, category_tags,
                price_value, duration_minutes, grade, spending_tiers, fixed_rank,
                confidence, status, unverified, notes
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(city_id, kind, normalized_name, address) do update set
                name = excluded.name,
                area_id = coalesce(excluded.area_id, places.area_id),
                category_tags = excluded.category_tags,
                price_value = coalesce(excluded.price_value, places.price_value),
                duration_minutes = coalesce(excluded.duration_minutes, places.duration_minutes),
                grade = coalesce(excluded.grade, places.grade),
                spending_tiers = excluded.spending_tiers,
                confidence = min(places.confidence, excluded.confidence),
                status = case when places.status = 'rejected' or excluded.status = 'rejected'
                    then 'rejected' else excluded.status end,
                unverified = max(places.unverified, excluded.unverified),
                notes = excluded.notes
            """,
            (
                observation.city_id,
                observation.kind.value,
                observation.name,
                normalized_name,
                observation.area_id,
                observation.address,
                _json_tuple(observation.category_tags),
                _decimal_text(observation.price_value),
                observation.duration_minutes,
                observation.grade,
                _json_tuple(observation.spending_tiers),
                None,
                int(observation.source_level),
                status,
                unverified,
                observation.notes,
            ),
        )
        place_id = _place_id(connection, observation.city_id, observation.kind, normalized_name, observation.address)
        for field_name, observed_value in _observation_evidence(observation):
            connection.execute(
                """
                insert into place_sources (place_id, source_id, field_name, observed_value, observed_at)
                values (?, ?, ?, ?, ?)
                """,
                (place_id, source_id, field_name, observed_value, observation.collected_at.isoformat()),
            )
        return place_id


def save_transport_sample(connection: sqlite3.Connection, sample: TransportSample) -> int:
    with _transaction(connection):
        cursor = connection.execute(
            """
            insert into transport_samples (
                city_id, from_area_id, to_area_id, mode, distance_km_raw,
                duration_minutes_raw, price_raw, pricing, source_url, collected_at,
                rounding_rule, notes
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sample.city_id,
                sample.from_area_id,
                sample.to_area_id,
                sample.mode,
                _decimal_text(sample.distance_km_raw),
                sample.duration_minutes_raw,
                _decimal_text(sample.price_raw),
                sample.pricing,
                sample.source_url,
                sample.collected_at.isoformat(),
                sample.rounding_rule,
                sample.notes,
            ),
        )
        return int(cursor.lastrowid)


def save_origin_transport(connection: sqlite3.Connection, origin: OriginTransport) -> int:
    source_id = _source_id(connection, origin.source_url)
    with _transaction(connection):
        cursor = connection.execute(
            """
            insert into origin_transport (
                city_id, origin_name, origin_aliases, mode, duration_minutes,
                price_per_person, is_fallback, source_id, collected_at
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                origin.city_id,
                origin.origin_name,
                _json_tuple(origin.origin_aliases),
                origin.mode,
                origin.duration_minutes,
                _decimal_text(origin.price_per_person),
                1 if origin.is_fallback else 0,
                source_id,
                origin.collected_at.isoformat(),
            ),
        )
        return int(cursor.lastrowid)


def start_export_run(
    connection: sqlite3.Connection, pipeline_version: str, source_snapshot_hash: str
) -> int:
    run = ExportRun(
        started_at=datetime.now(timezone.utc),
        pipeline_version=pipeline_version,
        source_snapshot_hash=source_snapshot_hash,
    )
    with _transaction(connection):
        cursor = connection.execute(
            """
            insert into export_runs (
                started_at, pipeline_version, source_snapshot_hash, status,
                record_counts
            )
            values (?, ?, ?, ?, ?)
            """,
            (
                run.started_at.isoformat(),
                run.pipeline_version,
                run.source_snapshot_hash,
                run.status,
                json.dumps(run.record_counts, ensure_ascii=False, sort_keys=True),
            ),
        )
        return int(cursor.lastrowid)


def finish_export_run(
    connection: sqlite3.Connection,
    run_id: int,
    *,
    status: str,
    output_path: str,
    report_path: str,
    record_counts: dict[str, object],
    failure_summary: str,
) -> None:
    if status not in {"failed", "passed"}:
        raise ValueError("status must be failed or passed")
    with _transaction(connection):
        cursor = connection.execute(
            """
            update export_runs
            set finished_at = ?, status = ?, output_path = ?, report_path = ?,
                record_counts = ?, failure_summary = ?
            where id = ?
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                status,
                output_path,
                report_path,
                json.dumps(record_counts, ensure_ascii=False, sort_keys=True),
                failure_summary,
                run_id,
            ),
        )
        if cursor.rowcount != 1:
            raise ValueError(f"export run {run_id} does not exist")


def normalize_name(name: str) -> str:
    return (
        name.strip()
        .lower()
        .replace("（", "(")
        .replace("）", ")")
        .replace(" ", "")
        .replace("\u3000", "")
    )


def _source_id(connection: sqlite3.Connection, url: str) -> int:
    row = connection.execute("select id from sources where url = ?", (url,)).fetchone()
    if row is None:
        raise ValueError(f"source must be saved before related records: {url}")
    return int(row["id"])


def _place_id(
    connection: sqlite3.Connection,
    city_id: str,
    kind: PlaceKind,
    normalized_name: str,
    address: str,
) -> int:
    row = connection.execute(
        """
        select id from places
        where city_id = ? and kind = ? and normalized_name = ? and address = ?
        """,
        (city_id, kind.value, normalized_name, address),
    ).fetchone()
    if row is None:
        raise RuntimeError("place upsert did not create a row")
    return int(row["id"])


def _place_status(observation: Observation) -> str:
    if observation.status_text.strip().lower().startswith("rejected"):
        return "rejected"
    return "candidate"


def _observation_evidence(observation: Observation) -> list[tuple[str, str]]:
    values = {
        "name": observation.name,
        "address": observation.address,
        "area_id": observation.area_id,
        "category_tags": _json_tuple(observation.category_tags),
        "price_value": _decimal_text(observation.price_value),
        "duration_minutes": str(observation.duration_minutes)
        if observation.duration_minutes is not None
        else None,
        "grade": observation.grade,
        "spending_tiers": _json_tuple(observation.spending_tiers),
        "source_level": str(int(observation.source_level)),
        "status_text": observation.status_text,
        "notes": observation.notes,
    }
    return [(field, value) for field, value in values.items() if value not in {None, "", "[]"}]


def _json_tuple(values: tuple[str, ...]) -> str:
    return json.dumps(list(values), ensure_ascii=False, sort_keys=True)


def _decimal_text(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value, "f")


def _iso_date(value) -> str | None:
    if value is None:
        return None
    return value.isoformat()
