from urllib.parse import urlparse


def detect_section(url: str) -> str:
    path = urlparse(url).path.strip("/")
    first_segment = path.split("/")[0] if path else ""
    return first_segment or "home"
