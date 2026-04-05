"""
Calls the Claude API to generate specific, implementable code fixes and
live DOM injection JavaScript for each flagged issue.
"""

import asyncio
import json
import logging
import os

import anthropic

from app.models.audit import CodeFix, Flag, Page
from app.services.co2 import estimate_co2

logger = logging.getLogger(__name__)

_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
_MODEL = "claude-sonnet-4-20250514"

_PAGE_BUDGET_BYTES = 2_000_000

_SYSTEM_PROMPT = """You are a web performance and sustainability engineer.
Given a flagged performance issue on a specific page, you produce two things:
1. A concrete, implementable code fix that references the actual URLs, class names, IDs, and elements from the page context provided
2. A browser console script the developer can paste into devtools to preview the fix temporarily on their live site

CRITICAL RULES:
- code_snippet MUST contain real, working code — no placeholders like "your-image.jpg", "example.com", or "INSERT_URL_HERE"
- Use the actual URLs, src attributes, script tags, and DOM elements shown in the page context
- Pick ONE specific technique that best fits this exact page — do not list multiple options
- Vary your approach: for the same flag type, different pages may warrant entirely different solutions

For each flag type, choose the MOST IMPACTFUL technique for the specific page context:

suboptimal_image_format — pick one:
  • Add srcset with multiple resolutions using the actual image URL
  • Convert a specific <img> src to .webp and add a <picture> fallback using the real URL
  • Add loading="lazy" + explicit width/height to prevent CLS on below-fold images
  • Replace a CSS background-image URL with a more efficient format
  • Add fetchpriority="high" to the largest above-fold image (LCP element)

render_blocking_script — pick one:
  • Add defer to a specific script tag (show the full tag with real src URL)
  • Inline a small critical script and remove the external request entirely
  • Replace a heavy library with a lighter vanilla JS equivalent (show both before/after)
  • Move a specific analytics or tag manager script to load after user interaction
  • Add type="module" to enable automatic deferral

unoptimized_font — pick one:
  • Replace a Google Fonts <link> with a self-hosted @font-face using woff2 (show the actual font name)
  • Add font-display: swap to an existing @font-face rule
  • Add font-display: optional to a decorative font to eliminate render blocking entirely
  • Subset a font to only the unicode ranges actually used on the page
  • Preload the most critical font file with <link rel="preload">

oversized_page — pick one:
  • Add IntersectionObserver lazy loading to below-fold images (use real image selectors/classes)
  • Defer a specific non-critical stylesheet using media="print" onload trick
  • Add HTTP cache headers or Cache-Control config for static assets
  • Split a large inline <style> block and defer the non-critical portion
  • Replace an embedded iframe (video/map) with a click-to-load facade

high_request_count — pick one:
  • Replace a specific third-party library with a vanilla JS equivalent (name the library and show the replacement)
  • Bundle and inline two or more small scripts that are loaded separately
  • Remove a specific unused analytics or widget script entirely
  • Replace a jQuery snippet with the vanilla JS equivalent using real selectors from the page
  • Consolidate multiple icon/font requests into a single sprite or subset

slow_load_time — pick one:
  • Add <link rel="preconnect"> for a specific third-party domain used by the page
  • Add <link rel="preload"> for the page's LCP image or critical CSS file
  • Add dns-prefetch hints for specific third-party hostnames found in the page resources
  • Add resource hints to prefetch the next likely navigation target
  • Add <link rel="modulepreload"> for a critical JS module

no_compression — pick one:
  • Add nginx gzip/brotli config block enabling compression for html, css, js, json, svg
  • Add Express/Node.js compression middleware (show the actual require and app.use call)
  • Add Apache .htaccess mod_deflate or mod_brotli directives
  • Add Vercel/Netlify config to enable compression (vercel.json or netlify.toml)

missing_cache_headers — pick one:
  • Add Cache-Control headers for static assets in nginx config (js, css, images)
  • Add cache headers in Express using res.set() or a middleware, specific to the route
  • Add <filesMatch> Apache directives for long-lived caching of static assets
  • Add cache headers in Vercel/Netlify config for the specific asset types

missing_lazy_loading — pick one:
  • Add loading="lazy" to specific <img> tags found on the page (show the actual tags)
  • Add fetchpriority="high" to the above-fold LCP image and loading="lazy" to the rest
  • Replace manual img tags with a lazy-loading IntersectionObserver wrapper component
  • Add decoding="async" alongside loading="lazy" to the images

large_inline_script — pick one:
  • Extract the inline script to an external .js file and replace with <script src="...">
  • Move the inline script to the bottom of <body> and add defer logic
  • Split the inline script — keep only the critical initialization inline, move the rest out
  • Minify the inline script using a build tool config (show the relevant config)

third_party_heavy — pick one:
  • Load a specific analytics script (by its actual URL) only after user interaction using an event listener
  • Replace a specific third-party widget with a self-hosted or lighter alternative
  • Add a Partytown config to run third-party scripts in a web worker (show actual setup)
  • Consolidate tracking pixels by using a tag manager instead of individual script tags
  • Lazy-load a specific third-party script after the page's load event fires

The console_script must:
- Be a clean, readable, non-destructive script using real DOM selectors from the page
- Demonstrate the fix visually (e.g. show what an image would look like lazy-loaded, log what a deferred script tag would look like)
- Reset safely on page refresh
- NOT use eval(), NOT make network requests, NOT permanently alter anything

Respond ONLY with valid JSON matching this exact schema:
{
  "code_snippet": "string — the actual implementable fix using real URLs and elements from the page",
  "console_script": "string — a browser devtools console script to preview the fix temporarily",
  "description": "string — one sentence explaining what this specific fix does and why it reduces carbon footprint"
}"""


def _build_context(flag: Flag, page: Page, dom_context: str) -> str:
    resource_summary = _resource_summary(page, flag.type)
    third_party_summary = _third_party_summary(page)
    return f"""Page URL: {page.url}
Section: {page.section}
Flag: {flag.type}
Detail: {flag.detail}
Impact: {flag.impact}
Page transfer size: {page.transfer_size_bytes:,} bytes
Page estimated CO2: {page.estimated_co2_grams}g
Total requests: {page.request_count}
{resource_summary}
{third_party_summary}

Relevant DOM context:
{dom_context[:800]}

Generate a specific, implementable fix for this exact page. Reference the actual URLs,
class names, and elements shown above — not generic boilerplate. The console_script
should be something a developer can paste directly into their browser devtools console
to temporarily preview what the fix would look like, without permanently changing anything."""

async def generate_fixes_for_page(page: Page, dom_context: str) -> list[CodeFix]:
    """Generate a CodeFix for every flag on a page.

    Applies fixes sequentially to avoid double-counting overlapping byte savings.
    """
    if not page.flags:
        return []

    tasks = [
        _generate_fix_data(flag, page, dom_context)
        for flag in page.flags
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    fixes = []
    remaining_bytes = max(page.transfer_size_bytes, 0)

    for flag, result in zip(page.flags, results):
        if isinstance(result, Exception):
            logger.warning("codegen failed for %s on %s: %s", flag.type, page.url, result)
            continue

        code_snippet, injection_js, description = result

        bytes_saved = _estimate_bytes_saved_at_size(flag, page, remaining_bytes)
        after_bytes = max(remaining_bytes - bytes_saved, 0)

        before_co2 = estimate_co2(remaining_bytes)
        after_co2 = estimate_co2(after_bytes)
        co2_saved = round(max(before_co2 - after_co2, 0.0), 6)

        fixes.append(CodeFix(
            flag_type=flag.type,
            page_url=page.url,
            description=description,
            code_snippet=code_snippet,
            estimated_co2_saved=co2_saved,
            injection_js=injection_js,
        ))

        remaining_bytes = after_bytes

    return fixes


async def _generate_fix_data(flag: Flag, page: Page, dom_context: str) -> tuple[str, str, str]:
    """Call Claude to generate code fix data for a single flag.

    Returns: (code_snippet, console_script, description)
    """
    context = _build_context(flag, page, dom_context)

    response = await _client.messages.create(
        model=_MODEL,
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": context}],
    )

    raw = response.content[0].text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Claude sometimes generates unescaped characters in long code strings.
        # Fall back to extracting fields individually with a more lenient approach.
        data = _extract_fields_lenient(raw)

    return data["code_snippet"], data["console_script"], data["description"]


def _extract_fields_lenient(raw: str) -> dict:
    """Fallback parser for when Claude returns malformed JSON.
    
    Extracts the three fields using regex rather than a strict JSON parse,
    which handles unescaped quotes and newlines inside string values.
    """
    import re

    def extract_field(text: str, field: str) -> str:
        # Match the field name and capture everything up to the next field or closing brace
        pattern = rf'"{field}"\s*:\s*"(.*?)(?:"\s*(?:,\s*"(?:code_snippet|console_script|description)"|}}))' 
        match = re.search(pattern, text, re.DOTALL)
        if match:
            return match.group(1).replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
        # Broader fallback — just grab everything after the key until end of string
        start_pattern = rf'"{field}"\s*:\s*"'
        start = re.search(start_pattern, text)
        if not start:
            return ""
        content_start = start.end()
        # Walk character by character to find the closing unescaped quote
        i = content_start
        result = []
        while i < len(text):
            ch = text[i]
            if ch == '\\' and i + 1 < len(text):
                result.append(text[i + 1])
                i += 2
                continue
            if ch == '"':
                break
            result.append(ch)
            i += 1
        return ''.join(result)

    return {
        "code_snippet": extract_field(raw, "code_snippet") or "// Could not parse fix",
        "console_script": extract_field(raw, "console_script") or "// Could not parse script",
        "description": extract_field(raw, "description") or "Fix could not be parsed",
    }


def _resource_summary(page: Page, flag_type: str) -> str:
    if flag_type == "suboptimal_image_format":
        flagged = [img for img in page.resources.images if img.flagged]
        lines = [f"  - {img.url} ({img.format}, {img.size_bytes:,}B)" for img in flagged[:5]]
        return "Flagged images:\n" + "\n".join(lines) if lines else ""

    if flag_type == "render_blocking_script":
        blocking = [s for s in page.resources.scripts if s.render_blocking]
        lines = [f"  - {s.url} ({s.size_bytes:,}B)" for s in blocking[:5]]
        return "Render-blocking scripts:\n" + "\n".join(lines) if lines else ""

    if flag_type == "unoptimized_font":
        lines = [f"  - {f.url} ({f.size_bytes:,}B)" for f in page.resources.fonts[:5]]
        return "Fonts:\n" + "\n".join(lines) if lines else ""

    if flag_type == "oversized_page":
        top_resources = sorted(
            page.resources.images + page.resources.scripts,
            key=lambda r: r.size_bytes,
            reverse=True
        )[:5]
        lines = [f"  - {r.url} ({r.size_bytes:,}B)" for r in top_resources]
        return "Largest resources:\n" + "\n".join(lines) if lines else ""

    if flag_type == "high_request_count":
        all_scripts = page.resources.scripts[:5]
        lines = [f"  - {s.url} ({s.size_bytes:,}B)" for s in all_scripts]
        return f"Total requests: {page.request_count}\nSample scripts:\n" + "\n".join(lines) if lines else ""

    if flag_type == "slow_load_time":
        top_images = sorted(page.resources.images, key=lambda i: i.size_bytes, reverse=True)[:3]
        blocking = [s for s in page.resources.scripts if s.render_blocking][:3]
        image_lines = [f"  - {img.url} ({img.size_bytes:,}B)" for img in top_images]
        script_lines = [f"  - {s.url} ({s.size_bytes:,}B)" for s in blocking]
        parts = []
        if image_lines:
            parts.append("Heaviest images:\n" + "\n".join(image_lines))
        if script_lines:
            parts.append("Blocking scripts:\n" + "\n".join(script_lines))
        return "\n".join(parts)

    return ""


def _third_party_summary(page: Page) -> str:
    page_domain = page.url.split("/")[2] if "//" in page.url else ""
    third_party_scripts = [
        s for s in page.resources.scripts
        if page_domain and page_domain not in s.url
    ]
    if not third_party_scripts:
        return ""
    lines = [f"  - {s.url} ({s.size_bytes:,}B)" for s in third_party_scripts[:5]]
    return "Third-party scripts:\n" + "\n".join(lines)


def _estimate_bytes_saved(flag: Flag, page: Page) -> int:
    """Estimate transfer-byte savings from a fix using page-specific signals."""
    return _estimate_bytes_saved_at_size(flag, page, page.transfer_size_bytes)


def _estimate_bytes_saved_at_size(flag: Flag, page: Page, current_bytes: int) -> int:
    """Estimate transfer-byte savings given the current page size.

    Used in sequential application to account for remaining bytes after prior fixes.
    """
    total = max(current_bytes, 0)
    if total == 0:
        return 0

    if flag.type == "suboptimal_image_format":
        flagged_images = [img for img in page.resources.images if img.flagged]
        estimated = 0.0
        for img in flagged_images:
            fmt = img.format.lower()
            ratio = 0.25
            if fmt in {"png", "bmp", "tiff"}:
                ratio = 0.40
            elif fmt in {"jpg", "jpeg"}:
                ratio = 0.25
            elif fmt == "gif":
                ratio = 0.60
            estimated += img.size_bytes * ratio
        return _clamp_bytes(estimated, total, upper_ratio=0.65)

    if flag.type == "render_blocking_script":
        blocking_bytes = sum(s.size_bytes for s in page.resources.scripts if s.render_blocking)
        request_pressure = max(page.request_count - 40, 0) / 200
        optimization_ratio = min(0.25, 0.04 + request_pressure)
        estimated = blocking_bytes * optimization_ratio
        return _clamp_bytes(estimated, total, upper_ratio=0.35)

    if flag.type == "oversized_page":
        over_budget = max(total - _PAGE_BUDGET_BYTES, 0)
        estimated = over_budget * 0.50
        return _clamp_bytes(estimated, total, upper_ratio=0.40)

    if flag.type == "high_request_count":
        removable_requests = max(page.request_count - 80, 0)
        avg_req_bytes = total / max(page.request_count, 1)
        estimated = removable_requests * avg_req_bytes * 0.55
        return _clamp_bytes(estimated, total, upper_ratio=0.30)

    if flag.type == "unoptimized_font":
        non_woff2_bytes = sum(
            f.size_bytes for f in page.resources.fonts if not f.url.lower().endswith(".woff2")
        )
        estimated = non_woff2_bytes * 0.30
        return _clamp_bytes(estimated, total, upper_ratio=0.20)

    if flag.type == "slow_load_time":
        top_images = sorted((img.size_bytes for img in page.resources.images), reverse=True)[:3]
        heavy_image_bytes = sum(top_images)
        blocking_bytes = sum(s.size_bytes for s in page.resources.scripts if s.render_blocking)
        estimated = (heavy_image_bytes * 0.20) + (blocking_bytes * 0.10)
        return _clamp_bytes(estimated, total, upper_ratio=0.25)

    if flag.type == "no_compression":
        # Compression reduces text payloads (HTML/CSS/JS) by ~60-80%, but images dominate
        # page weight and are unaffected — realistic overall saving is ~15% of total transfer
        estimated = total * 0.15
        return _clamp_bytes(estimated, total, upper_ratio=0.20)

    if flag.type == "missing_cache_headers":
        # Cache headers only help repeat visitors for static assets (~30% of visits)
        estimated = total * 0.12
        return _clamp_bytes(estimated, total, upper_ratio=0.15)

    if flag.type == "missing_lazy_loading":
        # Lazy loading defers below-fold images; estimate 30% of image weight
        image_bytes = sum(img.size_bytes for img in page.resources.images)
        estimated = image_bytes * 0.30
        return _clamp_bytes(estimated, total, upper_ratio=0.30)

    if flag.type == "large_inline_script":
        # Extracting + caching inline scripts saves on repeat visits
        estimated = total * 0.08
        return _clamp_bytes(estimated, total, upper_ratio=0.15)

    if flag.type == "third_party_heavy":
        # Deferring/removing third-party scripts; estimate 20% of script weight
        script_bytes = sum(s.size_bytes for s in page.resources.scripts)
        estimated = script_bytes * 0.20
        return _clamp_bytes(estimated, total, upper_ratio=0.20)

    return _clamp_bytes(total * 0.05, total, upper_ratio=0.10)


def _clamp_bytes(estimated: float, total: int, *, upper_ratio: float) -> int:
    capped = max(0.0, min(float(total) * upper_ratio, estimated))
    return int(round(capped))