"""
Flag generation, CO2 scoring, grading, and summary assembly.
"""

from collections import defaultdict
from urllib.parse import urlparse

from app.models.audit import (
    Flag,
    LighthouseScores,
    Page,
    Resources,
    SectionSummary,
    Summary,
    TopFlag,
)
from app.services.co2 import estimate_co2, grade

# Thresholds
_LARGE_PAGE_BYTES = 2_000_000   # 2 MB
_HIGH_REQUEST_COUNT = 80
_SLOW_LOAD_MS = 4_000


def generate_flags(
    transfer_size_bytes: int,
    request_count: int,
    load_time_ms: int,
    resources: Resources,
) -> list[Flag]:
    flags: list[Flag] = []

    for img in resources.images:
        if img.flagged and img.has_modern_alternative:
            flags.append(Flag(
                type="suboptimal_image_format",
                detail=f"{_basename(img.url)} is {img.format.upper()} — convert to WebP/AVIF",
                impact="high",
            ))

    for script in resources.scripts:
        if script.render_blocking:
            flags.append(Flag(
                type="render_blocking_script",
                detail=f"{_basename(script.url)} is render-blocking — add defer or async",
                impact="medium",
            ))

    for font in resources.fonts:
        if not font.url.lower().endswith(".woff2"):
            flags.append(Flag(
                type="unoptimized_font",
                detail=f"{_basename(font.url)} is not woff2 — convert for ~30% size reduction",
                impact="low",
            ))

    if transfer_size_bytes > _LARGE_PAGE_BYTES:
        mb = round(transfer_size_bytes / 1_000_000, 1)
        flags.append(Flag(
            type="oversized_page",
            detail=f"Total transfer {mb} MB exceeds 2 MB budget",
            impact="high",
        ))

    if request_count > _HIGH_REQUEST_COUNT:
        flags.append(Flag(
            type="high_request_count",
            detail=f"{request_count} requests — bundle or defer non-critical assets",
            impact="medium",
        ))

    if load_time_ms > _SLOW_LOAD_MS:
        flags.append(Flag(
            type="slow_load_time",
            detail=f"Load time {load_time_ms}ms exceeds 4s — audit blocking resources",
            impact="medium",
        ))

    return flags


def assemble_page(raw: dict, lh: LighthouseScores) -> Page:
    resources = Resources(**raw["resources"]) if isinstance(raw["resources"], dict) else raw["resources"]
    flags = generate_flags(
        transfer_size_bytes=raw["transfer_size_bytes"],
        request_count=raw["request_count"],
        load_time_ms=raw["load_time_ms"],
        resources=resources,
    )
    co2 = estimate_co2(raw["transfer_size_bytes"])
    section = _detect_section(raw["url"])

    return Page(
        url=raw["url"],
        section=section,
        load_time_ms=raw["load_time_ms"],
        transfer_size_bytes=raw["transfer_size_bytes"],
        request_count=raw["request_count"],
        resources=resources,
        lighthouse=lh,
        estimated_co2_grams=co2,
        flags=flags,
    )


def build_summary(pages: list[Page]) -> Summary:
    total_bytes = sum(p.transfer_size_bytes for p in pages)
    total_co2 = sum(p.estimated_co2_grams for p in pages)
    avg_co2 = total_co2 / len(pages) if pages else 0

    section_map: dict[str, dict] = defaultdict(lambda: {"co2": 0.0, "count": 0})
    flag_map: dict[str, dict] = defaultdict(lambda: {"occurrences": 0, "impact": "low"})

    for page in pages:
        section_map[page.section]["co2"] += page.estimated_co2_grams
        section_map[page.section]["count"] += 1
        for flag in page.flags:
            flag_map[flag.type]["occurrences"] += 1
            flag_map[flag.type]["impact"] = flag.impact

    sections_ranked = sorted(
        [
            SectionSummary(section=k, co2_grams=round(v["co2"], 4), page_count=v["count"])
            for k, v in section_map.items()
        ],
        key=lambda s: s.co2_grams,
        reverse=True,
    )

    top_flags = sorted(
        [
            TopFlag(type=k, occurrences=v["occurrences"], impact=v["impact"])
            for k, v in flag_map.items()
        ],
        key=lambda f: f.occurrences,
        reverse=True,
    )

    return Summary(
        total_pages_crawled=len(pages),
        total_transfer_bytes=total_bytes,
        total_estimated_co2_grams=round(total_co2, 4),
        sections_ranked=sections_ranked,
        top_flags=top_flags,
        grade=grade(avg_co2),
    )


def _detect_section(url: str) -> str:
    path = urlparse(url).path.strip("/")
    first = path.split("/")[0] if path else ""
    return first or "home"


def _basename(url: str) -> str:
    return url.split("/")[-1].split("?")[0] or url
