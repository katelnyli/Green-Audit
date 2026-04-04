"""
Interface to the crawler (owned by the crawler teammate).
Swap this stub out once the real crawler is ready.
"""

# TODO: remove stub and wire up browser-use crawler


async def crawl(url: str, credentials: dict | None) -> list[dict]:
    base = url.rstrip("/")
    return [
        {
            "url": base,
            "load_time_ms": 3200,
            "transfer_size_bytes": 1_450_000,
            "request_count": 84,
            "dom_context": (
                f"<img class='hero-img' src='{base}/images/hero.jpg' width='1200' height='600'>\n"
                f"<script src='{base}/analytics.js'></script>\n"
                f"<link rel='stylesheet' href='{base}/fonts/inter.ttf'>"
            ),
            "resources": {
                "images": [
                    {"url": f"{base}/images/hero.jpg", "size_bytes": 340_000, "format": "jpeg", "has_modern_alternative": True, "flagged": True},
                    {"url": f"{base}/images/banner.png", "size_bytes": 210_000, "format": "png", "has_modern_alternative": True, "flagged": True},
                ],
                "scripts": [
                    {"url": f"{base}/analytics.js", "size_bytes": 120_000, "render_blocking": True},
                    {"url": f"{base}/vendor/bundle.js", "size_bytes": 480_000, "render_blocking": False},
                ],
                "fonts": [
                    {"url": f"{base}/fonts/inter.ttf", "size_bytes": 80_000},
                ],
                "other": [],
            },
        },
        {
            "url": f"{base}/shop",
            "load_time_ms": 4800,
            "transfer_size_bytes": 2_800_000,
            "request_count": 112,
            "dom_context": (
                f"<img class='product-thumb' src='{base}/shop/img/product-1.jpg'>\n"
                f"<img class='product-thumb' src='{base}/shop/img/product-2.jpg'>\n"
                f"<script src='{base}/shop/tracking.js'></script>\n"
                f"<script src='{base}/shop/chat-widget.js'></script>"
            ),
            "resources": {
                "images": [
                    {"url": f"{base}/shop/img/product-1.jpg", "size_bytes": 520_000, "format": "jpeg", "has_modern_alternative": True, "flagged": True},
                    {"url": f"{base}/shop/img/product-2.jpg", "size_bytes": 490_000, "format": "jpeg", "has_modern_alternative": True, "flagged": True},
                    {"url": f"{base}/shop/img/product-3.png", "size_bytes": 380_000, "format": "png", "has_modern_alternative": True, "flagged": True},
                ],
                "scripts": [
                    {"url": f"{base}/shop/tracking.js", "size_bytes": 95_000, "render_blocking": True},
                    {"url": f"{base}/shop/chat-widget.js", "size_bytes": 210_000, "render_blocking": True},
                ],
                "fonts": [
                    {"url": f"{base}/fonts/inter.ttf", "size_bytes": 80_000},
                    {"url": f"{base}/fonts/brand.otf", "size_bytes": 140_000},
                ],
                "other": [],
            },
        },
        {
            "url": f"{base}/blog",
            "load_time_ms": 1800,
            "transfer_size_bytes": 620_000,
            "request_count": 34,
            "dom_context": (
                f"<img class='post-hero' src='{base}/blog/img/post-1.jpg'>\n"
                f"<script src='{base}/blog/comments.js' async></script>"
            ),
            "resources": {
                "images": [
                    {"url": f"{base}/blog/img/post-1.jpg", "size_bytes": 180_000, "format": "jpeg", "has_modern_alternative": True, "flagged": True},
                ],
                "scripts": [
                    {"url": f"{base}/blog/comments.js", "size_bytes": 45_000, "render_blocking": False},
                ],
                "fonts": [],
                "other": [],
            },
        },
    ]
