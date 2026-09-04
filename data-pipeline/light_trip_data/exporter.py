from __future__ import annotations

import json
import os
from pathlib import Path
import shutil

from light_trip_data.models import CityDataset, Observation, PlaceKind, TransportSample


CITY_PREFIXES = {
    "beijing": "bj",
    "shanghai": "sh",
    "guangzhou": "gz",
    "kunming": "km",
    "nanjing": "nj",
}
REQUIRED_COUNTS = {
    PlaceKind.ATTRACTION: 30,
    PlaceKind.RESTAURANT: 20,
    PlaceKind.HOTEL: 12,
}


def build_city_files(dataset: CityDataset) -> dict[str, object]:
    prefix = CITY_PREFIXES.get(dataset.city_id)
    if prefix is None:
        raise ValueError(f"unsupported city: {dataset.city_id}")

    area_rank = {area.id: area.fixed_rank for area in dataset.areas}
    attractions = _select(dataset.observations, PlaceKind.ATTRACTION, area_rank)
    restaurants = _select(dataset.observations, PlaceKind.RESTAURANT, area_rank)
    hotels = _select(dataset.observations, PlaceKind.HOTEL, area_rank)

    return {
        "areas.json": _area_rows(dataset),
        "attractions.json": [
            {
                "id": f"{prefix}-a{index:02d}",
                "name": item.name,
                "areaId": item.area_id,
                "categories": _frontend_attraction_categories(item.category_tags),
                "durationMinutes": item.duration_minutes,
                "ticketPerPerson": _number(item.price_value),
                "tiers": _frontend_attraction_tiers(item),
                "fixedRank": index,
            }
            for index, item in enumerate(attractions, start=1)
        ],
        "restaurants.json": [
            {
                "id": f"{prefix}-r{index:02d}",
                "name": item.name,
                "areaId": item.area_id,
                "cuisines": list(item.category_tags or item.spending_tiers),
                "costPerPerson": _number(item.price_value),
                "durationMinutes": item.duration_minutes,
                "fixedRank": index,
            }
            for index, item in enumerate(restaurants, start=1)
        ],
        "hotels.json": [
            {
                "id": f"{prefix}-h{index:02d}",
                "name": item.name,
                "areaId": item.area_id,
                "grade": _frontend_hotel_grade(item.grade),
                "pricePerRoomNight": _number(item.price_value),
                "fixedRank": index,
            }
            for index, item in enumerate(hotels, start=1)
        ],
        "travel-matrix.json": [_transport_row(item) for item in _directed_samples(dataset.transport_samples)],
    }


def write_candidate(output_root: str | Path, city_id: str, files: dict[str, object]) -> Path:
    output_root = Path(output_root)
    target = output_root / city_id
    temporary = output_root / f".{city_id}.tmp"
    if temporary.exists():
        shutil.rmtree(temporary)
    temporary.mkdir(parents=True)
    try:
        for name, payload in sorted(files.items()):
            _write_json(temporary / name, payload)
        if target.exists():
            shutil.rmtree(target)
        os.replace(temporary, target)
        return target
    except Exception:
        if temporary.exists():
            shutil.rmtree(temporary)
        raise


def _select(
    observations: tuple[Observation, ...],
    kind: PlaceKind,
    area_rank: dict[str, int],
) -> tuple[Observation, ...]:
    selected = tuple(
        sorted(
            (item for item in observations if item.kind == kind),
            key=lambda item: (
                area_rank.get(item.area_id or "", 999),
                item.name,
                item.address,
                item.source_url,
            ),
        )
    )
    required = REQUIRED_COUNTS[kind]
    if len(selected) < required:
        raise ValueError(f"{kind.value} requires {required} records, found {len(selected)}")
    return selected[:required]


def _area_rows(dataset: CityDataset) -> list[dict[str, object]]:
    defaults: dict[str, list[dict[str, object]]] = {}
    for sample in dataset.transport_samples:
        if sample.from_area_id == sample.to_area_id:
            defaults.setdefault(sample.from_area_id, []).append(_transport_without_areas(sample))
    return [
        {
            "id": area.id,
            "name": area.name,
            "defaultTransports": sorted(
                defaults.get(area.id, []),
                key=lambda item: (str(item["mode"]), item["durationMinutes"], item["price"]),
            ),
        }
        for area in sorted(dataset.areas, key=lambda item: (item.fixed_rank, item.id))
    ]


def _directed_samples(samples: tuple[TransportSample, ...]) -> list[TransportSample]:
    return sorted(
        (item for item in samples if item.from_area_id != item.to_area_id),
        key=lambda item: (item.from_area_id, item.to_area_id, item.mode),
    )


def _transport_row(sample: TransportSample) -> dict[str, object]:
    row = _transport_without_areas(sample)
    return {
        "fromAreaId": sample.from_area_id,
        "toAreaId": sample.to_area_id,
        **row,
    }


def _transport_without_areas(sample: TransportSample) -> dict[str, object]:
    return {
        "mode": sample.mode,
        "distanceKm": _number(sample.distance_km_raw),
        "durationMinutes": sample.duration_minutes_raw,
        "pricing": sample.pricing,
        "price": _number(sample.price_raw),
    }


def _frontend_attraction_categories(tags) -> list[str]:
    mapped = []
    for tag in tags:
        frontend_tags = {
            "heritage": ["history"],
            "park": ["nature"],
            "performance": ["family"],
            "nightlife": ["landmark", "food", "shopping"],
        }.get(tag, [tag])
        for frontend_tag in frontend_tags:
            if frontend_tag in {"nature", "history", "landmark", "museum", "food", "shopping", "family"}:
                mapped.append(frontend_tag)
    deduped = list(dict.fromkeys(mapped))
    return deduped or ["landmark"]


def _frontend_attraction_tiers(item: Observation) -> list[str]:
    tiers = [tier for tier in item.spending_tiers if tier in {"economy", "comfortable", "quality"}]
    if tiers:
        return list(dict.fromkeys(tiers))
    price = _number(item.price_value)
    if price <= 50:
        return ["economy", "comfortable"]
    if price <= 150:
        return ["comfortable", "quality"]
    return ["quality"]


def _frontend_hotel_grade(grade: str | None) -> str:
    return {
        "budget": "economy",
        "comfort": "three-star",
        "premium": "four-star",
        "luxury": "five-star",
    }.get(grade or "", "three-star")


def _write_json(path: Path, payload: object) -> None:
    with path.open("w", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=False))
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())


def _number(value) -> int | float:
    if value is None:
        return 0
    if hasattr(value, "to_integral_value") and value == value.to_integral_value():
        return int(value)
    return float(value)
