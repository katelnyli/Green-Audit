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
2. A JavaScript snippet that injects this fix live into the DOM for preview

Respond ONLY with valid JSON matching this exact schema:
{
  "code_snippet": "string — the actual implementable fix (HTML/CSS/JS/config)",
  "injection_js": "string — JavaScript that can be eval'd in the page to demonstrate the fix live",
  "description": "string — one sentence explaining what this fix does and why"
}"""


async def generate_fixes_for_page(page: Page, dom_context: str) -> list[CodeFix]:
    """Generate a CodeFix for every flag on a page.
    
    Applies fixes sequentially to avoid double-counting overlapping byte savings.
    """
    if not page.flags:
        return []

    # Step 1: Get all fix data from Claude concurrently (code, description, injection_js)
    tasks = [
        _generate_fix_data(flag, page, dom_context)
        for flag in page.flags
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Step 2: Apply fixes sequentially to calculate CO2 savings
    fixes = []
    remaining_bytes = max(page.transfer_size_bytes, 0)
    
    for flag, result in zip(page.flags, results):
        if isinstance(result, Exception):
            logger.warning("codegen failed for %s on %s: %s", flag.type, page.url, result)
            continue
        
        code_snippet, injection_js, description = result
        
        # Create a temporary page-like object with remaining bytes for savings calculation
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
        
        # Update remaining bytes for next fix calculation
        remaining_bytes = after_bytes
    
    return fixes


async def _generate_fix_data(flag: Flag, page: Page, dom_context: str) -> tuple[str, str, str]:
    """Call Claude to generate code fix data for a single flag.
    
    Returns: (code_snippet, injection_js, description)
    """
    context = _build_context(flag, page, dom_context)

    response = await _client.messages.create(
        model=_MODEL,
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": context}],
    )

    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    data = json.loads(raw)

    return data["code_snippet"], data["injection_js"], data["description"]


def _build_context(flag: Flag, page: Page, dom_context: str) -> str:
    resource_summary = _resource_summary(page, flag.type)
    return f"""Page URL: {page.url}
Section: {page.section}
Flag: {flag.type}
Detail: {flag.detail}
Impact: {flag.impact}
Page transfer size: {page.transfer_size_bytes:,} bytes
Page estimated CO2: {page.estimated_co2_grams}g
{resource_summary}

Relevant DOM context:
{dom_context[:2000]}

Generate a specific, implementable fix for this exact page. Reference the actual URLs, class names, and elements shown above — not generic boilerplate."""


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

    return ""


def _estimate_bytes_saved(flag: Flag, page: Page) -> int:
    """Estimate transfer-byte savings from a fix using page-specific signals.

    This avoids a single hardcoded factor per flag and uses available resource
    data (image/script/font sizes, request count, and page budget overage).
    """
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
            # Typical format conversion gains vary by original format.
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
        # Defer/async may not remove bytes directly, but script optimization,
        # splitting, and dead-code elimination often accompany the fix.
        blocking_bytes = sum(s.size_bytes for s in page.resources.scripts if s.render_blocking)
        request_pressure = max(page.request_count - 40, 0) / 200
        optimization_ratio = min(0.25, 0.04 + request_pressure)
        estimated = blocking_bytes * optimization_ratio
        return _clamp_bytes(estimated, total, upper_ratio=0.35)

    if flag.type == "oversized_page":
        over_budget = max(total - _PAGE_BUDGET_BYTES, 0)
        # Savings scale with how far over budget the page is.
        estimated = over_budget * 0.70
        return _clamp_bytes(estimated, total, upper_ratio=0.70)

    if flag.type == "high_request_count":
        removable_requests = max(page.request_count - 80, 0)
        avg_req_bytes = total / max(page.request_count, 1)
        # Removing/deprioritizing non-critical requests yields both payload and
        # protocol-overhead savings.
        estimated = removable_requests * avg_req_bytes * 0.55
        return _clamp_bytes(estimated, total, upper_ratio=0.30)

    if flag.type == "unoptimized_font":
        non_woff2_bytes = sum(
            f.size_bytes for f in page.resources.fonts if not f.url.lower().endswith(".woff2")
        )
        estimated = non_woff2_bytes * 0.30
        return _clamp_bytes(estimated, total, upper_ratio=0.20)

    if flag.type == "slow_load_time":
        # Blend likely contributors: heavy images and blocking JS.
        top_images = sorted((img.size_bytes for img in page.resources.images), reverse=True)[:3]
        heavy_image_bytes = sum(top_images)
        blocking_bytes = sum(s.size_bytes for s in page.resources.scripts if s.render_blocking)
        estimated = (heavy_image_bytes * 0.20) + (blocking_bytes * 0.10)
        return _clamp_bytes(estimated, total, upper_ratio=0.25)

    # Conservative fallback for unknown flags.
    return _clamp_bytes(total * 0.05, total, upper_ratio=0.10)


def _clamp_bytes(estimated: float, total: int, *, upper_ratio: float) -> int:
    capped = max(0.0, min(float(total) * upper_ratio, estimated))
    return int(round(capped))
