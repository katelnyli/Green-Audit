"""
CO2 estimation using the Website Carbon methodology.
https://www.websitecarbon.com/how-does-it-work/
"""

from typing import Literal

ENERGY_PER_BYTE_KWH = 0.000000000072  # kWh per byte (network + datacenter)
CARBON_INTENSITY_G_PER_KWH = 442       # global average grid (gCO2/kWh)

_GRADE_THRESHOLDS: list[tuple[float, str]] = [
    (0.3, "A"),
    (0.6, "B"),
    (1.2, "C"),
    (2.5, "D"),
]


def estimate_co2(transfer_bytes: int) -> float:
    kwh = transfer_bytes * ENERGY_PER_BYTE_KWH
    return round(kwh * CARBON_INTENSITY_G_PER_KWH, 4)


def grade(avg_co2_per_page: float) -> Literal["A", "B", "C", "D", "F"]:
    for threshold, letter in _GRADE_THRESHOLDS:
        if avg_co2_per_page <= threshold:
            return letter  # type: ignore[return-value]
    return "F"
