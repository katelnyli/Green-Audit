"""
Orchestrates the full audit pipeline:
  crawl → score each page (Lighthouse + CO2 + flags) → generate code fixes → assemble report
"""

import asyncio
from datetime import datetime, timezone
from typing import Callable

from app.models.audit import AuditResult, LighthouseScores, Page, Summary
from app.services import codegen as codegen_service
from app.services import lighthouse as lh_service
from app.services import scoring


async def run_full_audit(
    audit_id: str,
    url: str,
    credentials: dict | None,
    max_pages: int = 10,
    on_progress: Callable[[str, int, int, str], None] = lambda *_: None,
    on_live_url: Callable[[str], None] | None = None,
    on_agent_live_url: Callable[[int, str], None] | None = None,
    on_page_discovered: Callable[[str], None] | None = None,
    on_agent_status: Callable[[str], None] | None = None,
    on_pages_scored: Callable[[list[Page]], None] | None = None,
    should_stop_after_scoring: Callable[[], bool] | None = None,
) -> AuditResult:
    from app.crawler.client import crawl

    # ── Phase 1: crawl ────────────────────────────────────────────────────────
    # Pass max_pages as total so the frontend can show X/max_pages during crawl.
    on_progress("crawling", 0, max_pages, url)
    raw_pages = await crawl(
        url,
        credentials,
        max_pages=max_pages,
        on_live_url=on_live_url,
        on_agent_live_url=on_agent_live_url,
        on_page_discovered=on_page_discovered,
        on_agent_status=on_agent_status,
    )
    total = len(raw_pages)

    # ── Phase 2: score all pages — emit one progress tick per page ────────────
    on_progress("scoring", 0, total, url)

    completed = 0
    lock = asyncio.Lock()
    lh_results: list = [None] * total

    async def _score_one(idx: int, raw: dict):
        nonlocal completed
        try:
            result = await lh_service.score(raw["url"])
        except Exception as e:
            result = e
        async with lock:
            completed += 1
            on_progress("scoring", completed, total, raw["url"])
        lh_results[idx] = result

    await asyncio.gather(*[_score_one(i, raw) for i, raw in enumerate(raw_pages)])

    pages: list[Page] = []
    for raw, lh in zip(raw_pages, lh_results):
        if isinstance(lh, Exception) or lh is None:
            lh = LighthouseScores(performance=0, best_practices=0)
        pages.append(scoring.assemble_page(raw, lh))

    summary = scoring.build_summary(pages)

    # Save intermediate result so early termination shows data
    if on_pages_scored:
        on_pages_scored(pages)

    # Check if user requested termination after scoring
    if should_stop_after_scoring and should_stop_after_scoring():
        return AuditResult(
            audit_id=audit_id,
            target_url=url,
            crawled_at=datetime.now(timezone.utc).isoformat(),
            pages=pages,
            summary=summary,
            fixes=[],
        )

    # ── Phase 3: generate code fixes — emit one progress tick per page ────────
    on_progress("generating_fixes", 0, total, url)

    fix_completed = 0
    fix_lock = asyncio.Lock()
    fix_results: list = [None] * total

    async def _fix_one(idx: int, page: Page):
        nonlocal fix_completed
        dom_context = raw_pages[idx].get("dom_context", "")
        try:
            result = await codegen_service.generate_fixes_for_page(page, dom_context)
        except Exception as e:
            result = e
        async with fix_lock:
            fix_completed += 1
            on_progress("generating_fixes", fix_completed, total, page.url)
        fix_results[idx] = result

    await asyncio.gather(*[_fix_one(i, page) for i, page in enumerate(pages)])

    all_fixes = []
    for r in fix_results:
        if r is not None and not isinstance(r, Exception):
            all_fixes.extend(r)

    # Cap at 3 fixes per flag type, keeping the highest CO2 savings
    all_fixes.sort(key=lambda f: f.estimated_co2_saved, reverse=True)
    type_counts: dict[str, int] = {}
    capped_fixes = []
    for fix in all_fixes:
        if type_counts.get(fix.flag_type, 0) < 3:
            capped_fixes.append(fix)
            type_counts[fix.flag_type] = type_counts.get(fix.flag_type, 0) + 1

    return AuditResult(
        audit_id=audit_id,
        target_url=url,
        crawled_at=datetime.now(timezone.utc).isoformat(),
        pages=pages,
        summary=summary,
        fixes=capped_fixes,
    )
