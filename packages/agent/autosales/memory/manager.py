"""Memory manager -- assembles agent execution context from multiple sources."""

from __future__ import annotations

import logging
from typing import Any

from autosales.agents.base import AgentContext
from autosales.integrations.supabase_client import SupabaseClient
from autosales.memory.fts_search import search_history
from autosales.utils.paths import agent_config_dir

logger = logging.getLogger("autosales.memory")

# Context budget (characters) to avoid overrunning LLM token limits.
MAX_CONTEXT_CHARS = 80_000


class MemoryManager:
    """Builds rich execution context for agents by aggregating data from
    the database, conversation history, and static configuration files.
    """

    def __init__(self, db: SupabaseClient) -> None:
        self._db = db
        self._soul_cache: str | None = None
        self._knowledge_cache: str | None = None
        self._config_dir = agent_config_dir()

    async def build_context(
        self,
        deal_id: str,
        query: str | None = None,
    ) -> AgentContext:
        """Assemble everything an agent needs into an :class:`AgentContext`.

        Steps:
            1. Load the deal record.
            2. Load the associated customer / prospect.
            3. Load the last 10 messages for the deal.
            4. Optionally run a full-text search for ``query``.
            5. Load SOUL.md and KNOWLEDGE.md.
            6. Truncate to stay within the token budget.

        Args:
            deal_id: Primary key of the deal.
            query: Optional search query for relevant memories.

        Returns:
            Populated :class:`AgentContext`.
        """
        # 1. Deal
        deal = await self._db.get_deal(deal_id)
        if deal is None:
            logger.warning("[memory] Deal %s not found", deal_id)
            deal = {"id": deal_id}

        # 2. Customer
        customer_id = deal.get("prospect_id") or deal.get("customer_id")
        customer: dict[str, Any] | None = None
        if customer_id:
            customer = await self._db.get_prospect(customer_id)

        # 3. Recent messages
        messages = await self._db.get_activities(
            deal_id=deal_id,
            limit=10,
            activity_types=["email", "inbound_email", "reply"],
        )

        # 4. Memories (full-text search if query provided)
        memories: list[dict[str, Any]] = []
        if query:
            memories = await search_history(
                db=self._db,
                query=query,
                customer_id=customer_id,
                limit=10,
            )
        else:
            # Load all memories for the deal
            memories = await self._db.get_memories(deal_id=deal_id, limit=20)

        # 5. Static files
        soul = self._load_soul()
        knowledge = self._load_knowledge()

        # 6. Assemble and trim
        ctx = AgentContext(
            deal=deal,
            customer=customer,
            messages=messages,
            memories=memories,
            soul_prompt=soul,
            knowledge=knowledge,
        )
        self._trim_context(ctx)
        return ctx

    async def search_conversations(
        self,
        query: str,
        customer_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Public convenience wrapper around full-text search."""
        return await search_history(
            db=self._db,
            query=query,
            customer_id=customer_id,
            limit=10,
        )

    async def store_memory(
        self,
        deal_id: str,
        content: str,
        content_type: str,
    ) -> None:
        """Persist a memory entry for a deal."""
        await self._db.store_memory(
            deal_id=deal_id,
            content=content,
            content_type=content_type,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load_soul(self) -> str:
        if self._soul_cache is not None:
            return self._soul_cache
        try:
            self._soul_cache = (self._config_dir / "SOUL.md").read_text(encoding="utf-8")
        except FileNotFoundError:
            logger.debug("[memory] SOUL.md not found in %s", self._config_dir)
            self._soul_cache = ""
        return self._soul_cache

    def _load_knowledge(self) -> str:
        if self._knowledge_cache is not None:
            return self._knowledge_cache
        try:
            self._knowledge_cache = (self._config_dir / "KNOWLEDGE.md").read_text(
                encoding="utf-8"
            )
        except FileNotFoundError:
            logger.debug("[memory] KNOWLEDGE.md not found in %s", self._config_dir)
            self._knowledge_cache = ""
        return self._knowledge_cache

    @staticmethod
    def _trim_context(ctx: AgentContext) -> None:
        """Truncate context fields so total size stays within budget."""
        total = (
            len(str(ctx.deal))
            + len(str(ctx.customer or ""))
            + sum(len(str(m)) for m in ctx.messages)
            + sum(len(str(m)) for m in ctx.memories)
            + len(ctx.soul_prompt)
            + len(ctx.knowledge)
        )
        if total <= MAX_CONTEXT_CHARS:
            return

        # Trim knowledge first, then soul, then messages
        overshoot = total - MAX_CONTEXT_CHARS
        if len(ctx.knowledge) > 2000:
            trim_amount = min(overshoot, len(ctx.knowledge) - 2000)
            ctx.knowledge = ctx.knowledge[: len(ctx.knowledge) - trim_amount]
            overshoot -= trim_amount
        if overshoot > 0 and len(ctx.soul_prompt) > 1000:
            trim_amount = min(overshoot, len(ctx.soul_prompt) - 1000)
            ctx.soul_prompt = ctx.soul_prompt[: len(ctx.soul_prompt) - trim_amount]
            overshoot -= trim_amount
        if overshoot > 0 and ctx.messages:
            # Drop oldest messages
            while overshoot > 0 and len(ctx.messages) > 2:
                removed = ctx.messages.pop()
                overshoot -= len(str(removed))
