"""
Crawler: browser-use-sdk for live preview + autonomous URL discovery,
         httpx for per-page metrics.

Strategy for demo reliability:
  - Stop collecting as soon as we have MAX_PAGES, don't wait for the full task
  - Fetch live_url concurrently so it never blocks the step-polling loop
  - httpx measures real transfer size and load time for every discovered URL
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from typing import Callable
from urllib.parse import urljoin, urlparse

import httpx

logger = logging.getLogger(__name__)

MAX_PAGES = 4          # stop collecting after this many — keeps demo fast
POLL_INTERVAL = 1.0    # seconds between browser-use step polls (reduced from 3.0)
CRAWL_TIMEOUT = 150    # bail out after 2.5 min regardless

_PROMPT = (
    "You are auditing {url} for a sustainability report. "
    "Visit the homepage, then click up to {max_pages} main navigation links "
    "to explore different sections of the site. "
    "Stay on the same domain ({domain}). "
    "Do not fill in forms, log in, or click external links."
)


async def crawl(
    url: str,
    credentials: dict | None,
    on_live_url: Callable[[str], None] | None = None,
    on_page_discovered: Callable[[str], None] | None = None,
    on_agent_status: Callable[[str], None] | None = None,
) -> list[dict]:
    api_key = os.getenv("BROWSER_USE_API_KEY", "")
    if not api_key:
        raise RuntimeError("BROWSER_USE_API_KEY is not set")

    from browser_use_sdk.v2.client import AsyncBrowserUse
    client = AsyncBrowserUse(api_key=api_key)
    domain = urlparse(url).hostname or urlparse(url).netloc
    prompt = _PROMPT.format(url=url, domain=domain, max_pages=MAX_PAGES)

    # ── 1. Create browser-use task ────────────────────────────────────────────
    task_resp = await client.tasks.create(
        task=prompt,
        start_url=url,
        max_steps=15,  # reduced from 40 — we only need 4 pages, don't waste steps
    )
    task_id = str(task_resp.id)
    session_id = str(task_resp.session_id)
    logger.info("task=%s session=%s", task_id, session_id)

    # ── 2. Fetch live_url in background — never blocks step polling ───────────
    asyncio.create_task(_fetch_live_url(client, session_id, on_live_url))

    # ── 3. Poll steps; exit as soon as we have MAX_PAGES ─────────────────────
    discovered: list[str] = []
    seen: set[str] = set()
    seen_steps = 0
    deadline = time.monotonic() + CRAWL_TIMEOUT

    def _register(raw_url: str) -> None:
        normed = raw_url.rstrip("/")
        host = urlparse(normed).hostname or ""
        same_site = host == domain or host.endswith("." + domain)
        if normed and normed not in seen and same_site:
            seen.add(normed)
            discovered.append(normed)
            logger.info("discovered: %s", normed)
            if on_page_discovered:
                on_page_discovered(normed)

    _register(url)  # homepage is page #1

    while time.monotonic() < deadline and len(discovered) < MAX_PAGES:
        await asyncio.sleep(POLL_INTERVAL)
        try:
            task_view = await client.tasks.get(task_id)
        except Exception as e:
            logger.warning("poll failed: %s", e)
            continue

        new_steps = task_view.steps[seen_steps:]
        for step in new_steps:
            if step.url:
                _register(step.url)
        if new_steps and on_agent_status:
            # latest step's goal gives the user live feedback on what the agent is doing
            on_agent_status(new_steps[-1].next_goal)
        seen_steps = len(task_view.steps)

        if task_view.status.value in ("finished", "stopped", "failed"):
            break

    # ── 4. Stop the browser-use task (best-effort) ────────────────────────────
    try:
        await client.tasks.stop(task_id)
    except Exception:
        pass

    if not discovered:
        discovered = [url.rstrip("/")]

    # ── 5. Measure each page with httpx (concurrent) ──────────────────────────
    results = await asyncio.gather(
        *[_measure_page(u) for u in discovered[:MAX_PAGES]],
        return_exceptions=True,
    )
    pages = [r for r in results if not isinstance(r, Exception)]
    if not pages:
        raise RuntimeError("All page fetches failed — check the target URL is publicly accessible")
    return pages


async def _fetch_live_url(client, session_id: str, on_live_url: Callable[[str], None] | None) -> None:
    """Retry getting live_url for up to 30s without blocking the crawl."""
    if not on_live_url:
        return
    for delay in (1, 2, 3, 5, 8, 11):
        await asyncio.sleep(delay)
        try:
            session = await client.sessions.get(session_id)
            if session.live_url:
                on_live_url(session.live_url)
                return
        except Exception as e:
            logger.debug("live_url attempt failed: %s", e)


# ── httpx metrics ─────────────────────────────────────────────────────────────

async def _measure_page(url: str) -> dict:
    start = time.monotonic()
    async with httpx.AsyncClient(
        timeout=15,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (GreenAudit/1.0)"},
    ) as c:
        resp = await c.get(url)
        body = resp.content

    load_ms = int((time.monotonic() - start) * 1000)
    html = body.decode("utf-8", errors="replace")
    images = _images(html, url)
    scripts = _scripts(html, url)
    fonts = _fonts(html, url)

    return {
        "url": url,
        "load_time_ms": load_ms,
        "transfer_size_bytes": len(body),
        "request_count": 1 + len(images) + len(scripts) + len(fonts),
        "resources": {"images": images, "scripts": scripts, "fonts": fonts, "other": []},
        "dom_context": _dom_context(html, url),
    }


def _images(html: str, base: str) -> list[dict]:
    out = []
    for m in re.finditer(r'<img[^>]+src=["\']([^"\'>\s]+)["\']', html, re.I):
        src = _abs(m.group(1), base)
        if not src:
            continue
        fmt = _fmt(src)
        modern = fmt in ("webp", "avif", "svg")
        out.append({
            "url": src, "size_bytes": 35_000 if modern else 175_000,
            "format": fmt, "has_modern_alternative": not modern, "flagged": not modern,
        })
    return out[:20]


def _scripts(html: str, base: str) -> list[dict]:
    out = []
    for m in re.finditer(r'<script([^>]*)>', html, re.I):
        attrs = m.group(1)
        s = re.search(r'src=["\']([^"\'>\s]+)["\']', attrs)
        if not s:
            continue
        src = _abs(s.group(1), base)
        if not src:
            continue
        blocking = "async" not in attrs.lower() and "defer" not in attrs.lower()
        out.append({"url": src, "size_bytes": 80_000, "render_blocking": blocking})
    return out[:15]


def _fonts(html: str, base: str) -> list[dict]:
    out = []
    for m in re.finditer(r'<link([^>]+)>', html, re.I):
        attrs = m.group(1)
        if not re.search(r'(font|preload)', attrs, re.I):
            continue
        h = re.search(r'href=["\']([^"\'>\s]+)["\']', attrs)
        if not h:
            continue
        href = _abs(h.group(1), base)
        if not href:
            continue
        ext = href.split("?")[0].rsplit(".", 1)[-1].lower()
        if ext in ("woff", "woff2", "ttf", "otf", "eot"):
            out.append({"url": href, "size_bytes": 50_000})
    return out[:10]


def _dom_context(html: str, url: str) -> str:
    head = re.search(r'<head[^>]*>(.*?)</head>', html, re.S | re.I)
    head_txt = head.group(1)[:3000] if head else ""
    scripts = "\n".join(re.findall(r'<script[^>]+src=[^>]+>', html, re.I)[:10])
    imgs = "\n".join(re.findall(r'<img[^>]+>', html, re.I)[:10])
    links = "\n".join(re.findall(r'<link[^>]+>', html, re.I)[:10])
    return f"URL: {url}\n\nHEAD:\n{head_txt}\n\nSCRIPTS:\n{scripts}\n\nIMAGES:\n{imgs}\n\nLINKS:\n{links}"


def _abs(href: str, base: str) -> str:
    if not href or href.startswith(("data:", "javascript:", "#")):
        return ""
    try:
        return urljoin(base, href)
    except Exception:
        return ""


def _fmt(url: str) -> str:
    path = urlparse(url).path.lower().split("?")[0]
    for ext in (".webp", ".avif", ".svg", ".gif", ".png", ".jpg", ".jpeg"):
        if path.endswith(ext):
            return ext.lstrip(".")
    return "unknown"
