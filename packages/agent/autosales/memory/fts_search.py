"""Full-text search using PostgreSQL tsvector via the Supabase client."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from autosales.integrations.supabase_client import SupabaseClient

logger = logging.getLogger("autosales.memory.fts")


async def search_history(
    db: SupabaseClient,
    query: str,
    customer_id: Optional[str] = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Search conversation history and memories using PostgreSQL full-text search.

    This function calls a Supabase RPC that runs a ``to_tsquery`` search
    against the ``activities`` and ``agent_memory`` tables.

    Args:
        db: The Supabase client instance.
        query: Natural-language search query.
        customer_id: Optional filter to scope results to a single customer.
        limit: Maximum number of results.

    Returns:
        List of matching records ordered by relevance.
    """
    if not query.strip():
        return []

    # Convert natural language to tsquery-compatible format.
    ts_query = _to_tsquery(query)

    try:
        results = await db.rpc(
            "search_activities",
            {
                "search_query": ts_query,
                "customer_filter": customer_id,
                "max_results": limit,
            },
        )
        return results or []
    except Exception:
        logger.exception("[fts] Full-text search failed for query: %s", query)
        # Fallback: simple ILIKE search
        return await _fallback_search(db, query, customer_id, limit)


async def _fallback_search(
    db: SupabaseClient,
    query: str,
    customer_id: Optional[str],
    limit: int,
) -> list[dict[str, Any]]:
    """Simple ILIKE fallback when the RPC is unavailable."""
    try:
        return await db.search_activities_ilike(
            query=query,
            customer_id=customer_id,
            limit=limit,
        )
    except Exception:
        logger.exception("[fts] Fallback search also failed")
        return []


def _to_tsquery(text: str) -> str:
    """Convert a plain-text query into a PostgreSQL ``to_tsquery`` string.

    Splits on whitespace, joins with ``&`` (AND), and wraps each token with
    ``:*`` for prefix matching.

    Example:
        ``"sales pipeline"`` -> ``"sales:* & pipeline:*"``
    """
    tokens = text.strip().split()
    if not tokens:
        return ""
    return " & ".join(f"{t}:*" for t in tokens if t)
