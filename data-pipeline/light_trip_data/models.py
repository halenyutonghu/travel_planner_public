from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import IntEnum, StrEnum
from typing import Any


class SourceLevel(IntEnum):
    A = 1
    B = 2
    C = 3
    D = 4


class PlaceKind(StrEnum):
    ATTRACTION = "attraction"
    RESTAURANT = "restaurant"
    HOTEL = "hotel"


class SourceType(StrEnum):
    GOVERNMENT = "government"
    OFFICIAL_PLACE = "official_place"
    PUBLIC_INSTITUTION = "public_institution"
    DISCOVERY = "discovery"


def _require_text(value: str | None, field_name: str) -> str:
    if value is None or not str(value).strip():
        raise ValueError(f"{field_name} must not be blank")
    return str(value).strip()


def _require_date(value: date | None, field_name: str) -> date:
    if value is None:
        raise ValueError(f"{field_name} is required")
    return value


def _check_optional_date(value: date | None, field_name: str) -> None:
    if value is not None and not isinstance(value, date):
        raise ValueError(f"{field_name} must be a date")


def _check_non_negative(value: int | float | Decimal | None, field_name: str) -> None:
    if value is not None and value < 0:
        raise ValueError(f"{field_name} must not be negative")


def _tuple_of_text(values: tuple[str, ...] | list[str], field_name: str) -> tuple[str, ...]:
    if values is None:
        return ()
    normalized = tuple(str(item).strip() for item in values if str(item).strip())
    if len(normalized) != len(values):
        raise ValueError(f"{field_name} must not contain blank values")
    return normalized


@dataclass(frozen=True)
class SourceSpec:
    url: str
    source_level: SourceLevel
    source_type: SourceType
    publisher: str
    source_id: str = ""
    city_id: str | None = None
    content_format: str = "html"
    parser: str = "html-table"
    allow_http: bool = False
    license_note: str = ""
    allowed_subdomains: tuple[str, ...] = field(default_factory=tuple)
    notes: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(self, "url", _require_text(self.url, "url"))
        object.__setattr__(self, "publisher", _require_text(self.publisher, "publisher"))
        if self.source_id:
            object.__setattr__(self, "source_id", _require_text(self.source_id, "source_id"))
        if self.city_id is not None:
            object.__setattr__(self, "city_id", _require_text(self.city_id, "city_id"))
        object.__setattr__(self, "content_format", _require_text(self.content_format, "content_format"))
        object.__setattr__(self, "parser", _require_text(self.parser, "parser"))
        object.__setattr__(
            self,
            "allowed_subdomains",
            _tuple_of_text(self.allowed_subdomains, "allowed_subdomains"),
        )


@dataclass(frozen=True)
class SourceRecord:
    url: str
    domain: str
    source_type: SourceType
    publisher: str
    title: str
    fetched_at: datetime
    http_status: int
    content_hash: str
    source_level: SourceLevel
    published_at: date | None = None
    license_note: str = ""
    notes: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(self, "url", _require_text(self.url, "url"))
        object.__setattr__(self, "domain", _require_text(self.domain, "domain"))
        object.__setattr__(self, "publisher", _require_text(self.publisher, "publisher"))
        object.__setattr__(self, "title", _require_text(self.title, "title"))
        object.__setattr__(self, "content_hash", _require_text(self.content_hash, "content_hash"))
        if self.fetched_at is None:
            raise ValueError("fetched_at is required")
        _check_non_negative(self.http_status, "http_status")
        _check_optional_date(self.published_at, "published_at")


@dataclass(frozen=True)
class Observation:
    city_id: str
    kind: PlaceKind
    name: str
    address: str
    source_url: str
    collected_at: date
    published_at: date | None = None
    area_id: str | None = None
    category_tags: tuple[str, ...] = field(default_factory=tuple)
    price_value: Decimal | None = None
    duration_minutes: int | None = None
    grade: str | None = None
    spending_tiers: tuple[str, ...] = field(default_factory=tuple)
    source_level: SourceLevel = SourceLevel.D
    status_text: str = ""
    notes: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(self, "city_id", _require_text(self.city_id, "city_id"))
        object.__setattr__(self, "name", _require_text(self.name, "name"))
        object.__setattr__(self, "source_url", _require_text(self.source_url, "source_url"))
        object.__setattr__(self, "collected_at", _require_date(self.collected_at, "collected_at"))
        _check_optional_date(self.published_at, "published_at")
        _check_non_negative(self.price_value, "price_value")
        _check_non_negative(self.duration_minutes, "duration_minutes")
        object.__setattr__(self, "category_tags", _tuple_of_text(self.category_tags, "category_tags"))
        object.__setattr__(self, "spending_tiers", _tuple_of_text(self.spending_tiers, "spending_tiers"))
        if self.area_id is not None:
            object.__setattr__(self, "area_id", _require_text(self.area_id, "area_id"))


@dataclass(frozen=True)
class Area:
    id: str
    city_id: str
    name: str
    description: str
    center_note: str
    fixed_rank: int
    status: str = "candidate"

    def __post_init__(self) -> None:
        object.__setattr__(self, "id", _require_text(self.id, "id"))
        object.__setattr__(self, "city_id", _require_text(self.city_id, "city_id"))
        object.__setattr__(self, "name", _require_text(self.name, "name"))
        object.__setattr__(self, "description", _require_text(self.description, "description"))
        object.__setattr__(self, "center_note", _require_text(self.center_note, "center_note"))
        _check_non_negative(self.fixed_rank, "fixed_rank")


@dataclass(frozen=True)
class TransportSample:
    city_id: str
    from_area_id: str
    to_area_id: str
    mode: str
    distance_km_raw: Decimal
    duration_minutes_raw: int
    price_raw: Decimal
    pricing: str
    source_url: str
    collected_at: date
    rounding_rule: str
    notes: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(self, "city_id", _require_text(self.city_id, "city_id"))
        object.__setattr__(self, "from_area_id", _require_text(self.from_area_id, "from_area_id"))
        object.__setattr__(self, "to_area_id", _require_text(self.to_area_id, "to_area_id"))
        object.__setattr__(self, "mode", _require_text(self.mode, "mode"))
        object.__setattr__(self, "pricing", _require_text(self.pricing, "pricing"))
        object.__setattr__(self, "source_url", _require_text(self.source_url, "source_url"))
        object.__setattr__(self, "rounding_rule", _require_text(self.rounding_rule, "rounding_rule"))
        object.__setattr__(self, "collected_at", _require_date(self.collected_at, "collected_at"))
        _check_non_negative(self.distance_km_raw, "distance_km_raw")
        _check_non_negative(self.duration_minutes_raw, "duration_minutes_raw")
        _check_non_negative(self.price_raw, "price_raw")


@dataclass(frozen=True)
class OriginTransport:
    city_id: str
    origin_name: str
    origin_aliases: tuple[str, ...]
    mode: str
    duration_minutes: int
    price_per_person: Decimal
    is_fallback: bool
    source_url: str
    collected_at: date

    def __post_init__(self) -> None:
        object.__setattr__(self, "city_id", _require_text(self.city_id, "city_id"))
        object.__setattr__(self, "origin_name", _require_text(self.origin_name, "origin_name"))
        object.__setattr__(self, "mode", _require_text(self.mode, "mode"))
        object.__setattr__(self, "source_url", _require_text(self.source_url, "source_url"))
        object.__setattr__(self, "origin_aliases", _tuple_of_text(self.origin_aliases, "origin_aliases"))
        object.__setattr__(self, "collected_at", _require_date(self.collected_at, "collected_at"))
        _check_non_negative(self.duration_minutes, "duration_minutes")
        _check_non_negative(self.price_per_person, "price_per_person")


@dataclass(frozen=True)
class CityDataset:
    city_id: str
    areas: tuple[Area, ...]
    observations: tuple[Observation, ...]
    transport_samples: tuple[TransportSample, ...]
    origin_transport: tuple[OriginTransport, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "city_id", _require_text(self.city_id, "city_id"))


@dataclass(frozen=True)
class ExportRun:
    started_at: datetime
    pipeline_version: str
    source_snapshot_hash: str
    status: str = "running"
    finished_at: datetime | None = None
    output_path: str = ""
    report_path: str = ""
    record_counts: dict[str, Any] = field(default_factory=dict)
    failure_summary: str = ""

    def __post_init__(self) -> None:
        if self.started_at is None:
            raise ValueError("started_at is required")
        object.__setattr__(self, "pipeline_version", _require_text(self.pipeline_version, "pipeline_version"))
        object.__setattr__(self, "source_snapshot_hash", _require_text(self.source_snapshot_hash, "source_snapshot_hash"))
        if self.status not in {"running", "failed", "passed"}:
            raise ValueError("status must be running, failed, or passed")
        if self.finished_at is not None and not isinstance(self.finished_at, datetime):
            raise ValueError("finished_at must be a datetime")


@dataclass(frozen=True)
class QualityIssue:
    city_id: str
    severity: str
    code: str
    message: str
    subject: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "city_id", _require_text(self.city_id, "city_id"))
        object.__setattr__(self, "severity", _require_text(self.severity, "severity"))
        object.__setattr__(self, "code", _require_text(self.code, "code"))
        object.__setattr__(self, "message", _require_text(self.message, "message"))
        object.__setattr__(self, "subject", _require_text(self.subject, "subject"))
