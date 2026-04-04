"""
Runs Lighthouse CLI against a URL and returns performance + best_practices scores.
Requires: npm install -g lighthouse
"""

import asyncio
import json
import tempfile
from pathlib import Path

from app.models.audit import LighthouseScores


async def score(url: str) -> LighthouseScores:
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        output_path = f.name

    proc = await asyncio.create_subprocess_exec(
        "lighthouse",
        url,
        "--output=json",
        f"--output-path={output_path}",
        "--chrome-flags=--headless --no-sandbox",
        "--only-categories=performance,best-practices",
        "--quiet",
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.wait()

    data = json.loads(Path(output_path).read_text())
    categories = data.get("categories", {})

    return LighthouseScores(
        performance=_to_int(categories.get("performance", {}).get("score")),
        best_practices=_to_int(categories.get("best-practices", {}).get("score")),
    )


def _to_int(score: float | None) -> int:
    if score is None:
        return 0
    return round(score * 100)
