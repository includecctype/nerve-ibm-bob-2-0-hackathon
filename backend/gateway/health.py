from __future__ import annotations

import json
from typing import Any

HEALTH_BODY = json.dumps({"status": "ok"}).encode("utf-8")


async def healthApp(scope: dict[str, Any], receive: Any, send: Any) -> None:
    """ASGI app mounted behind the Socket.IO middleware as other_asgi_app.

    Serves GET /health for load-balancer and container probes, returns 404
    for any other HTTP path, and completes the lifespan handshake that
    python-engineio forwards here when other_asgi_app is configured.
    """
    if scope["type"] == "lifespan":
        while True:
            message = await receive()
            if message["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif message["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return
    elif scope["type"] == "http":
        if scope["method"] == "GET" and scope["path"] == "/health":
            status, body, headers = 200, HEALTH_BODY, [(b"content-type", b"application/json")]
        elif scope["path"] == "/health":
            status, body, headers = 405, b"", [(b"allow", b"GET")]
        else:
            status, body, headers = 404, b"", []
        headers.append((b"content-length", str(len(body)).encode("ascii")))
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})
