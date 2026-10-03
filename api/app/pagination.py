"""Shared offset/limit pagination.

Offset/limit, not keyset/cursor; deliberately. Cursor pagination earns its
complexity on a high-churn, insert-heavy feed where "page 2" can shift
under a reader between requests (a social timeline, a log stream). The
problem catalog is the opposite shape: small, admin-curated, ordered by an
explicit `order_index` a human set on purpose. Offset/limit is the right
tool for "page through a stable, curated list," not a workaround for
skipping cursor pagination.
"""

from dataclasses import dataclass

from fastapi import Query

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


@dataclass
class Pagination:
    limit: int
    offset: int


def pagination(limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT), offset: int = Query(0, ge=0)) -> Pagination:
    return Pagination(limit=limit, offset=offset)
