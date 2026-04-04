"""
Crawler: browser-use-sdk for live preview + autonomous URL discovery,
         httpx for per-page metrics.

Strategy for demo reliability:
  - 3 parallel browser-use agents explore the site concurrently
  - Stop collecting as soon as we have MAX_PAGES total across all agents
  - First agent's live_url shown in the iframe
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

MAX_PAGES = 20         # total pages to collect across all agents
NUM_AGENTS = 3         # parallel browser-use agents
PAGES_PER_AGENT = (MAX_PAGES + NUM_AGENTS - 1) // NUM_AGENTS  # ceil(20/3) = 7
POLL_INTERVAL = 3.0    # seconds between browser-use step polls
CRAWL_TIMEOUT = 300    # bail out after 5 min regardless

_PROMPTS = [
    (
        "You are auditing {url} for a sustainability report. Agent 1 of 3. "
        "Start on the homepage, then follow main navigation links. "
        "Stay on the same domain ({domain}). "
        "Do not fill in forms, log in, or click external links."
    ),
    (
        "You are auditing {url} for a sustainability report. Agent 2 of 3. "
        "Start on the homepage, then focus on product, service, or content section links. "
        "Stay on the same domain ({domain}). "
        "Do not fill in forms, log in, or click external links."
    ),
    (
        "You are auditing {url} for a sustainability report. Agent 3 of 3. "
        "Start on the homepage, then explore about, blog, or resource section links. "
        "Stay on the same domain ({domain}). "
        "Do not fill in forms, log in, or click external links."
    ),
]


async def crawl(
    url: str,
    credentials: dict | None,
    on_live_url: Callable[[str], None] | None = None,
    on_agent_live_url: Callable[[int, str], None] | None = None,
    on_page_discovered: Callable[[str], None] | None = None,
    on_agent_status: Callable[[str], None] | None = None,
) -> list[dict]:
    api_key = os.getenv("BROWSER_USE_API_KEY", "")
    if not api_key:
        raise RuntimeError("BROWSER_USE_API_KEY is not set")

    from browser_use_sdk.v2.client import AsyncBrowserUse
    client = AsyncBrowserUse(api_key=api_key)
    domain = urlparse(url).hostname or urlparse(url).netloc

    # Shared state across agents (protected by asyncio single-thread)
    discovered: list[str] = []
    seen: set[str] = set()

    def _register(raw_url: str) -> bool:
        """Returns True if this was a new URL. Thread-safe in asyncio."""
        normed = raw_url.rstrip("/")
        host = urlparse(normed).hostname or ""
        same_site = host == domain or host.endswith("." + domain)
        if normed and normed not in seen and same_site and len(discovered) < MAX_PAGES:
            seen.add(normed)
            discovered.append(normed)
            logger.info("discovered: %s", normed)
            if on_page_discovered:
                on_page_discovered(normed)
            return True
        return False

    _register(url)  # homepage is page #1

    # ── Launch all agents concurrently ────────────────────────────────────────
    async def run_agent(agent_idx: int) -> None:
        prompt = _PROMPTS[agent_idx].format(url=url, domain=domain)
        try:
            task_resp = await client.tasks.create(
                task=prompt,
                start_url=url,
                max_steps=60,
            )
        except Exception as e:
            logger.warning("agent %d failed to start: %s", agent_idx, e)
            return

        task_id = str(task_resp.id)
        session_id = str(task_resp.session_id)
        logger.info("agent=%d task=%s session=%s", agent_idx, task_id, session_id)

        # Each agent fetches its own live_url; agent 0 also fires the legacy on_live_url callback
        def _make_live_cb(idx: int):
            def _cb(lurl: str) -> None:
                if on_agent_live_url:
                    on_agent_live_url(idx, lurl)
                if idx == 0 and on_live_url:
                    on_live_url(lurl)
            return _cb

        asyncio.create_task(_fetch_live_url(client, session_id, _make_live_cb(agent_idx)))

        seen_steps = 0
        deadline = time.monotonic() + CRAWL_TIMEOUT

        while time.monotonic() < deadline and len(discovered) < MAX_PAGES:
            await asyncio.sleep(POLL_INTERVAL)
            try:
                task_view = await client.tasks.get(task_id)
            except Exception as e:
                logger.warning("agent %d poll failed: %s", agent_idx, e)
                continue

            new_steps = task_view.steps[seen_steps:]
            for step in new_steps:
                if step.url:
                    _register(step.url)
            if new_steps and on_agent_status:
                on_agent_status(f"[Agent {agent_idx + 1}] {new_steps[-1].next_goal}")
            seen_steps = len(task_view.steps)

            if task_view.status.value in ("finished", "stopped", "failed"):
                break

        try:
            await client.tasks.stop(task_id)
        except Exception:
            pass

    await asyncio.gather(*[run_agent(i) for i in range(NUM_AGENTS)], return_exceptions=True)

    if not discovered:
        discovered = [url.rstrip("/")]

    # ── Measure each page with httpx (concurrent) ─────────────────────────────
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
