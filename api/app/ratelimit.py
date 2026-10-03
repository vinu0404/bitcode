"""In-process sliding-window rate limiter, per user per endpoint class.

No Redis in V1 (see plan); a single-process API on a free-tier host has
no need for a distributed limiter, and this resets cleanly on every
restart, which is the right failure mode here.
"""

import threading
import time
from collections import defaultdict
from uuid import UUID

from fastapi import Depends

from app.deps import get_current_user
from app.errors import AppError
from app.models.user import User

_WINDOW_SECONDS = 60
_lock = threading.Lock()
_hits: dict[tuple[str, UUID], list[float]] = defaultdict(list)


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"


def _check(bucket: str, user_id: UUID, limit: int) -> None:
    now = time.monotonic()
    key = (bucket, user_id)
    with _lock:
        recent = [t for t in _hits[key] if now - t < _WINDOW_SECONDS]
        if len(recent) >= limit:
            _hits[key] = recent
            wait = max(1, int(_WINDOW_SECONDS - (now - min(recent))) + 1)
            raise RateLimitedError(f"That is {limit} in a minute. Try again in {wait}s.", retry_after=wait)
        recent.append(now)
        _hits[key] = recent


def rate_limit(bucket: str, limit: int):
    def _dep(user: User = Depends(get_current_user)) -> None:
        _check(bucket, user.id, limit)

    return _dep
