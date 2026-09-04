from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

from light_trip_data.models import SourceLevel, SourceSpec, SourceType


SUPPORTED_CITIES = {"beijing", "shanghai", "guangzhou", "kunming", "nanjing"}
SUPPORTED_FORMATS = {"html", "pdf"}
SUPPORTED_PARSERS = {"html-table", "html-list", "pdf-table"}


def load_manifest(path: str | Path) -> tuple[SourceSpec, ...]:
    raw_entries = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(raw_entries, list):
        raise ValueError("manifest must be a list")

    seen_ids: set[str] = set()
    seen_urls: set[str] = set()
    specs: list[SourceSpec] = []
    for entry in raw_entries:
        source_id = _required(entry, "id")
        url = _required(entry, "url")
        city_id = _required(entry, "cityId")
        level = SourceLevel[_required(entry, "level")]
        content_format = _required(entry, "format")
        parser = _required(entry, "parser")

        if source_id in seen_ids:
            raise ValueError(f"duplicate source id: {source_id}")
        if url in seen_urls:
            raise ValueError(f"duplicate source url: {url}")
        if city_id not in SUPPORTED_CITIES:
            raise ValueError(f"unsupported city: {city_id}")
        if level == SourceLevel.D:
            raise ValueError("D-level sources cannot be export sources")
        if content_format not in SUPPORTED_FORMATS:
            raise ValueError(f"unsupported format: {content_format}")
        if parser not in SUPPORTED_PARSERS:
            raise ValueError(f"unsupported parser: {parser}")
        if not urlparse(url).netloc:
            raise ValueError(f"source url is invalid: {url}")

        seen_ids.add(source_id)
        seen_urls.add(url)
        specs.append(
            SourceSpec(
                source_id=source_id,
                city_id=city_id,
                url=url,
                publisher=_required(entry, "publisher"),
                source_level=level,
                source_type=SourceType.GOVERNMENT
                if level == SourceLevel.A
                else SourceType.OFFICIAL_PLACE,
                content_format=content_format,
                parser=parser,
                allow_http=bool(entry.get("allowHttp", False)),
                license_note=_required(entry, "licenseNote"),
                allowed_subdomains=tuple(entry.get("allowedSubdomains", ())),
            )
        )
    return tuple(specs)


def _required(entry: dict[str, object], key: str) -> str:
    value = entry.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"manifest entry requires {key}")
    return value.strip()
