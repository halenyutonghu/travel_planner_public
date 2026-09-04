from __future__ import annotations

from decimal import Decimal

from light_trip_data.models import CityDataset, Observation, PlaceKind, QualityIssue, TransportSample


REQUIRED_ATTRACTION_COUNT = 30
REQUIRED_RESTAURANT_COUNT = 20
REQUIRED_HOTEL_COUNT = 12
REQUIRED_ATTRACTION_CATEGORIES = {
    "museum",
    "heritage",
    "park",
    "landmark",
    "shopping",
    "performance",
    "nightlife",
}
REQUIRED_HOTEL_GRADES = {"budget", "comfort", "premium", "luxury"}


def validate_city(dataset: CityDataset) -> tuple[QualityIssue, ...]:
    issues: list[QualityIssue] = []
    areas_by_id = {area.id: area for area in dataset.areas}
    observations = tuple(dataset.observations)

    if not 4 <= len(dataset.areas) <= 6:
        issues.append(_issue(dataset.city_id, "AREA_COUNT", f"旅游活动区域需要4到6个，实际{len(dataset.areas)}个", dataset.city_id))

    _check_quota(issues, dataset.city_id, observations, PlaceKind.ATTRACTION, REQUIRED_ATTRACTION_COUNT, "QUOTA_ATTRACTIONS")
    _check_quota(issues, dataset.city_id, observations, PlaceKind.RESTAURANT, REQUIRED_RESTAURANT_COUNT, "QUOTA_RESTAURANTS")
    _check_quota(issues, dataset.city_id, observations, PlaceKind.HOTEL, REQUIRED_HOTEL_COUNT, "QUOTA_HOTELS")
    _check_category_coverage(issues, dataset.city_id, observations)
    _check_hotel_grade_coverage(issues, dataset.city_id, observations)
    _check_observation_rules(issues, dataset.city_id, observations, areas_by_id)
    _check_transport_rules(issues, dataset)

    return tuple(sorted(issues, key=lambda item: (item.city_id, item.code, item.subject)))


def _check_quota(
    issues: list[QualityIssue],
    city_id: str,
    observations: tuple[Observation, ...],
    kind: PlaceKind,
    required: int,
    code: str,
) -> None:
    found = sum(1 for item in observations if item.kind == kind)
    if found != required:
        issues.append(_issue(city_id, code, f"{kind.value} 需要{required}条，实际{found}条", kind.value))


def _check_category_coverage(
    issues: list[QualityIssue], city_id: str, observations: tuple[Observation, ...]
) -> None:
    found = {
        tag
        for item in observations
        if item.kind == PlaceKind.ATTRACTION
        for tag in item.category_tags
    }
    missing = sorted(REQUIRED_ATTRACTION_CATEGORIES - found)
    if missing:
        issues.append(_issue(city_id, "CATEGORY_COVERAGE", f"景点类别缺少: {', '.join(missing)}", "attraction"))


def _check_hotel_grade_coverage(
    issues: list[QualityIssue], city_id: str, observations: tuple[Observation, ...]
) -> None:
    found = {item.grade for item in observations if item.kind == PlaceKind.HOTEL and item.grade}
    missing = sorted(REQUIRED_HOTEL_GRADES - found)
    if missing:
        issues.append(_issue(city_id, "HOTEL_GRADE_COVERAGE", f"酒店等级缺少: {', '.join(missing)}", "hotel"))


def _check_observation_rules(
    issues: list[QualityIssue],
    city_id: str,
    observations: tuple[Observation, ...],
    areas_by_id: dict[str, object],
) -> None:
    for item in observations:
        if item.area_id not in areas_by_id:
            issues.append(_issue(city_id, "MISSING_AREA", f"{item.name} 未映射到预置旅游活动区域", item.name))
        if item.status_text.strip().lower().startswith("rejected"):
            issues.append(_issue(city_id, "SOURCE_REJECTED", f"{item.name} 来源状态为拒绝", item.name))
        if item.price_value is None:
            issues.append(_issue(city_id, "MISSING_PRICE", f"{item.name} 缺少可导出的价格字段", item.name))
        if _negative(item.price_value) or _negative(item.duration_minutes):
            issues.append(_issue(city_id, "NEGATIVE_NUMBER", f"{item.name} 包含负数价格或时长", item.name))


def _check_transport_rules(issues: list[QualityIssue], dataset: CityDataset) -> None:
    area_ids = {area.id for area in dataset.areas}
    samples = tuple(dataset.transport_samples)
    pairs = {(item.from_area_id, item.to_area_id) for item in samples}

    for area_id in area_ids:
        if (area_id, area_id) not in pairs:
            issues.append(_issue(dataset.city_id, "MISSING_DEFAULT_TRANSPORT", f"{area_id} 缺少区内默认交通", area_id))

    for from_area in area_ids:
        for to_area in area_ids:
            if from_area == to_area:
                continue
            if (from_area, to_area) not in pairs:
                issues.append(_issue(dataset.city_id, "MISSING_DIRECTED_TRANSPORT", f"{from_area} 到 {to_area} 缺少有向交通", f"{from_area}->{to_area}"))

    for sample in samples:
        _check_transport_numbers(issues, dataset.city_id, sample)


def _check_transport_numbers(
    issues: list[QualityIssue], city_id: str, sample: TransportSample
) -> None:
    if (
        _negative(sample.distance_km_raw)
        or _negative(sample.duration_minutes_raw)
        or _negative(sample.price_raw)
    ):
        issues.append(
            _issue(
                city_id,
                "NEGATIVE_NUMBER",
                f"{sample.from_area_id} 到 {sample.to_area_id} 交通样本包含负数",
                f"{sample.from_area_id}->{sample.to_area_id}",
            )
        )


def _negative(value) -> bool:
    if value is None:
        return False
    return Decimal(str(value)) < 0


def _issue(city_id: str, code: str, message: str, subject: str) -> QualityIssue:
    return QualityIssue(
        city_id=city_id,
        severity="error",
        code=code,
        message=message,
        subject=subject,
    )
