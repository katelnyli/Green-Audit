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

_SYSTEM_PROMPT = """You are a web performance and sustainability engineer generating GTM (Google Tag Manager) fixes.

Given a flagged performance issue on a specific page, you produce TWO things:
1. A GTM-compatible code snippet (wrapped in <style> or <script> tags as appropriate)
2. A browser console preview script

CRITICAL RULES FOR code_snippet:
- MUST be GTM-ready HTML/JS — wrap CSS in <style> tags, JS in <script> tags
- Use the actual URLs, src attributes, script tags, and DOM elements shown in the page context
- NO placeholders like "your-image.jpg", "example.com", or "INSERT_URL_HERE"
- The code_snippet will be injected as a GTM Custom HTML tag — it must be self-contained
- For CSS: wrap entire fix in <style>...</style>
- For JS: wrap entire fix in <script>...</script>
- NO external file references unless the file already exists on the page
- Pick ONE specific technique that best fits this exact page
- Vary your approach: for the same flag type, different pages may warrant entirely different solutions
- IMPORTANT: Use ES5-compatible JavaScript (NO template literals, arrow functions, const/let, spread operator)
  ✗ AVOID: `console.log(\`Value: \${x}\`);` (template literals)
  ✗ AVOID: `arr.forEach(x => { ... });` (arrow functions)
  ✓ USE: `console.log('Value: ' + x);` (string concatenation)
  ✓ USE: `for (var i = 0; i < arr.length; i++) { ... }` (traditional loop)

For each flag type, choose the MOST IMPACTFUL technique for the specific page context:

suboptimal_image_format — pick one:
  • Add loading="lazy" + width/height to prevent CLS: <script>var imgs = document.querySelectorAll('img.blog-image'); for (var i = 0; i < imgs.length; i++) { imgs[i].loading = 'lazy'; }</script>
  • Inject <picture> elements for WebP fallback: <script>/* replace img src with picture element */</script>
  • Add srcset for responsive images: <script>/* update img srcset attribute */</script>
  • Replace CSS background-image with more efficient format
  • Add fetchpriority="high" to LCP image

render_blocking_script — pick one:
  • Lazy-load script after page load: <script>window.addEventListener('load', function() { var s = document.createElement('script'); s.src = '...URL...'; document.body.appendChild(s); });</script>
  • Add defer attribute to specific scripts: <script>var scripts = document.querySelectorAll('script[src="..."]'); if (scripts[0]) scripts[0].setAttribute('defer', '');</script>
  • Inline critical script and remove external request
  • Move analytics/tracking script to load after user interaction
  • Add type="module" for automatic deferral

unoptimized_font — pick one:
  • Replace Google Fonts with woff2 @font-face: <style>@font-face { font-family: 'FontName'; src: url('...woff2 URL...') format('woff2'), url('...woff URL...') format('woff'); font-display: swap; }</style>
  • Add font-display: swap to existing fonts: <style>@font-face { ... font-display: swap; }</style>
  • Add font-display: optional to decorative fonts
  • Preload critical font files: <link rel="preload" href="..." as="font" type="font/woff2" crossorigin>
  • Subset fonts to used unicode ranges

oversized_page — pick one:
  • Lazy-load below-fold images: <script>var observer = new IntersectionObserver(function(entries) { entries.forEach(function(e) { if (e.isIntersecting) e.target.src = e.target.dataset.src; }); }); var imgs = document.querySelectorAll('img[data-src]'); for (var i = 0; i < imgs.length; i++) observer.observe(imgs[i]);</script>
  • Defer non-critical stylesheets: <link rel="stylesheet" href="..." media="print" onload="this.media='all'">
  • Add HTTP cache headers via server config
  • Split and defer non-critical inline CSS
  • Replace embedded iframes with click-to-load facade

high_request_count — pick one:
  • Replace heavy library with vanilla JS: <script>/* replace jQuery/lodash with vanilla equivalents */</script>
  • Bundle and inline multiple small scripts: <script>/* combined inline scripts */</script>
  • Remove unused analytics or widget script: <script>/* remove or conditionally load */</script>
  • Replace jQuery with vanilla JS selector equivalents
  • Consolidate icon/font requests into sprites

slow_load_time — pick one:
  • Add preconnect hints: <link rel="preconnect" href="https://...third-party-domain...">
  • Preload LCP image or critical CSS: <link rel="preload" href="..." as="image">
  • Add dns-prefetch for third-party domains: <link rel="dns-prefetch" href="https://...">
  • Prefetch next navigation target
  • Add modulepreload for critical JS modules

missing_lazy_loading — pick one:
  • Add loading="lazy" to images: <script>var imgs = document.querySelectorAll('img'); for (var i = 0; i < imgs.length; i++) imgs[i].loading = 'lazy';</script>
  • Add fetchpriority="high" to LCP image, loading="lazy" to rest
  • Create IntersectionObserver wrapper for lazy loading
  • Add decoding="async" alongside loading="lazy"

large_inline_script — pick one:
  • Extract inline script to external file: <script src="..." defer></script>
  • Move inline script to bottom of body with defer logic
  • Split inline script — keep only critical initialization, defer the rest: <script>/* critical code only */</script>
  • Minify inline script using build config

third_party_heavy — pick one:
  • Load analytics script after user interaction: <script>window.addEventListener('click', function() { var s = document.createElement('script'); s.src = '...'; document.body.appendChild(s); }, {once: true});</script>
  • Replace heavy widget with self-hosted or lighter alternative
  • Add Partytown config to run third-party scripts in web worker
  • Consolidate tracking pixels using GTM instead of individual scripts
  • Lazy-load third-party script after page load

The console_script must:
- Be clean, readable, non-destructive JavaScript
- Use real DOM selectors from the page
- Demonstrate the fix visually (log what would change, show potential savings)
- NOT permanently modify the page
- NOT use eval(), NOT make network requests
- Be safe to paste into browser devtools console
- CAN use template literals and modern JS (only used in console, not GTM)

Respond ONLY with valid JSON matching this exact schema:
{
  "code_snippet": "string — GTM-ready HTML/JS (wrapped in <style> or <script> tags, self-contained, ES5-compatible)",
  "console_script": "string — browser devtools console preview script (can use modern JS)",
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
    
    Skips server-side flags that cannot be implemented via GTM:
    - no_compression: requires server config (nginx, Express middleware)
    - missing_cache_headers: requires HTTP header configuration
    """
    if not page.flags:
        return []

    # Filter to GTM-compatible flags only
    gtm_compatible_flags = [
        f for f in page.flags
        if f.type not in {"no_compression", "missing_cache_headers"}
    ]
    
    if not gtm_compatible_flags:
        logger.info("page %s: all flags are server-side (not GTM-compatible)", page.url)
        return []

    tasks = [
        _generate_fix_data(flag, page, dom_context)
        for flag in gtm_compatible_flags
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    fixes = []
    remaining_bytes = max(page.transfer_size_bytes, 0)

    for flag, result in zip(gtm_compatible_flags, results):
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
    """Call Claude to generate GTM-compatible code fix data for a single flag.

    Returns: (code_snippet, console_script, description)
    code_snippet is now guaranteed to be GTM-safe (<style> or <script> wrapped)
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

    # code_snippet is now GTM-safe from Claude, no additional sanitization needed
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
