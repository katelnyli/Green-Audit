"""
Crawler: browser-use-sdk for live preview + autonomous URL discovery,
         httpx for per-page metrics.
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

MAX_PAGES = 10
POLL_INTERVAL = 3.0
CRAWL_TIMEOUT = 240

_PROMPT = (
    "You are a person casually browsing {url}. "
    "Act like a real user: start on the homepage, read what's there, then click on links that look interesting — "
    "product pages, blog posts, about sections, navigation items. Explore naturally across different parts of the site. "
    "Stay on the same domain ({domain}). "
    "Do not fill in forms, create accounts, log in, or make purchases."
)


async def crawl(
    url: str,
    credentials: dict | None,
    max_pages: int = MAX_PAGES,
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

    discovered: list[str] = []
    seen: set[str] = set()

    def _register(raw_url: str) -> None:
        normed = raw_url.rstrip("/")
        host = urlparse(normed).hostname or ""
        same_site = host == domain or host.endswith("." + domain)
        if normed and normed not in seen and same_site and len(discovered) < max_pages:
            seen.add(normed)
            discovered.append(normed)
            logger.info("discovered: %s", normed)
            if on_page_discovered:
                on_page_discovered(normed)

    _register(url)

    prompt = _PROMPT.format(url=url, domain=domain)
    task_resp = await client.tasks.create(task=prompt, start_url=url, max_steps=40)
    task_id = str(task_resp.id)
    session_id = str(task_resp.session_id)
    logger.info("task=%s session=%s", task_id, session_id)

    def _live_cb(lurl: str) -> None:
        if on_live_url:
            on_live_url(lurl)
        if on_agent_live_url:
            on_agent_live_url(0, lurl)

    live_url_task = asyncio.create_task(_fetch_live_url(client, session_id, _live_cb))

    seen_steps = 0
    deadline = time.monotonic() + CRAWL_TIMEOUT

    while time.monotonic() < deadline and len(discovered) < max_pages:
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
            on_agent_status(new_steps[-1].next_goal)
        seen_steps = len(task_view.steps)

        if task_view.status.value in ("finished", "stopped", "failed"):
            break

    if not live_url_task.done():
        try:
            await asyncio.wait_for(asyncio.shield(live_url_task), timeout=30)
        except (asyncio.TimeoutError, Exception):
            live_url_task.cancel()

    try:
        await client.tasks.stop(task_id)
    except Exception:
        pass

    if not discovered:
        discovered = [url.rstrip("/")]

    # ── Measure each page with httpx (concurrent) ─────────────────────────────
    results = await asyncio.gather(
        *[_measure_page(u) for u in discovered[:max_pages]],
        return_exceptions=True,
    )
    pages = [r for r in results if not isinstance(r, Exception)]
    if not pages:
        raise RuntimeError("All page fetches failed — check the target URL is publicly accessible")
    return pages


async def _get_nav_links(url: str, domain: str, n: int) -> list[str]:
    """Quickly fetch the homepage and extract n distinct nav/anchor links for agent seeding."""
    try:
        async with httpx.AsyncClient(
            timeout=10, follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (GreenAudit/1.0)"},
        ) as c:
            resp = await c.get(url)
            html = resp.text
        links: list[str] = []
        seen: set[str] = {url.rstrip("/")}
        skip_exts = (".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".zip", ".css", ".js")
        for m in re.finditer(r'<a[^>]+href=["\']([^"\'>\s#][^"\'>\s]*)["\']', html, re.I):
            href = _abs(m.group(1), url)
            normed = href.rstrip("/")
            host = urlparse(normed).hostname or ""
            same_site = host == domain or host.endswith("." + domain)
            if (normed and same_site and normed not in seen
                    and not any(normed.lower().endswith(e) for e in skip_exts)):
                seen.add(normed)
                links.append(normed)
                if len(links) >= n:
                    break
        return links
    except Exception as e:
        logger.warning("nav pre-crawl failed: %s", e)
        return []


async def _fetch_live_url(client, session_id: str, on_live_url: Callable[[str], None] | None) -> None:
    """Retry getting live_url for up to 30s without blocking the crawl."""
    if not on_live_url:
        return
    for delay in (1, 2, 2, 3, 3, 4, 5, 5, 5):
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
    stylesheet_count = len(re.findall(r'<link[^>]+rel=["\']stylesheet["\']', html, re.I))

    # Estimate total page weight including all referenced resources
    resource_bytes = (
        sum(img["size_bytes"] for img in images)
        + sum(s["size_bytes"] for s in scripts)
        + sum(f["size_bytes"] for f in fonts)
        + stylesheet_count * 25_000  # avg CSS file
    )
    total_bytes = len(body) + resource_bytes

    # Count all outbound resource requests the browser would make
    request_count = 1 + len(images) + len(scripts) + len(fonts) + stylesheet_count

    # ── Extra signals for additional flag types ───────────────────────────────
    encoding = resp.headers.get("content-encoding", "")
    has_compression = any(enc in encoding.lower() for enc in ("gzip", "br", "zstd", "deflate"))

    cache_control = resp.headers.get("cache-control", "")
    cache_max_age = 0
    ma = re.search(r"max-age=(\d+)", cache_control)
    if ma:
        cache_max_age = int(ma.group(1))

    lazy_loadable_images = sum(
        1 for m in re.finditer(r'<img([^>]*)>', html, re.I)
        if "loading=" not in m.group(1).lower()
    )

    inline_script_bytes = sum(
        len(m.group(1))
        for m in re.finditer(r'<script(?:[^>]*)>([^<]{200,})</script>', html, re.I | re.S)
        if not re.search(r'src=["\']', m.group(0), re.I)
    )

    page_domain = urlparse(url).hostname or ""
    third_party_domains = len({
        urlparse(s["url"]).hostname
        for s in scripts
        if urlparse(s["url"]).hostname and urlparse(s["url"]).hostname != page_domain
    })

    return {
        "url": url,
        "load_time_ms": load_ms,
        "transfer_size_bytes": total_bytes,
        "request_count": request_count,
        "resources": {"images": images, "scripts": scripts, "fonts": fonts, "other": []},
        "dom_context": _dom_context(html, url),
        # extra signals
        "has_compression": has_compression,
        "cache_max_age": cache_max_age,
        "lazy_loadable_images": lazy_loadable_images,
        "inline_script_bytes": inline_script_bytes,
        "third_party_domains": third_party_domains,
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
    seen: set[str] = set()

    # Direct font file links (preload or rel=font)
    for m in re.finditer(r'<link([^>]+)>', html, re.I):
        attrs = m.group(1)
        h = re.search(r'href=["\']([^"\'>\s]+)["\']', attrs)
        if not h:
            continue
        href = _abs(h.group(1), base)
        if not href or href in seen:
            continue
        ext = href.split("?")[0].rsplit(".", 1)[-1].lower()
        if ext in ("woff", "woff2", "ttf", "otf", "eot"):
            seen.add(href)
            out.append({"url": href, "size_bytes": 50_000})
        # Google Fonts / Typekit / Bunny CDN stylesheet links
        elif re.search(r'(fonts\.googleapis\.com|fonts\.bunny\.net|use\.typekit\.net|use\.fontawesome\.com)', href, re.I):
            seen.add(href)
            out.append({"url": href, "size_bytes": 50_000})

    # @font-face declarations in inline <style> blocks
    for style_m in re.finditer(r'<style[^>]*>(.*?)</style>', html, re.S | re.I):
        for ff_m in re.finditer(r"@font-face\s*\{([^}]+)\}", style_m.group(1), re.I):
            src_m = re.search(r"url\(['\"]?([^'\")\s]+)['\"]?\)", ff_m.group(1))
            if src_m:
                href = _abs(src_m.group(1), base)
                if href and href not in seen:
                    seen.add(href)
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
