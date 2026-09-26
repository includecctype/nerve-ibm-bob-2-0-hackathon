"""Web tools — the only research tools that stay on the backend.

They talk to the network (and the hosted search API key) and never touch disk.
"""

from __future__ import annotations

import asyncio
from html.parser import HTMLParser

import httpx
from langchain_core.tools import tool

from ai_tool.network.web_search_sync import webSearchSync
from systemconfig.limits import (
    TOOL_TIMEOUT_SECONDS,
    WEB_FETCH_MAX_BYTES,
    WEB_FETCH_TIMEOUT_SECONDS,
)
from systemconfig.websearch import WEB_SEARCH_API


@tool
async def webSearch(search_word: str) -> str:
    """Search the internet for more information.

    Returns numbered results with URLs — cite URLs in answers.
    On no results, rephrase the query once; on error, report it and continue.

    Args:
        search_word: The keyword or sentence to search
    """
    if not WEB_SEARCH_API:
        return "Error: WEB_SEARCH_API is not configured"

    try:
        return await asyncio.wait_for(
            asyncio.to_thread(webSearchSync, search_word),
            timeout=TOOL_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        return f"Search error: timed out after {TOOL_TIMEOUT_SECONDS}s"
    except Exception as e:  # noqa: BLE001
        return f"Search error: {e}"


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.skip_depth = 0
        self.chunks: list[str] = []

    def handle_starttag(self, tag, attrs) -> None:
        if tag in ("script", "style", "noscript"):
            self.skip_depth += 1

    def handle_endtag(self, tag) -> None:
        if self.skip_depth > 0:
            self.skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.skip_depth == 0 and data.strip():
            self.chunks.append(data.strip())

    def text(self) -> str:
        return "\n".join(self.chunks)


def webFetchSync(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        return "Error: url must start with http:// or https://"

    with httpx.Client(
        timeout=WEB_FETCH_TIMEOUT_SECONDS,
        follow_redirects=True,
        headers={"User-Agent": "nerve/1.0"},
    ) as client:
        response = client.get(url)
        response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        raw = response.content[:WEB_FETCH_MAX_BYTES]

        if "html" in content_type or url.rstrip("/").endswith((".html", ".htm")):
            parser = TextExtractor()
            parser.feed(raw.decode("utf-8", errors="replace"))
            text = parser.text()
        else:
            text = raw.decode("utf-8", errors="replace")

        text = text.strip()
        if not text:
            return "Fetched URL but got empty content"
        if len(response.content) > WEB_FETCH_MAX_BYTES:
            text += f"\n... [truncated at {WEB_FETCH_MAX_BYTES} bytes]"
        return text


@tool
async def webFetch(url: str) -> str:
    """Fetch a URL and return its content as plain text.

    HTML is converted to rough text (tags/scripts stripped). Cite the URL in answers.
    On error, report it and continue.

    Args:
        url: Full URL to fetch (http or https)
    """
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(webFetchSync, url),
            timeout=TOOL_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        return f"Fetch error: timed out after {TOOL_TIMEOUT_SECONDS}s"
    except Exception as e:  # noqa: BLE001
        return f"Fetch error: {e}"
