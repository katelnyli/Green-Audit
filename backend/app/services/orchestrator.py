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
    on_progress: Callable[[str, int, int, str], None],
    on_live_url: Callable[[str], None] | None = None,
    on_agent_live_url: Callable[[int, str], None] | None = None,
    on_page_discovered: Callable[[str], None] | None = None,
    on_agent_status: Callable[[str], None] | None = None,
) -> AuditResult:
    from app.crawler.client import crawl

    # ── Phase 1: crawl ────────────────────────────────────────────────────────
    on_progress("crawling", 0, 0, url)
    raw_pages = await crawl(
        url,
        credentials,
        on_live_url=on_live_url,
        on_agent_live_url=on_agent_live_url,
        on_page_discovered=on_page_discovered,
        on_agent_status=on_agent_status,
    )
    total = len(raw_pages)

    # ── Phase 2: score all pages concurrently ─────────────────────────────────
    on_progress("scoring", 0, total, url)
    lh_results = await asyncio.gather(
        *[lh_service.score(raw["url"]) for raw in raw_pages],
        return_exceptions=True,
    )
    pages: list[Page] = []
    for raw, lh in zip(raw_pages, lh_results):
        if isinstance(lh, Exception):
            lh = LighthouseScores(performance=0, best_practices=0)
        pages.append(scoring.assemble_page(raw, lh))
    on_progress("scoring", total, total, url)

    summary = scoring.build_summary(pages)

    # ── Phase 3: generate code fixes for all pages concurrently ──────────────
    on_progress("generating_fixes", 0, total, url)
    fix_tasks = [
        codegen_service.generate_fixes_for_page(page, raw_pages[i].get("dom_context", ""))
        for i, page in enumerate(pages)
    ]
    fix_results = await asyncio.gather(*fix_tasks, return_exceptions=True)
    all_fixes = []
    for r in fix_results:
        if not isinstance(r, Exception):
            all_fixes.extend(r)

    return AuditResult(
        audit_id=audit_id,
        target_url=url,
        crawled_at=datetime.now(timezone.utc).isoformat(),
        pages=pages,
        summary=summary,
        fixes=all_fixes,
    )
