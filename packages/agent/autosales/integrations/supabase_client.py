"""Supabase / PostgreSQL data access layer for AutoSales."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

logger = logging.getLogger("autosales.integrations.supabase")


class SupabaseClient:
    """Thin wrapper around the Supabase Python client providing typed CRUD
    operations for deals, prospects, activities, agent runs, and memories.

    Configuration:
        SUPABASE_URL  -- project URL (e.g. https://xyz.supabase.co)
        SUPABASE_KEY  -- service-role or anon key
    """

    def __init__(self) -> None:
        self._url = os.environ.get("SUPABASE_URL", "")
        self._key = os.environ.get("SUPABASE_KEY", "")
        self._client: Any = None

    def _get_client(self) -> Any:
        """Lazy-initialise the Supabase client."""
        if self._client is None:
            from supabase import create_client

            self._client = create_client(self._url, self._key)
            logger.info("[supabase] Client initialised for %s", self._url)
        return self._client

    # ------------------------------------------------------------------
    # Deals
    # ------------------------------------------------------------------

    async def get_active_deals(self) -> list[dict[str, Any]]:
        """Fetch all deals that are not in a terminal stage."""
        client = self._get_client()
        resp = (
            client.table("deals")
            .select("*")
            .not_.is_("stage", "in.(won,lost)")
            .order("updated_at", desc=True)
            .execute()
        )
        return resp.data or []

    async def get_deal(self, deal_id: str) -> Optional[dict[str, Any]]:
        """Fetch a single deal by ID."""
        client = self._get_client()
        resp = client.table("deals").select("*").eq("id", deal_id).maybe_single().execute()
        return resp.data

    async def update_deal(self, deal_id: str, data: dict[str, Any]) -> None:
        """Update arbitrary fields on a deal."""
        client = self._get_client()
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        client.table("deals").update(data).eq("id", deal_id).execute()

    # ------------------------------------------------------------------
    # Prospects / Customers
    # ------------------------------------------------------------------

    async def get_prospect(self, prospect_id: str) -> Optional[dict[str, Any]]:
        """Fetch a prospect by ID."""
        client = self._get_client()
        resp = (
            client.table("prospects")
            .select("*")
            .eq("id", prospect_id)
            .maybe_single()
            .execute()
        )
        return resp.data

    # ------------------------------------------------------------------
    # Activities
    # ------------------------------------------------------------------

    async def get_activities(
        self,
        deal_id: str,
        limit: int = 20,
        activity_types: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch recent activities for a deal, newest first."""
        client = self._get_client()
        q = client.table("activities").select("*").eq("deal_id", deal_id)
        if activity_types:
            q = q.in_("activity_type", activity_types)
        resp = q.order("created_at", desc=True).limit(limit).execute()
        return resp.data or []

    async def create_activity(
        self,
        deal_id: str,
        activity_type: str,
        direction: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Insert a new activity row."""
        client = self._get_client()
        row = {
            "id": str(uuid4()),
            "deal_id": deal_id,
            "activity_type": activity_type,
            "direction": direction,
            "content": content,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.table("activities").insert(row).execute()
        return (resp.data or [{}])[0]

    async def search_activities_ilike(
        self,
        query: str,
        customer_id: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Fallback ILIKE search across activity content."""
        client = self._get_client()
        q = client.table("activities").select("*").ilike("content", f"%{query}%")
        if customer_id:
            q = q.eq("customer_id", customer_id)
        resp = q.order("created_at", desc=True).limit(limit).execute()
        return resp.data or []

    # ------------------------------------------------------------------
    # Follow-up queue
    # ------------------------------------------------------------------

    async def get_pending_followups(self, deal_id: str) -> list[dict[str, Any]]:
        """Fetch pending follow-up queue entries for a deal."""
        client = self._get_client()
        resp = (
            client.table("follow_up_queue")
            .select("*")
            .eq("deal_id", deal_id)
            .order("attempt", desc=True)
            .execute()
        )
        return resp.data or []

    async def upsert_followup(
        self,
        deal_id: str,
        attempt: int,
        status: str,
    ) -> None:
        """Insert or update a follow-up queue entry."""
        client = self._get_client()
        row = {
            "deal_id": deal_id,
            "attempt": attempt,
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        client.table("follow_up_queue").upsert(row, on_conflict="deal_id,attempt").execute()

    # ------------------------------------------------------------------
    # Agent runs
    # ------------------------------------------------------------------

    async def create_agent_run(
        self,
        deal_id: str,
        agent_name: str,
        action_taken: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Record an agent execution."""
        client = self._get_client()
        row = {
            "id": str(uuid4()),
            "deal_id": deal_id,
            "agent_name": agent_name,
            "action_taken": action_taken,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.table("agent_runs").insert(row).execute()
        return (resp.data or [{}])[0]

    # ------------------------------------------------------------------
    # Agent memory
    # ------------------------------------------------------------------

    async def get_memories(
        self,
        deal_id: str,
        limit: int = 20,
        content_type: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Retrieve agent_memory entries for a deal."""
        client = self._get_client()
        q = client.table("agent_memory").select("*").eq("deal_id", deal_id)
        if content_type:
            q = q.eq("content_type", content_type)
        resp = q.order("created_at", desc=True).limit(limit).execute()
        return resp.data or []

    async def store_memory(
        self,
        deal_id: str,
        content: str,
        content_type: str,
    ) -> dict[str, Any]:
        """Persist a memory entry."""
        client = self._get_client()
        row = {
            "id": str(uuid4()),
            "deal_id": deal_id,
            "content": content,
            "content_type": content_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.table("agent_memory").insert(row).execute()
        return (resp.data or [{}])[0]

    # ------------------------------------------------------------------
    # RPC (for full-text search)
    # ------------------------------------------------------------------

    async def rpc(self, function_name: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Call a Supabase Edge Function / PostgreSQL RPC."""
        client = self._get_client()
        resp = client.rpc(function_name, params).execute()
        return resp.data or []
