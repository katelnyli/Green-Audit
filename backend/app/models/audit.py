from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, HttpUrl


class ImageResource(BaseModel):
    url: str
    size_bytes: int
    format: str
    has_modern_alternative: bool
    flagged: bool


class ScriptResource(BaseModel):
    url: str
    size_bytes: int
    render_blocking: bool


class FontResource(BaseModel):
    url: str
    size_bytes: int


class Resources(BaseModel):
    images: list[ImageResource] = []
    scripts: list[ScriptResource] = []
    fonts: list[FontResource] = []
    other: list[dict] = []


class LighthouseScores(BaseModel):
    performance: int
    best_practices: int


class Flag(BaseModel):
    type: str
    detail: str
    impact: Literal["high", "medium", "low"]


class Page(BaseModel):
    url: str
    section: str
    load_time_ms: int
    transfer_size_bytes: int
    request_count: int
    resources: Resources
    lighthouse: LighthouseScores
    estimated_co2_grams: float
    flags: list[Flag] = []


class SectionSummary(BaseModel):
    section: str
    co2_grams: float
    page_count: int


class TopFlag(BaseModel):
    type: str
    occurrences: int
    impact: Literal["high", "medium", "low"]


class Summary(BaseModel):
    total_pages_crawled: int
    total_transfer_bytes: int
    total_estimated_co2_grams: float
    sections_ranked: list[SectionSummary]
    top_flags: list[TopFlag]
    grade: Literal["A", "B", "C", "D", "F"]


class CodeFix(BaseModel):
    flag_type: str
    page_url: str
    description: str
    code_snippet: str        # actual implementable code, specific to the page
    estimated_co2_saved: float
    injection_js: str        # javascript to inject this fix live into the DOM


class AuditResult(BaseModel):
    audit_id: str
    target_url: str
    crawled_at: str
    pages: list[Page]
    summary: Summary
    fixes: list[CodeFix] = []
    live_url: str | None = None  # browser-use live preview URL


class AuditRequest(BaseModel):
    url: HttpUrl
    credentials: dict[str, str] | None = None


class AuditStarted(BaseModel):
    audit_id: str


class AuditStatus(BaseModel):
    audit_id: str
    status: Literal["queued", "crawling", "scoring", "generating_fixes", "done", "error"]
    progress: int | None = None       # pages completed so far
    total: int | None = None
    current_url: str | None = None
    live_url: str | None = None       # first agent's live preview URL (backward compat)
    live_urls: list[str] = []         # live preview URLs for all agents (index = agent idx)
    pages_discovered: list[str] = []  # URLs found so far during crawl
    agent_status: str | None = None   # latest browser-use step goal — updates every few seconds
    result: AuditResult | None = None
    error: str | None = None
