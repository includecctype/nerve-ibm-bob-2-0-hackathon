from __future__ import annotations

import logging
from html.parser import HTMLParser

import httpx
from langchain_core.tools import tool

from ai_tool.network.web_search_sync import webSearchSync
from systemconfig.limits import WEB_FETCH_MAX_BYTES, WEB_FETCH_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)


class TextExtractor(HTMLParser):
    """Minimal HTML-to-text extractor; strips script and style elements."""

    def __init__(self) -> None:
        super().__init__()
        self._skip = False
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: object) -> None:
        if tag in ("script", "style"):
            self._skip = True

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style"):
            self._skip = False

    def handle_data(self, data: str) -> None:
        if not self._skip:
            stripped = data.strip()
            if stripped:
                self._parts.append(stripped)

    def get_text(self) -> str:
        return "\n".join(self._parts)


@tool
def webSearch(search_word: str) -> str:
    """Search the web using Exa. Returns up to 5 results with title, URL, and excerpt."""
    return webSearchSync(search_word)


@tool
def webFetch(url: str) -> str:
    """Fetch the text content of a URL. HTTP/HTTPS only. Returns stripped plain text."""
    if not url.startswith(("http://", "https://")):
        return "Error: only http:// and https:// URLs are supported"
    try:
        with (
            httpx.Client(timeout=WEB_FETCH_TIMEOUT_SECONDS, follow_redirects=True) as client,
            client.stream("GET", url, headers={"User-Agent": "nerve/1.0"}) as response,
        ):
            response.raise_for_status()
            raw = b""
            for chunk in response.iter_bytes(chunk_size=8192):
                raw += chunk
                if len(raw) >= WEB_FETCH_MAX_BYTES:
                    break
        html = raw[:WEB_FETCH_MAX_BYTES].decode("utf-8", errors="replace")
        extractor = TextExtractor()
        extractor.feed(html)
        return extractor.get_text()
    except httpx.HTTPError as exc:
        return f"Error: fetch failed — {exc}"


def webFetchSync(url: str) -> str:
    """Synchronous wrapper used outside of tool context."""
    return webFetch.invoke({"url": url})
