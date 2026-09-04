from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from difflib import SequenceMatcher
import re
import unicodedata
from urllib.parse import urlparse

from light_trip_data.models import Observation, PlaceKind, QualityIssue, SourceLevel


ADDRESS_SIMILARITY_THRESHOLD = Decimal("0.92")


@dataclass(frozen=True)
class EvidenceResult:
    identity_pass: bool
    price_pass: bool
    confidence: SourceLevel
    issues: tuple[QualityIssue, ...]


def normalize_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    normalized = normalized.replace("（", "(").replace("）", ")")
    return re.sub(r"\s+", "", normalized).strip()


def normalize_address(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    normalized = normalized.replace("（", "(").replace("）", ")")
    return re.sub(r"\s+", "", normalized).strip()


def round_value(value: Decimal, rule: str) -> Decimal:
    increments = {
        "duration_10": Decimal("10"),
        "transit_5": Decimal("5"),
        "distance_0_5": Decimal("0.5"),
        "ticket_1": Decimal("1"),
        "restaurant_10": Decimal("10"),
        "hotel_20": Decimal("20"),
        "hotel_50": Decimal("50"),
    }
    if rule not in increments:
        raise ValueError(f"unknown rounding rule: {rule}")
    increment = increments[rule]
    return (value / increment).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * increment


def deduplicate(
    observations: list[Observation] | tuple[Observation, ...]
) -> tuple[tuple[Observation, ...], tuple[QualityIssue, ...]]:
    unique: list[Observation] = []
    issues: list[QualityIssue] = []
    for candidate in sorted(observations, key=_observation_sort_key):
        match = _find_duplicate(unique, candidate)
        if match == "merge":
            continue
        if match == "conflict":
            issues.append(_issue(candidate, "DEDUP_CONFLICT", "同名地点存在城市或地址冲突"))
            continue
        if match == "ambiguous":
            issues.append(_issue(candidate, "DEDUP_AMBIGUOUS", "同名地点无法自动判断是否为同一地点"))
            continue
        unique.append(candidate)
    return tuple(unique), tuple(sorted(issues, key=_issue_sort_key))


def evaluate_evidence(
    observations: list[Observation] | tuple[Observation, ...], *, as_of: date
) -> EvidenceResult:
    if not observations:
        issue = QualityIssue(
            city_id="unknown",
            severity="error",
            code="IDENTITY_EVIDENCE_MISSING",
            message="没有可用来源支持地点身份",
            subject="evidence",
        )
        return EvidenceResult(False, False, SourceLevel.D, (issue,))

    sorted_observations = tuple(sorted(observations, key=_observation_sort_key))
    best_confidence = min((item.source_level for item in sorted_observations), default=SourceLevel.D)
    identity_pass = _identity_passes(sorted_observations, as_of)
    price_pass = _price_passes(sorted_observations, as_of)
    issues: list[QualityIssue] = []
    subject = sorted_observations[0].name
    city_id = sorted_observations[0].city_id
    if not identity_pass:
        issues.append(
            QualityIssue(
                city_id=city_id,
                severity="error",
                code="IDENTITY_EVIDENCE_MISSING",
                message="缺少符合等级和时效要求的身份来源",
                subject=subject,
            )
        )
    if not price_pass and any(item.price_value is not None for item in sorted_observations):
        issues.append(
            QualityIssue(
                city_id=city_id,
                severity="error",
                code="PRICE_EVIDENCE_MISSING",
                message="缺少符合时效要求的价格来源",
                subject=subject,
            )
        )
    return EvidenceResult(identity_pass, price_pass, best_confidence, tuple(issues))


def _find_duplicate(unique: list[Observation], candidate: Observation) -> str | None:
    candidate_name = normalize_name(candidate.name)
    candidate_address = normalize_address(candidate.address)
    for existing in unique:
        if normalize_name(existing.name) != candidate_name:
            continue
        if existing.kind != candidate.kind:
            continue
        existing_address = normalize_address(existing.address)
        if existing.city_id != candidate.city_id:
            return "conflict"
        if existing_address == candidate_address:
            return "merge"
        if existing.area_id and existing.area_id == candidate.area_id:
            similarity = Decimal(str(SequenceMatcher(None, existing_address, candidate_address).ratio()))
            if similarity >= ADDRESS_SIMILARITY_THRESHOLD:
                return "merge"
        return "ambiguous"
    return None


def _identity_passes(observations: tuple[Observation, ...], as_of: date) -> bool:
    identity_sources = [
        item
        for item in observations
        if item.source_level in {SourceLevel.A, SourceLevel.B, SourceLevel.C}
        and _identity_fresh(item, as_of)
    ]
    if any(item.source_level == SourceLevel.A for item in identity_sources):
        return True
    b_sources = [item for item in identity_sources if item.source_level == SourceLevel.B]
    if not b_sources:
        return False
    b_domains = {_domain(item.source_url) for item in b_sources}
    support_domains = {
        _domain(item.source_url)
        for item in identity_sources
        if item.source_level in {SourceLevel.A, SourceLevel.B, SourceLevel.C}
    }
    return any(support_domains - {domain} for domain in b_domains)


def _price_passes(observations: tuple[Observation, ...], as_of: date) -> bool:
    priced = [item for item in observations if item.price_value is not None and _price_fresh(item, as_of)]
    if not priced:
        return False
    kind = priced[0].kind
    if kind == PlaceKind.ATTRACTION:
        return any(item.source_level in {SourceLevel.A, SourceLevel.B} for item in priced)
    if any(item.source_level == SourceLevel.B for item in priced):
        return True
    eligible_domains = {
        _domain(item.source_url)
        for item in priced
        if item.source_level in {SourceLevel.A, SourceLevel.B, SourceLevel.C}
    }
    return len(eligible_domains) >= 2


def _identity_fresh(observation: Observation, as_of: date) -> bool:
    if observation.published_at is None:
        return True
    limit_days = 730 if observation.kind == PlaceKind.ATTRACTION else 365
    return 0 <= (as_of - observation.published_at).days <= limit_days


def _price_fresh(observation: Observation, as_of: date) -> bool:
    if observation.published_at is None:
        return False
    return 0 <= (as_of - observation.published_at).days <= 183


def _domain(url: str) -> str:
    return urlparse(url).hostname or url


def _observation_sort_key(observation: Observation) -> tuple[str, str, str, str, str]:
    return (
        observation.city_id,
        observation.kind.value,
        normalize_name(observation.name),
        normalize_address(observation.address),
        observation.source_url,
    )


def _issue(observation: Observation, code: str, message: str) -> QualityIssue:
    return QualityIssue(
        city_id=observation.city_id,
        severity="error",
        code=code,
        message=message,
        subject=observation.name,
    )


def _issue_sort_key(issue: QualityIssue) -> tuple[int, str, str]:
    priority = {"DEDUP_CONFLICT": 0, "DEDUP_AMBIGUOUS": 1}
    return (priority.get(issue.code, 99), issue.city_id, issue.subject)
