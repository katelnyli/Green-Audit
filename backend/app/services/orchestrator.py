"""
Orchestrates: crawler output → Lighthouse → CO2 → summary → AuditResult
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Callable

from app.models.audit import (
    AuditResult,
    Flag,
    Page,
    SectionSummary,
    Summary,
    TopFlag,
)
from app.services import co2 as co2_service
from app.services import lighthouse as lh_service
from app.services.section_detector import detect_section
from app.crawler.client import crawl


async def run_full_audit(
    audit_id: str,
    url: str,
    credentials: dict | None,
    on_progress: Callable[[int, int, str], None],
) -> AuditResult:
    raw_pages = await crawl(url, credentials)

    pages: list[Page] = []
    for i, raw in enumerate(raw_pages):
        on_progress(i + 1, len(raw_pages), raw["url"])

        lh_scores = await lh_service.score(raw["url"])
        co2_grams = co2_service.estimate_co2(raw["transfer_size_bytes"])
        section = detect_section(raw["url"])

        pages.append(
            Page(
                url=raw["url"],
                section=section,
                load_time_ms=raw["load_time_ms"],
                transfer_size_bytes=raw["transfer_size_bytes"],
                request_count=raw["request_count"],
                resources=raw["resources"],
                lighthouse=lh_scores,
                estimated_co2_grams=co2_grams,
                flags=raw.get("flags", []),
            )
        )

    summary = _build_summary(pages)

    return AuditResult(
        audit_id=audit_id,
        target_url=url,
        crawled_at=datetime.now(timezone.utc).isoformat(),
        pages=pages,
        summary=summary,
    )


def _build_summary(pages: list[Page]) -> Summary:
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
        grade=co2_service.grade(avg_co2),
    )
