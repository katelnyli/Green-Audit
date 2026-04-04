"""
Orchestrates the full audit pipeline:
  crawl → score each page (Lighthouse + CO2 + flags) → generate code fixes → assemble report
"""

from datetime import datetime, timezone
from typing import Callable

from app.models.audit import AuditResult, Page, Summary
from app.services import codegen as codegen_service
from app.services import lighthouse as lh_service
from app.services import scoring


async def run_full_audit(
    audit_id: str,
    url: str,
    credentials: dict | None,
    on_progress: Callable[[str, int, int, str], None],
) -> AuditResult:
    from app.crawler.client import crawl

    # ── Phase 1: crawl ──────────────────────────────────────────────────────
    on_progress("crawling", 0, 0, url)
    raw_pages = await crawl(url, credentials)
    total = len(raw_pages)

    # ── Phase 2: score each page ─────────────────────────────────────────────
    pages: list[Page] = []
    for i, raw in enumerate(raw_pages):
        on_progress("scoring", i + 1, total, raw["url"])
        lh_scores = await lh_service.score(raw["url"])
        page = scoring.assemble_page(raw, lh_scores)
        pages.append(page)

    summary = scoring.build_summary(pages)

    # ── Phase 3: generate code fixes via Claude ──────────────────────────────
    on_progress("generating_fixes", 0, total, url)
    all_fixes = []
    for i, page in enumerate(pages):
        on_progress("generating_fixes", i + 1, total, page.url)
        dom_context = raw_pages[i].get("dom_context", "")
        fixes = await codegen_service.generate_fixes_for_page(page, dom_context)
        all_fixes.extend(fixes)

    return AuditResult(
        audit_id=audit_id,
        target_url=url,
        crawled_at=datetime.now(timezone.utc).isoformat(),
        pages=pages,
        summary=summary,
        fixes=all_fixes,
    )
