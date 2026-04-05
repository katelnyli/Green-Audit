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
1. A concrete, implementable code fix referencing the actual class names, URLs, and elements from the page
2. A browser console script the developer can copy, paste into their browser devtools console, and run to preview what the fix would look like on their live site — without permanently changing anything

For each flag type, here are the kinds of fixes you should generate:
- suboptimal_image_format: Convert src attributes to .webp equivalents, add loading="lazy", add explicit width/height to prevent layout shift
- render_blocking_script: Add defer or async attributes to script tags, move scripts to end of body, remove unused scripts
- unoptimized_font: Replace Google Fonts CDN links with self-hosted woff2 equivalents, add font-display: swap, subset to used unicode ranges
- oversized_page: Lazy load below-fold images, defer non-critical stylesheets, remove unused CSS
- high_request_count: Remove or stub unused third-party scripts, replace heavy libraries with lighter alternatives (e.g. moment.js → date-fns, jQuery → vanilla JS)
- slow_load_time: Add preconnect/dns-prefetch hints for third-party domains, preload critical assets, add resource hints

The console_script should be a clean, readable, non-destructive script that:
- Demonstrates what the fix would look like when applied
- Can be safely run in any browser devtools console
- Makes changes that are temporary and reset on page refresh
- Is something a developer would actually want to copy and use
- Does NOT use eval(), does NOT make network requests, does NOT permanently alter anything

Respond ONLY with valid JSON matching this exact schema:
{
  "code_snippet": "string — the actual implementable fix to apply in the codebase (HTML/CSS/JS/config)",
  "console_script": "string — a clean browser console script to preview the fix temporarily on the live page",
  "description": "string — one sentence explaining what this fix does and why it reduces carbon footprint"
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
        estimated = over_budget * 0.70
        return _clamp_bytes(estimated, total, upper_ratio=0.70)

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

    return _clamp_bytes(total * 0.05, total, upper_ratio=0.10)


def _clamp_bytes(estimated: float, total: int, *, upper_ratio: float) -> int:
    capped = max(0.0, min(float(total) * upper_ratio, estimated))
    return int(round(capped))