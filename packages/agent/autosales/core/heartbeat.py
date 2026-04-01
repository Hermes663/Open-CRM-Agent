"""Heartbeat daemon that periodically processes active deals through the agent pipeline."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from autosales.core.orchestrator import route_deal, should_move_to_lost

if TYPE_CHECKING:
    from autosales.core.agent_runner import AgentRunner
    from autosales.integrations.supabase_client import SupabaseClient

logger = logging.getLogger("autosales.heartbeat")


class HeartbeatDaemon:
    """Periodically scans active deals and dispatches agent actions.

    The daemon runs on a configurable interval (default 30 minutes) using
    APScheduler. Each cycle fetches all active deals, consults the orchestrator
    for the next action, and executes that action via the agent runner.
    """

    def __init__(
        self,
        db: SupabaseClient,
        agent_runner: AgentRunner,
        interval_minutes: int = 30,
    ) -> None:
        self._db = db
        self._agent_runner = agent_runner
        self._interval_minutes = interval_minutes
        self._scheduler = AsyncIOScheduler()
        self._running = False

    async def run_cycle(self) -> dict[str, int]:
        """Execute one full heartbeat cycle.

        Returns:
            Summary dict with counts of deals processed, actions taken, and errors.
        """
        cycle_start = datetime.now(UTC)
        logger.info("[heartbeat] Cycle started at %s", cycle_start.isoformat())

        stats = {"deals_scanned": 0, "actions_taken": 0, "errors": 0}

        try:
            active_deals = await self._db.get_active_deals()
        except Exception:
            logger.exception("[heartbeat] Failed to fetch active deals")
            return stats

        stats["deals_scanned"] = len(active_deals)
        logger.info("[heartbeat] Found %d active deals", len(active_deals))

        for deal in active_deals:
            deal_id = deal.get("id", "unknown")
            try:
                activities = await self._db.get_activities(deal_id=deal_id, limit=20)
                pending_followups = await self._db.get_pending_followups(deal_id=deal_id)

                agent_name = route_deal(
                    deal=deal,
                    activities=activities,
                    pending_followups=pending_followups,
                )

                if should_move_to_lost(deal, pending_followups):
                    await self._db.update_deal(
                        deal_id,
                        {"stage": "lost", "lost_at": datetime.now(UTC)},
                    )
                    await self._db.create_activity(
                        deal_id=deal_id,
                        activity_type="deal_lost",
                        subject="Deal marked as lost after exhausted follow-up cadence",
                        metadata={"agent_name": "followup"},
                        created_by="heartbeat",
                    )
                    stats["actions_taken"] += 1
                    continue

                if agent_name is None:
                    logger.debug("[heartbeat] No action for deal %s", deal_id)
                    continue

                logger.info(
                    "[heartbeat] Dispatching agent '%s' for deal %s", agent_name, deal_id
                )
                result = await self._agent_runner.run(
                    agent_name=agent_name,
                    deal=deal,
                    context={"activities": activities, "pending_followups": pending_followups},
                )

                await self._db.create_agent_run(
                    deal_id=deal_id,
                    agent_name=agent_name,
                    action_taken=result.action_taken,
                    metadata={
                        **result.metadata,
                        "duration_ms": result.metadata.get("elapsed_ms"),
                        "output_summary": result.activity_log or result.action_taken,
                    },
                )

                stats["actions_taken"] += 1

            except Exception:
                logger.exception("[heartbeat] Error processing deal %s", deal_id)
                stats["errors"] += 1

        elapsed = (datetime.now(UTC) - cycle_start).total_seconds()
        logger.info(
            "[heartbeat] Cycle complete in %.1fs | scanned=%d actions=%d errors=%d",
            elapsed,
            stats["deals_scanned"],
            stats["actions_taken"],
            stats["errors"],
        )
        return stats

    def start(self) -> None:
        """Start the heartbeat scheduler."""
        if self._running:
            logger.warning("[heartbeat] Already running")
            return

        self._scheduler.add_job(
            self.run_cycle,
            "interval",
            minutes=self._interval_minutes,
            id="heartbeat_cycle",
            replace_existing=True,
        )
        self._scheduler.start()
        self._running = True
        logger.info(
            "[heartbeat] Started with interval=%d min", self._interval_minutes
        )

    def stop(self) -> None:
        """Stop the heartbeat scheduler."""
        if not self._running:
            return
        self._scheduler.shutdown(wait=False)
        self._running = False
        logger.info("[heartbeat] Stopped")

    @property
    def is_running(self) -> bool:
        return self._running
