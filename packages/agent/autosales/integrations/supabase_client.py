"""PostgreSQL data access layer for AutoSales.

The class keeps the historical name ``SupabaseClient`` for backward
compatibility, but it now talks directly to PostgreSQL through
``DATABASE_URL`` and the canonical SQL schema defined in ``supabase/migrations``.
"""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from psycopg2 import pool
from psycopg2.extras import Json, RealDictCursor

logger = logging.getLogger("autosales.integrations.postgres")


class SupabaseClient:
    """Thin async wrapper around PostgreSQL queries used by the app."""

    def __init__(self) -> None:
        self._dsn = os.environ.get("DATABASE_URL", "")
        self._pool: pool.ThreadedConnectionPool | None = None
        self._max_connections = int(os.environ.get("DB_MAX_CONNECTIONS", "8"))

    async def get_active_deals(self) -> list[dict[str, Any]]:
        sql = """
            SELECT *
            FROM deals
            WHERE stage NOT IN ('won', 'lost')
            ORDER BY updated_at DESC
        """
        return await self._fetch_all(sql)

    async def get_deal(self, deal_id: str) -> dict[str, Any] | None:
        sql = """
            SELECT *
            FROM deals
            WHERE id = %s
            LIMIT 1
        """
        return await self._fetch_one(sql, (deal_id,))

    async def update_deal(self, deal_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        if not data:
            return await self.get_deal(deal_id)

        payload = dict(data)
        payload["updated_at"] = payload.get("updated_at") or datetime.now(UTC)

        assignments: list[str] = []
        values: list[Any] = []
        for key, value in payload.items():
            assignments.append(f"{key} = %s")
            values.append(self._adapt_value(value))

        values.append(deal_id)
        sql = f"""
            UPDATE deals
            SET {", ".join(assignments)}
            WHERE id = %s
            RETURNING *
        """
        return await self._fetch_one(sql, tuple(values))

    async def get_prospect(self, prospect_id: str) -> dict[str, Any] | None:
        sql = """
            SELECT
                customer_id,
                email,
                first_name,
                surname,
                company_name,
                company_research,
                phone,
                country,
                language,
                notes,
                CONCAT_WS(' ', first_name, surname) AS full_name
            FROM prospects_data
            WHERE customer_id = %s
            LIMIT 1
        """
        row = await self._fetch_one(sql, (prospect_id,))
        if not row:
            return None
        row["id"] = row["customer_id"]
        row["name"] = row["full_name"]
        row["company"] = row["company_name"]
        row["research_summary"] = row.get("company_research")
        return row

    async def get_deal_by_contact_email(self, email: str) -> dict[str, Any] | None:
        sql = """
            SELECT *
            FROM deals
            WHERE LOWER(contact_email) = LOWER(%s)
            ORDER BY updated_at DESC
            LIMIT 1
        """
        return await self._fetch_one(sql, (email,))

    async def get_activities(
        self,
        deal_id: str,
        limit: int = 20,
        activity_types: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        params: list[Any] = [deal_id]
        filters = ["deal_id = %s"]
        if activity_types:
            filters.append("activity_type = ANY(%s)")
            params.append(activity_types)
        params.append(limit)
        sql = f"""
            SELECT *
            FROM activities
            WHERE {" AND ".join(filters)}
            ORDER BY created_at DESC
            LIMIT %s
        """
        rows = await self._fetch_all(sql, tuple(params))
        return [self._normalize_activity(row) for row in rows]

    async def create_activity(
        self,
        deal_id: str,
        activity_type: str,
        subject: str | None = None,
        body: str | None = None,
        metadata: dict[str, Any] | None = None,
        created_by: str = "agent",
        customer_id: str | None = None,
    ) -> dict[str, Any]:
        sql = """
            INSERT INTO activities (
                id,
                deal_id,
                customer_id,
                activity_type,
                subject,
                body,
                metadata,
                created_by,
                created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            RETURNING *
        """
        row = await self._fetch_one(
            sql,
            (
                str(uuid4()),
                deal_id,
                customer_id,
                activity_type,
                subject,
                body,
                Json(metadata or {}),
                created_by,
            ),
        )
        return self._normalize_activity(row or {})

    async def search_activities_ilike(
        self,
        query: str,
        customer_id: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        sql = """
            SELECT *
            FROM activities
            WHERE (
                COALESCE(subject, '') || ' ' || COALESCE(body, '')
            ) ILIKE %s
            AND (%s::uuid IS NULL OR customer_id = %s::uuid)
            ORDER BY created_at DESC
            LIMIT %s
        """
        rows = await self._fetch_all(
            sql,
            (f"%{query}%", customer_id, customer_id, limit),
        )
        return [self._normalize_activity(row) for row in rows]

    async def get_pending_followups(self, deal_id: str) -> list[dict[str, Any]]:
        sql = """
            SELECT *
            FROM follow_up_queue
            WHERE deal_id = %s
            ORDER BY attempt DESC, scheduled_at ASC
        """
        return await self._fetch_all(sql, (deal_id,))

    async def upsert_followup(
        self,
        deal_id: str,
        attempt: int,
        status: str,
        scheduled_at: datetime | None = None,
        template_id: str | None = None,
    ) -> dict[str, Any]:
        sql = """
            INSERT INTO follow_up_queue (
                id,
                customer_id,
                deal_id,
                scheduled_at,
                template_id,
                status,
                sent_at,
                created_at,
                attempt,
                updated_at
            )
            VALUES (
                %s,
                (SELECT customer_id FROM deals WHERE id = %s),
                %s,
                COALESCE(%s, NOW()),
                %s,
                %s,
                CASE WHEN %s = 'sent' THEN NOW() ELSE NULL END,
                NOW(),
                %s,
                NOW()
            )
            ON CONFLICT (deal_id, attempt) DO UPDATE
            SET status = EXCLUDED.status,
                template_id = COALESCE(EXCLUDED.template_id, follow_up_queue.template_id),
                scheduled_at = COALESCE(follow_up_queue.scheduled_at, EXCLUDED.scheduled_at),
                sent_at = CASE
                    WHEN EXCLUDED.status = 'sent' THEN NOW()
                    ELSE follow_up_queue.sent_at
                END,
                updated_at = NOW()
            RETURNING *
        """
        return await self._fetch_one(
            sql,
            (
                str(uuid4()),
                deal_id,
                deal_id,
                scheduled_at,
                template_id,
                status,
                status,
                attempt,
            ),
        ) or {}

    async def create_agent_run(
        self,
        deal_id: str,
        agent_name: str,
        action_taken: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = metadata or {}
        status = payload.get("status") or ("failed" if payload.get("error") else "completed")
        sql = """
            INSERT INTO agent_runs (
                id,
                run_type,
                agent_name,
                deal_id,
                status,
                input_summary,
                output_summary,
                tokens_used,
                cost_usd,
                duration_ms,
                error_message,
                started_at,
                completed_at
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                COALESCE(%s, NOW()),
                NOW()
            )
            RETURNING *
        """
        return await self._fetch_one(
            sql,
            (
                str(uuid4()),
                payload.get("run_type", "heartbeat"),
                agent_name,
                deal_id,
                status,
                payload.get("input_summary"),
                payload.get("output_summary") or action_taken,
                payload.get("tokens_used"),
                payload.get("cost_usd"),
                payload.get("duration_ms") or payload.get("elapsed_ms"),
                payload.get("error_message"),
                payload.get("started_at"),
            ),
        ) or {}

    async def get_memories(
        self,
        deal_id: str,
        limit: int = 20,
        content_type: str | None = None,
    ) -> list[dict[str, Any]]:
        params: list[Any] = [deal_id]
        filters = ["deal_id = %s"]
        if content_type:
            filters.append("content_type = %s")
            params.append(content_type)
        params.append(limit)
        sql = f"""
            SELECT *
            FROM agent_memory
            WHERE {" AND ".join(filters)}
            ORDER BY created_at DESC
            LIMIT %s
        """
        return await self._fetch_all(sql, tuple(params))

    async def store_memory(
        self,
        deal_id: str,
        content: str,
        content_type: str,
    ) -> dict[str, Any]:
        sql = """
            INSERT INTO agent_memory (
                id,
                deal_id,
                customer_id,
                content,
                content_type,
                metadata,
                created_at
            )
            VALUES (
                %s,
                %s,
                (SELECT customer_id FROM deals WHERE id = %s),
                %s,
                %s,
                %s,
                NOW()
            )
            RETURNING *
        """
        return await self._fetch_one(
            sql,
            (
                str(uuid4()),
                deal_id,
                deal_id,
                content,
                content_type,
                Json({}),
            ),
        ) or {}

    async def search_crm_text(
        self,
        query: str,
        customer_id: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        sql = """
            WITH activity_hits AS (
                SELECT
                    id,
                    deal_id,
                    customer_id,
                    activity_type AS source_type,
                    subject,
                    body AS content,
                    metadata,
                    created_at,
                    ts_rank(
                        to_tsvector('simple', COALESCE(subject, '') || ' ' || COALESCE(body, '')),
                        to_tsquery('simple', %s)
                    ) AS score
                FROM activities
                WHERE to_tsvector('simple', COALESCE(subject, '') || ' ' || COALESCE(body, ''))
                    @@ to_tsquery('simple', %s)
                  AND (%s::uuid IS NULL OR customer_id = %s::uuid)
            ),
            memory_hits AS (
                SELECT
                    id,
                    deal_id,
                    customer_id,
                    content_type AS source_type,
                    NULL::text AS subject,
                    content,
                    metadata,
                    created_at,
                    ts_rank(
                        to_tsvector('simple', COALESCE(content, '')),
                        to_tsquery('simple', %s)
                    ) AS score
                FROM agent_memory
                WHERE to_tsvector('simple', COALESCE(content, ''))
                    @@ to_tsquery('simple', %s)
                  AND (%s::uuid IS NULL OR customer_id = %s::uuid)
            )
            SELECT *
            FROM (
                SELECT * FROM activity_hits
                UNION ALL
                SELECT * FROM memory_hits
            ) hits
            ORDER BY score DESC, created_at DESC
            LIMIT %s
        """
        return await self._fetch_all(
            sql,
            (
                query,
                query,
                customer_id,
                customer_id,
                query,
                query,
                customer_id,
                customer_id,
                limit,
            ),
        )

    async def rpc(self, function_name: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        if function_name == "search_activities":
            return await self.search_crm_text(
                query=params.get("search_query", ""),
                customer_id=params.get("customer_filter"),
                limit=params.get("max_results", 10),
            )
        raise NotImplementedError(f"Unsupported RPC call: {function_name}")

    async def _fetch_all(
        self,
        sql: str,
        params: Iterable[Any] | None = None,
    ) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._fetch_all_sync, sql, tuple(params or ()))

    async def _fetch_one(
        self,
        sql: str,
        params: Iterable[Any] | None = None,
    ) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._fetch_one_sync, sql, tuple(params or ()))

    def _fetch_all_sync(
        self,
        sql: str,
        params: tuple[Any, ...],
    ) -> list[dict[str, Any]]:
        conn = self._get_pool().getconn()
        try:
            with conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(sql, params)
                rows = cursor.fetchall()
                return [self._normalize_record(dict(row)) for row in rows]
        finally:
            self._get_pool().putconn(conn)

    def _fetch_one_sync(
        self,
        sql: str,
        params: tuple[Any, ...],
    ) -> dict[str, Any] | None:
        conn = self._get_pool().getconn()
        try:
            with conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(sql, params)
                row = cursor.fetchone()
                if row is None:
                    return None
                return self._normalize_record(dict(row))
        finally:
            self._get_pool().putconn(conn)

    def _get_pool(self) -> pool.ThreadedConnectionPool:
        if not self._dsn:
            raise RuntimeError("DATABASE_URL is required to use the backend data layer.")
        if self._pool is None:
            self._pool = pool.ThreadedConnectionPool(
                1,
                max(2, self._max_connections),
                dsn=self._dsn,
            )
            logger.info("[postgres] Connection pool initialised")
        return self._pool

    @staticmethod
    def _adapt_value(value: Any) -> Any:
        if isinstance(value, dict):
            return Json(value)
        return value

    @staticmethod
    def _normalize_record(record: dict[str, Any]) -> dict[str, Any]:
        for key, value in list(record.items()):
            if isinstance(value, datetime):
                record[key] = value.isoformat()
        return record

    def _normalize_activity(self, row: dict[str, Any]) -> dict[str, Any]:
        if not row:
            return row
        metadata = row.get("metadata") or {}
        created_by = row.get("created_by", "")
        row["metadata"] = metadata
        row["description"] = row.get("subject") or self._default_activity_subject(row)
        row["content"] = row.get("body") or row.get("subject") or ""
        row["direction"] = self._activity_direction(row.get("activity_type", ""))
        row["agent_name"] = self._normalize_agent_name(created_by, metadata)
        return row

    @staticmethod
    def _activity_direction(activity_type: str) -> str:
        if activity_type in {"email_received", "call_received"}:
            return "inbound"
        if activity_type in {"email_sent", "follow_up_sent", "quote_sent", "call_made"}:
            return "outbound"
        return "internal"

    @staticmethod
    def _normalize_agent_name(created_by: str, metadata: dict[str, Any]) -> str | None:
        candidate = metadata.get("agent_name") or created_by
        if not candidate:
            return None
        lowered = str(candidate).lower()
        if "research" in lowered:
            return "research"
        if "qualifier" in lowered:
            return "qualifier"
        if "follow" in lowered:
            return "followup"
        if "human" in lowered:
            return "human"
        return lowered

    @staticmethod
    def _default_activity_subject(row: dict[str, Any]) -> str:
        activity_type = row.get("activity_type", "note_added")
        defaults = {
            "email_sent": "Outbound email",
            "email_received": "Inbound email",
            "research_completed": "Research completed",
            "stage_changed": "Stage changed",
            "deal_created": "Deal created",
            "follow_up_sent": "Follow-up sent",
            "agent_decision": "Agent decision",
            "note_added": "Note added",
            "human_responded": "Human response",
            "escalated_to_human": "Escalated to human",
            "quote_sent": "Quote sent",
            "quote_accepted": "Quote accepted",
            "quote_rejected": "Quote rejected",
        }
        return defaults.get(activity_type, activity_type.replace("_", " ").title())
