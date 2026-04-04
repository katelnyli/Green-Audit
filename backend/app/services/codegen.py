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

# CO2 savings estimates per fix type (fraction of page CO2 saved)
_CO2_SAVINGS_FACTOR: dict[str, float] = {
    "suboptimal_image_format": 0.25,
    "render_blocking_script": 0.10,
    "oversized_page": 0.20,
    "high_request_count": 0.15,
    "unoptimized_font": 0.05,
    "slow_load_time": 0.10,
}

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
    """Generate a CodeFix for every flag on a page, running calls concurrently."""
    if not page.flags:
        return []

    tasks = [
        _generate_single_fix(flag, page, dom_context)
        for flag in page.flags
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    fixes = []
    for flag, result in zip(page.flags, results):
        if isinstance(result, Exception):
            logger.warning("codegen failed for %s on %s: %s", flag.type, page.url, result)
            continue
        fixes.append(result)
    return fixes


async def _generate_single_fix(flag: Flag, page: Page, dom_context: str) -> CodeFix:
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

    co2_saved = round(
        page.estimated_co2_grams * _CO2_SAVINGS_FACTOR.get(flag.type, 0.1), 4
    )

    return CodeFix(
        flag_type=flag.type,
        page_url=page.url,
        description=data["description"],
        code_snippet=data["code_snippet"],
        estimated_co2_saved=co2_saved,
        injection_js=data["injection_js"],
    )


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
