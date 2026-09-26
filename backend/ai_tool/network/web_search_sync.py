from __future__ import annotations

import logging

from exa_py import Exa

from systemconfig.websearch import WEB_SEARCH_API

logger = logging.getLogger(__name__)

_EXA_NUM_RESULTS = 5
_EXA_HIGHLIGHT_CHARS = 500


def webSearchSync(search_word: str) -> str:
    """Perform an Exa web search and return formatted results. Returns an error string if unconfigured."""
    if not WEB_SEARCH_API:
        return "Error: WEB_SEARCH_API is not configured"

    try:
        client = Exa(api_key=WEB_SEARCH_API)
        response = client.search_and_contents(
            search_word,
            num_results=_EXA_NUM_RESULTS,
            highlights={"num_sentences": 3, "highlights_per_url": 1},
            text={"max_characters": _EXA_HIGHLIGHT_CHARS},
        )
        lines: list[str] = []
        for result in response.results:
            title = getattr(result, "title", "") or ""
            url = getattr(result, "url", "") or ""
            highlight = ""
            highlights = getattr(result, "highlights", None)
            if highlights:
                highlight = highlights[0] if isinstance(highlights, list) else str(highlights)
            text = getattr(result, "text", "") or ""
            excerpt = (highlight or text)[:_EXA_HIGHLIGHT_CHARS]
            lines.append(f"Title: {title}\nURL: {url}\nExcerpt: {excerpt}\n")
        return "\n".join(lines) if lines else "No results found."
    except Exception as exc:
        logger.exception("webSearchSync failed")
        return f"Error: web search failed — {exc}"
