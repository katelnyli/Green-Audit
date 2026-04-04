"""
Interface to the crawler (owned by the crawler teammate).
Swap this stub out once the real crawler is ready.
"""


async def crawl(url: str, credentials: dict | None) -> list[dict]:
    """
    Returns a list of raw page dicts matching the shape expected by the orchestrator:
    {
        "url": str,
        "load_time_ms": int,
        "transfer_size_bytes": int,
        "request_count": int,
        "resources": Resources-compatible dict,
        "flags": list[Flag-compatible dict],
    }
    """
    raise NotImplementedError(
        "crawler/client.py is a stub — wire up the real crawler here"
    )
