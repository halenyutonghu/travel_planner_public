from __future__ import annotations

from dataclasses import asdict
from datetime import date
from decimal import Decimal
import io
import json
import re
from pathlib import Path
from typing import Iterable

from bs4 import BeautifulSoup
from pypdf import PdfReader

from light_trip_data.collector import CollectedDocument
from light_trip_data.models import Observation, PlaceKind, SourceSpec


HEADING_ALIASES = {
    "name": {"名称", "name", "地点名称"},
    "address": {"地址", "address", "位置"},
    "grade": {"等级", "grade", "级别"},
    "price": {"价格", "票价", "price", "参考价"},
}


def parse_document(
    document: CollectedDocument, spec: SourceSpec, collected_at: date
) -> tuple[Observation, ...]:
    if spec.parser == "html-table":
        observations = _parse_html_table(document, spec, collected_at)
    elif spec.parser == "html-list":
        observations = _parse_html_list(document, spec, collected_at)
    elif spec.parser == "pdf-table":
        observations = _parse_pdf_table(document, spec, collected_at)
    else:
        raise ValueError(f"unsupported parser: {spec.parser}")

    if not observations:
        raise ValueError("document produced no observations")
    return tuple(observations)


def write_snapshot(path: str | Path, observations: Iterable[Observation]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = [_observation_dict(item) for item in sorted(observations, key=_sort_key)]
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _parse_html_table(
    document: CollectedDocument, spec: SourceSpec, collected_at: date
) -> list[Observation]:
    soup = BeautifulSoup(document.body, "html.parser")
    table = soup.find("table")
    if table is None:
        return []
    rows = table.find_all("tr")
    if not rows:
        return []
    headings = [_clean_text(cell.get_text(" ")) for cell in rows[0].find_all(["th", "td"])]
    indexes = _heading_indexes(headings)
    observations = []
    for row in rows[1:]:
        cells = [_clean_text(cell.get_text(" ")) for cell in row.find_all(["th", "td"])]
        if not any(cells):
            continue
        observations.append(_observation_from_mapping(_cells_to_mapping(cells, indexes), spec, collected_at, PlaceKind.ATTRACTION))
    return observations


def _parse_html_list(
    document: CollectedDocument, spec: SourceSpec, collected_at: date
) -> list[Observation]:
    soup = BeautifulSoup(document.body, "html.parser")
    root = soup.select_one('[data-parser="html-list"]') or soup
    observations = []
    for item in root.find_all("li"):
        mapping = {
            "name": _selector_text(item, ".name"),
            "address": _selector_text(item, ".address"),
            "price": _selector_text(item, ".price"),
            "grade": _selector_text(item, ".grade"),
        }
        observations.append(_observation_from_mapping(mapping, spec, collected_at, PlaceKind.RESTAURANT))
    return observations


def _parse_pdf_table(
    document: CollectedDocument, spec: SourceSpec, collected_at: date
) -> list[Observation]:
    reader = PdfReader(io.BytesIO(document.body))
    text_parts = [page.extract_text() or "" for page in reader.pages]
    if reader.metadata:
        text_parts.extend(str(value) for value in reader.metadata.values() if value)
    text = "\n".join(text_parts)
    rows = [
        [_clean_text(cell) for cell in line.split("|")]
        for line in text.splitlines()
        if "|" in line
    ]
    if len(rows) < 2:
        return []
    indexes = _heading_indexes(rows[0])
    return [
        _observation_from_mapping(_cells_to_mapping(cells, indexes), spec, collected_at, PlaceKind.ATTRACTION)
        for cells in rows[1:]
        if any(cells)
    ]


def _observation_from_mapping(
    mapping: dict[str, str],
    spec: SourceSpec,
    collected_at: date,
    kind: PlaceKind,
) -> Observation:
    name = mapping.get("name", "")
    address = mapping.get("address", "")
    price_text = mapping.get("price", "")
    price = Decimal(price_text) if price_text else None
    return Observation(
        city_id=spec.city_id or "",
        kind=kind,
        name=name,
        address=address,
        source_url=spec.url,
        collected_at=collected_at,
        grade=mapping.get("grade") or None,
        price_value=price,
        source_level=spec.source_level,
        notes=_notes(spec),
    )


def _heading_indexes(headings: list[str]) -> dict[str, int]:
    indexes: dict[str, int] = {}
    normalized = [_clean_text(heading).lower() for heading in headings]
    for field_name, aliases in HEADING_ALIASES.items():
        for index, heading in enumerate(normalized):
            if heading in {alias.lower() for alias in aliases}:
                indexes[field_name] = index
                break
    if "name" not in indexes or "address" not in indexes:
        raise ValueError("parser requires name and address columns")
    return indexes


def _cells_to_mapping(cells: list[str], indexes: dict[str, int]) -> dict[str, str]:
    return {
        field: cells[index] if index < len(cells) else ""
        for field, index in indexes.items()
    }


def _selector_text(root, selector: str) -> str:
    match = root.select_one(selector)
    return _clean_text(match.get_text(" ")) if match else ""


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _notes(spec: SourceSpec) -> str:
    text = f"{spec.publisher}；{spec.license_note}"
    return _clean_text(text)[:300]


def _sort_key(observation: Observation) -> tuple[str, str, str, str]:
    return (
        observation.city_id,
        observation.kind.value,
        observation.name,
        observation.address,
    )


def _observation_dict(observation: Observation) -> dict[str, object]:
    payload = asdict(observation)
    payload["kind"] = observation.kind.value
    payload["source_level"] = int(observation.source_level)
    payload["collected_at"] = observation.collected_at.isoformat()
    payload["published_at"] = (
        observation.published_at.isoformat() if observation.published_at else None
    )
    payload["price_value"] = (
        format(observation.price_value, "f") if observation.price_value is not None else None
    )
    payload["category_tags"] = list(observation.category_tags)
    payload["spending_tiers"] = list(observation.spending_tiers)
    return payload
