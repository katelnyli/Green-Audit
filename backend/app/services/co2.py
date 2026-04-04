"""
CO2 estimation powered by The Green Web Foundation CO2.js library.
https://www.thegreenwebfoundation.org/co2-js/
"""

from __future__ import annotations

import json
import os
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Literal


_DEFAULT_MODEL = os.getenv("CO2JS_MODEL", "swd")
_DEFAULT_GREEN_HOST = os.getenv("CO2JS_GREEN_HOST", "false").strip().lower() in {"1", "true", "yes"}
_NODE_BIN = os.getenv("CO2JS_NODE_BIN", "node")


@lru_cache(maxsize=1)
def _co2_js_runner_path() -> Path:
    return Path(__file__).resolve().parents[2] / "node" / "co2_estimate.mjs"

_GRADE_THRESHOLDS: list[tuple[float, str]] = [
    (0.3, "A"),
    (0.6, "B"),
    (1.2, "C"),
    (2.5, "D"),
]


def estimate_co2(transfer_bytes: int, *, green_host: bool | None = None) -> float:
    """Estimate grams of CO2e for transferred bytes using CO2.js `perByte()`.

    Falls back to 0.0 if the helper cannot run.
    """
    if transfer_bytes <= 0:
        return 0.0

    use_green_host = _DEFAULT_GREEN_HOST if green_host is None else green_host
    runner = _co2_js_runner_path()

    try:
        proc = subprocess.run(
            [
                _NODE_BIN,
                str(runner),
                str(int(transfer_bytes)),
                "true" if use_green_host else "false",
                _DEFAULT_MODEL,
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=5,
        )
        payload = json.loads(proc.stdout)
        value = float(payload.get("grams", 0.0))
        return round(max(value, 0.0), 4)
    except Exception:
        # Keep audits resilient even if Node/CO2.js is unavailable.
        return 0.0


def grade(avg_co2_per_page: float) -> Literal["A", "B", "C", "D", "F"]:
    for threshold, letter in _GRADE_THRESHOLDS:
        if avg_co2_per_page <= threshold:
            return letter  # type: ignore[return-value]
    return "F"
