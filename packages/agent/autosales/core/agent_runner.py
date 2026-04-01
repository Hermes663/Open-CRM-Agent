"""Agent runner -- loads, configures, and executes agent instances."""

from __future__ import annotations

import importlib
import logging
import time
from typing import Any

from autosales.agents.base import AgentResult, BaseAgent
from autosales.channels.base import BaseChannel
from autosales.integrations.supabase_client import SupabaseClient
from autosales.memory.manager import MemoryManager

logger = logging.getLogger("autosales.agent_runner")

# Map of agent names to their module paths and class names.
AGENT_REGISTRY: dict[str, tuple[str, str]] = {
    "research": ("autosales.agents.research", "ResearchAgent"),
    "qualifier": ("autosales.agents.qualifier", "QualifierAgent"),
    "followup": ("autosales.agents.followup", "FollowupAgent"),
    # Stubs for future agents:
    # "pricer": ("autosales.agents.pricer", "PricerAgent"),
    # "closer": ("autosales.agents.closer", "CloserAgent"),
}


class AgentRunner:
    """Orchestrates the lifecycle of a single agent execution.

    Responsibilities:
      1. Dynamically load the requested agent class.
      2. Build the execution context via MemoryManager.
      3. Call ``agent.execute(context)``.
      4. Persist the activity log and agent run to the database.
    """

    def __init__(self, db: SupabaseClient, memory: MemoryManager) -> None:
        self._db = db
        self._memory = memory
        self._agent_cache: dict[str, BaseAgent] = {}
        self._channel: BaseChannel | None = None

    def set_channel(self, channel: BaseChannel | None) -> None:
        """Inject the currently configured email channel into future agent instances."""
        self._channel = channel
        for agent in self._agent_cache.values():
            agent._channel = channel

    async def run(
        self,
        agent_name: str,
        deal: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> AgentResult:
        """Run a named agent for the given deal.

        Args:
            agent_name: Key in ``AGENT_REGISTRY``.
            deal: Deal record dict (must contain ``id``).
            context: Optional extra context (activities, followups, etc.).

        Returns:
            AgentResult produced by the agent.

        Raises:
            ValueError: If the agent name is not registered.
        """
        deal_id = deal.get("id", "unknown")
        logger.info("[runner] Starting agent '%s' for deal %s", agent_name, deal_id)
        t0 = time.monotonic()

        # 1. Load agent
        agent = self._load_agent(agent_name)

        # 2. Build context
        agent_context = await self._memory.build_context(deal_id=deal_id)

        # Merge any extra runtime context
        if context:
            agent_context.metadata = {**(agent_context.metadata or {}), **context}

        # 3. Execute
        try:
            result = await agent.execute(agent_context)
        except Exception:
            logger.exception("[runner] Agent '%s' failed for deal %s", agent_name, deal_id)
            result = AgentResult(
                action_taken="error",
                activity_log=f"Agent '{agent_name}' raised an exception",
                metadata={"error": True},
            )

        # 4. Persist activity
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        try:
            activity_type = self._activity_type_for_result(agent_name, result)
            await self._db.create_activity(
                deal_id=deal_id,
                activity_type=activity_type,
                subject=result.activity_log or result.action_taken,
                body=result.email_sent.get("body") if result.email_sent else None,
                metadata={**(result.metadata or {}), "agent_name": agent_name},
                created_by=f"{agent_name}-agent",
            )
        except Exception:
            logger.exception("[runner] Failed to persist activity for deal %s", deal_id)

        logger.info(
            "[runner] Agent '%s' completed for deal %s in %dms | action=%s",
            agent_name,
            deal_id,
            elapsed_ms,
            result.action_taken,
        )
        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load_agent(self, agent_name: str) -> BaseAgent:
        """Dynamically import and cache an agent instance."""
        if agent_name in self._agent_cache:
            return self._agent_cache[agent_name]

        if agent_name not in AGENT_REGISTRY:
            raise ValueError(
                f"Unknown agent '{agent_name}'. Registered: {list(AGENT_REGISTRY.keys())}"
            )

        module_path, class_name = AGENT_REGISTRY[agent_name]
        module = importlib.import_module(module_path)
        cls = getattr(module, class_name)

        instance: BaseAgent = cls(db=self._db, channel=self._channel)
        self._agent_cache[agent_name] = instance
        logger.debug("[runner] Loaded agent class %s.%s", module_path, class_name)
        return instance

    @staticmethod
    def _activity_type_for_result(agent_name: str, result: AgentResult) -> str:
        if agent_name == "research":
            return "research_completed"
        if agent_name == "followup" and result.email_sent:
            return "follow_up_sent"
        if result.email_sent:
            return "email_sent"
        return "agent_decision"
