"""Pure-Python decision tree that routes deals to the appropriate agent.

The orchestrator inspects a deal's current stage, associated activities, and
pending follow-ups to decide which agent (if any) should act next.  No LLM
calls happen here -- this is deterministic logic.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger("autosales.orchestrator")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_FOLLOWUP_ATTEMPTS = 3
DAYS_BEFORE_FOLLOWUP = 5


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def route_deal(
    deal: dict[str, Any],
    activities: list[dict[str, Any]],
    pending_followups: list[dict[str, Any]],
) -> Optional[str]:
    """Determine the next agent to run for a deal.

    Args:
        deal: The deal record (dict with at least ``stage`` and ``id``).
        activities: Recent activity rows for this deal.
        pending_followups: Rows from the follow_up_queue for this deal.

    Returns:
        Agent name string or ``None`` if no action is needed.
    """
    stage: str = deal.get("stage", "").lower().replace(" ", "_")
    deal_id = deal.get("id", "?")

    logger.debug("[orchestrator] Evaluating deal %s (stage=%s)", deal_id, stage)

    # -- new_deal -------------------------------------------------------
    if stage == "new_deal":
        if not has_research(activities):
            return "research"
        return "qualifier"

    # -- first_email ----------------------------------------------------
    if stage == "first_email":
        if has_customer_reply(activities):
            return "qualifier"
        days = days_since_last_activity(activities)
        if days is not None and days >= DAYS_BEFORE_FOLLOWUP:
            return "followup"
        return None

    # -- qualifying -----------------------------------------------------
    if stage == "qualifying":
        if has_customer_reply(activities):
            return "qualifier"
        return None

    # -- follow_up ------------------------------------------------------
    if stage == "follow_up":
        if has_customer_reply(activities):
            return "qualifier"
        attempts = _followup_attempt_count(pending_followups)
        if attempts >= MAX_FOLLOWUP_ATTEMPTS:
            logger.info("[orchestrator] Deal %s exhausted follow-ups -> lost", deal_id)
            return None  # caller should move to lost
        return "followup"

    # -- negotiation (stub) ---------------------------------------------
    if stage == "negotiation":
        return "pricer"

    # -- closing (stub) -------------------------------------------------
    if stage == "closing":
        return "closer"

    # -- won / lost / unknown -------------------------------------------
    logger.debug("[orchestrator] No action for stage '%s'", stage)
    return None


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def has_research(activities: list[dict[str, Any]]) -> bool:
    """Return True if any activity is a completed research entry."""
    return any(
        a.get("activity_type") == "research" and a.get("status") == "completed"
        for a in activities
    )


def has_customer_reply(activities: list[dict[str, Any]]) -> bool:
    """Return True if the latest non-agent activity is an inbound email."""
    for a in activities:
        direction = a.get("direction", "").lower()
        activity_type = a.get("activity_type", "").lower()
        if direction == "inbound" or activity_type in ("reply", "inbound_email"):
            return True
    return False


def days_since_last_activity(activities: list[dict[str, Any]]) -> Optional[float]:
    """Return the number of days since the most recent activity, or None."""
    if not activities:
        return None

    latest_str = activities[0].get("created_at") or activities[0].get("timestamp")
    if latest_str is None:
        return None

    try:
        if isinstance(latest_str, str):
            # Support both Z-suffix and +00:00
            latest_str = latest_str.replace("Z", "+00:00")
            latest = datetime.fromisoformat(latest_str)
        else:
            latest = latest_str  # already a datetime

        if latest.tzinfo is None:
            latest = latest.replace(tzinfo=timezone.utc)

        delta = datetime.now(timezone.utc) - latest
        return delta.total_seconds() / 86400.0
    except (ValueError, TypeError):
        logger.warning("[orchestrator] Could not parse activity timestamp: %s", latest_str)
        return None


def _followup_attempt_count(pending_followups: list[dict[str, Any]]) -> int:
    """Return the maximum attempt number across pending follow-ups."""
    if not pending_followups:
        return 0
    return max((f.get("attempt", 0) for f in pending_followups), default=0)


def should_move_to_lost(
    deal: dict[str, Any],
    pending_followups: list[dict[str, Any]],
) -> bool:
    """Check whether a deal should be moved to the 'lost' stage."""
    stage = deal.get("stage", "").lower().replace(" ", "_")
    if stage != "follow_up":
        return False
    return _followup_attempt_count(pending_followups) >= MAX_FOLLOWUP_ATTEMPTS
