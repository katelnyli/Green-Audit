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
_LARGE_PAGE_BYTES = 800_000     # 800 KB
_HIGH_REQUEST_COUNT = 30
_SLOW_LOAD_MS = 800


def generate_flags(
    transfer_size_bytes: int,
    request_count: int,
    load_time_ms: int,
    resources: Resources,
    has_compression: bool = True,
    cache_max_age: int = 86400,
    lazy_loadable_images: int = 0,
    inline_script_bytes: int = 0,
    third_party_domains: int = 0,
) -> list[Flag]:
    flags: list[Flag] = []

    # One flag per type per page — pick the worst offender for the detail message
    blocking_scripts = [s for s in resources.scripts if s.render_blocking]
    if blocking_scripts:
        worst = max(blocking_scripts, key=lambda s: s.size_bytes)
        count = len(blocking_scripts)
        detail = (
            f"{count} render-blocking scripts (e.g. {_basename(worst.url)}) — add defer or async"
            if count > 1
            else f"{_basename(worst.url)} is render-blocking — add defer or async"
        )
        flags.append(Flag(type="render_blocking_script", detail=detail, impact="medium"))

    non_modern_images = [img for img in resources.images if img.flagged and img.has_modern_alternative]
    if non_modern_images:
        worst = max(non_modern_images, key=lambda i: i.size_bytes)
        count = len(non_modern_images)
        detail = (
            f"{count} images in legacy formats (e.g. {_basename(worst.url)} is {worst.format.upper()}) — convert to WebP/AVIF"
            if count > 1
            else f"{_basename(worst.url)} is {worst.format.upper()} — convert to WebP/AVIF"
        )
        flags.append(Flag(type="suboptimal_image_format", detail=detail, impact="high"))

    non_woff2_fonts = [f for f in resources.fonts if not f.url.lower().endswith(".woff2")]
    if non_woff2_fonts:
        worst = max(non_woff2_fonts, key=lambda f: f.size_bytes)
        count = len(non_woff2_fonts)
        detail = (
            f"{count} fonts not in woff2 (e.g. {_basename(worst.url)}) — convert for ~30% size reduction"
            if count > 1
            else f"{_basename(worst.url)} is not woff2 — convert for ~30% size reduction"
        )
        flags.append(Flag(type="unoptimized_font", detail=detail, impact="low"))

    if transfer_size_bytes > _LARGE_PAGE_BYTES:
        kb = round(transfer_size_bytes / 1_000)
        flags.append(Flag(
            type="oversized_page",
            detail=f"Total transfer {kb} KB exceeds 800 KB budget",
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
            detail=f"Load time {load_time_ms}ms exceeds 2.5s — audit blocking resources",
            impact="medium",
        ))

    if not has_compression:
        flags.append(Flag(
            type="no_compression",
            detail="Response served without gzip/brotli — enable compression to reduce transfer size",
            impact="high",
        ))

    if cache_max_age < 3600:
        age = f"max-age={cache_max_age}" if cache_max_age > 0 else "no cache headers"
        flags.append(Flag(
            type="missing_cache_headers",
            detail=f"Page served with {age} — set long-lived Cache-Control for static assets",
            impact="medium",
        ))

    if lazy_loadable_images >= 3:
        flags.append(Flag(
            type="missing_lazy_loading",
            detail=f"{lazy_loadable_images} images lack loading=\"lazy\" — defer below-fold images",
            impact="medium",
        ))

    if inline_script_bytes > 30_000:
        kb = round(inline_script_bytes / 1000)
        flags.append(Flag(
            type="large_inline_script",
            detail=f"{kb}KB of inline JavaScript — extract to external file for caching",
            impact="medium",
        ))

    if third_party_domains >= 3:
        flags.append(Flag(
            type="third_party_heavy",
            detail=f"{third_party_domains} third-party script domains — each adds a DNS lookup and connection overhead",
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
        has_compression=raw.get("has_compression", True),
        cache_max_age=raw.get("cache_max_age", 86400),
        lazy_loadable_images=raw.get("lazy_loadable_images", 0),
        inline_script_bytes=raw.get("inline_script_bytes", 0),
        third_party_domains=raw.get("third_party_domains", 0),
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
