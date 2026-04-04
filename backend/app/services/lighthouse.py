"""
Fetches Lighthouse scores via the Google PageSpeed Insights API.
No local install required — just an HTTP call.
Get a free API key at https://developers.google.com/speed/docs/insights/v5/get-started
Without a key, requests are rate-limited to ~25/day. Fine for a hackathon demo.
"""

import logging
import os

import httpx

from app.models.audit import LighthouseScores

logger = logging.getLogger(__name__)

_PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
_API_KEY = os.getenv("PAGESPEED_API_KEY")  # optional — works without it, just rate-limited


async def score(url: str) -> LighthouseScores:
    params: dict = {
        "url": url,
        "strategy": "desktop",
        "category": ["performance", "best-practices"],
    }
    if _API_KEY:
        params["key"] = _API_KEY

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(_PSI_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        cats = data.get("lighthouseResult", {}).get("categories", {})
        return LighthouseScores(
            performance=_to_int(cats.get("performance", {}).get("score")),
            best_practices=_to_int(cats.get("best-practices", {}).get("score")),
        )
    except Exception as e:
        logger.warning("PageSpeed Insights failed for %s: %s", url, e)
        return LighthouseScores(performance=0, best_practices=0)


def _to_int(score: float | None) -> int:
    if score is None:
        return 0
    return round(score * 100)
