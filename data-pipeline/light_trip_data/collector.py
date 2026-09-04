from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from light_trip_data.models import SourceSpec


MAX_BYTES = 10 * 1024 * 1024
TIMEOUT_SECONDS = 20
TRANSIENT_STATUSES = {429, 500, 502, 503, 504}
ACCEPTED_MEDIA_TYPES = {"text/html", "application/xhtml+xml", "application/pdf"}
USER_AGENT = "LightTripAcademicDemo/1.0 (+one-time public data collection)"


@dataclass(frozen=True)
class CollectedDocument:
    url: str
    http_status: int
    media_type: str
    body: bytes
    fetched_at: datetime
    content_hash: str


class CollectionError(RuntimeError):
    pass


def collect(spec: SourceSpec, opener=urlopen, sleep=time.sleep) -> CollectedDocument:
    parsed = urlparse(spec.url)
    if parsed.scheme == "http" and not spec.allow_http:
        raise CollectionError("http source requires allow_http")
    if parsed.scheme not in {"https", "http"}:
        raise CollectionError(f"unsupported URL scheme: {parsed.scheme}")
    if not parsed.hostname:
        raise CollectionError("source URL must include a host")

    last_error: Exception | None = None
    for attempt in range(1, 4):
        if attempt > 1:
            sleep(1)
        try:
            response = _open(spec.url, opener)
            with response:
                status = int(getattr(response, "status", 200))
                if status in {401, 403}:
                    raise CollectionError(f"access denied with HTTP {status}")
                if status in TRANSIENT_STATUSES:
                    if attempt == 3:
                        raise CollectionError(f"transient HTTP {status} after 3 attempts")
                    continue
                if status >= 400:
                    raise CollectionError(f"HTTP {status}")

                final_url = response.geturl()
                _validate_final_host(spec, final_url)
                media_type = _media_type(response.headers.get("Content-Type", ""))
                if media_type not in ACCEPTED_MEDIA_TYPES:
                    raise CollectionError(f"unsupported media type: {media_type}")
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) > MAX_BYTES:
                    raise CollectionError("response exceeds 10 MiB limit")

                body = response.read(MAX_BYTES + 1)
                if len(body) > MAX_BYTES:
                    raise CollectionError("response exceeds 10 MiB limit")
                if _looks_like_captcha(body):
                    raise CollectionError("CAPTCHA or verification page detected")

                return CollectedDocument(
                    url=final_url,
                    http_status=status,
                    media_type=media_type,
                    body=body,
                    fetched_at=datetime.now(timezone.utc),
                    content_hash=hashlib.sha256(body).hexdigest(),
                )
        except HTTPError as error:
            last_error = error
            if error.code in {401, 403}:
                raise CollectionError(f"access denied with HTTP {error.code}") from error
            if error.code in TRANSIENT_STATUSES and attempt < 3:
                continue
            raise CollectionError(f"HTTP {error.code}") from error
        except URLError as error:
            last_error = error
            if attempt < 3:
                continue
            raise CollectionError("network error after 3 attempts") from error

    raise CollectionError("collection failed") from last_error


def _open(url: str, opener):
    request = Request(url, headers={"User-Agent": USER_AGENT})
    return opener(request, timeout=TIMEOUT_SECONDS)


def _validate_final_host(spec: SourceSpec, final_url: str) -> None:
    original_host = urlparse(spec.url).hostname
    final_host = urlparse(final_url).hostname
    if not original_host or not final_host:
        raise CollectionError("final URL must include a host")
    allowed_hosts = {original_host, *spec.allowed_subdomains}
    if final_host not in allowed_hosts:
        raise CollectionError(f"final host is not allow-listed: {final_host}")


def _media_type(value: str) -> str:
    return value.split(";", 1)[0].strip().lower()


def _looks_like_captcha(body: bytes) -> bool:
    lower = body[:8192].lower()
    return b"captcha" in lower or "验证码".encode("utf-8") in lower
