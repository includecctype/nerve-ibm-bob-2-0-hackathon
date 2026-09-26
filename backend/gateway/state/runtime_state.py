from __future__ import annotations

import asyncio

# Per-sid asyncio locks — one lock per connected session
sid_locks: dict[str, asyncio.Lock] = {}

# Per-sid execution locks — prevent concurrent executeCurrentTask calls
exec_locks: dict[str, asyncio.Lock] = {}

# Error bounce counters — count consecutive give-up bounces per sid
error_bounce_count: dict[str, int] = {}

# Error cooldown timestamps — suppress a repeated (sid, message) within the window
error_cooldown: dict[tuple[str, str], float] = {}
