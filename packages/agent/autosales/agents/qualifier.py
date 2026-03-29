"""Qualifier agent -- generates personalised first emails and qualification responses."""

from __future__ import annotations

import json
import logging
from typing import Any

from autosales.agents.base import AgentContext, AgentResult, BaseAgent
from autosales.integrations.supabase_client import SupabaseClient
from autosales.utils.llm import LLMClient
from autosales.utils.templates import EmailTemplateEngine

logger = logging.getLogger("autosales.agents.qualifier")

_QUALIFIER_SYSTEM_PROMPT = """\
You are an expert B2B sales development representative.
Your job is to write a highly personalised, concise email that:
1. References specific research about the prospect's company.
2. Connects their likely pain points to our solution.
3. Includes a clear, low-friction call to action.
4. Keeps the tone professional yet conversational.

Return ONLY a JSON object:
{
  "subject": "...",
  "body": "...",
  "reasoning": "..."
}
"""


class QualifierAgent(BaseAgent):
    """Generates personalised outreach or follow-up qualification emails."""

    def __init__(self, db: SupabaseClient) -> None:
        self._db = db
        self._llm = LLMClient()
        self._templates = EmailTemplateEngine()

    @property
    def name(self) -> str:
        return "qualifier"

    @property
    def description(self) -> str:
        return "Generates personalised first email or qualification response"

    async def execute(self, context: AgentContext) -> AgentResult:
        """Compose and send a personalised qualification email.

        Uses conversation history and research data for personalisation.
        """
        deal = context.deal
        customer = context.customer or {}
        deal_id = deal.get("id", "unknown")
        contact_email = customer.get("email") or deal.get("email", "")
        contact_name = customer.get("name") or deal.get("contact_name", "Unknown")

        if not contact_email:
            logger.warning("[qualifier] No email address for deal %s", deal_id)
            return AgentResult(
                action_taken="skipped",
                activity_log="No contact email available",
            )

        # Build the LLM prompt with all available context
        research_memories = [
            m for m in context.memories if m.get("content_type") == "research"
        ]
        conversation_summary = self._summarise_messages(context.messages)

        user_message = (
            f"Contact: {contact_name} ({contact_email})\n"
            f"Company: {customer.get('company', 'Unknown')}\n"
            f"Deal stage: {deal.get('stage', 'unknown')}\n\n"
            f"--- Research ---\n{json.dumps(research_memories, default=str)}\n\n"
            f"--- Conversation so far ---\n{conversation_summary}\n\n"
            f"--- Brand voice ---\n{context.soul_prompt[:2000]}\n\n"
            f"--- Product knowledge ---\n{context.knowledge[:2000]}\n\n"
            "Write the next email to send to this prospect."
        )

        try:
            raw = await self._llm.call(
                system_prompt=_QUALIFIER_SYSTEM_PROMPT,
                user_message=user_message,
                json_mode=True,
            )
            email_data = self._parse_email(raw)
        except Exception:
            logger.exception("[qualifier] LLM call failed for deal %s", deal_id)
            return AgentResult(
                action_taken="email_generation_failed",
                activity_log="Failed to generate qualification email",
                metadata={"error": True},
            )

        subject = email_data.get("subject", f"Quick question, {contact_name}")
        body = email_data.get("body", "")

        # Send via channel adapter (placeholder -- wired up in main.py)
        email_sent_record: dict[str, Any] | None = None
        try:
            channel = await self._get_channel()
            if channel:
                success = await channel.send_message(
                    to=contact_email,
                    subject=subject,
                    body=body,
                )
                if success:
                    email_sent_record = {
                        "to": contact_email,
                        "subject": subject,
                        "body": body,
                    }
        except Exception:
            logger.exception("[qualifier] Failed to send email for deal %s", deal_id)

        # Determine new stage
        current_stage = deal.get("stage", "")
        new_stage: str | None = None
        if current_stage in ("new_deal", "first_email"):
            new_stage = "qualifying"

        if new_stage:
            try:
                await self._db.update_deal(deal_id, {"stage": new_stage})
            except Exception:
                logger.exception("[qualifier] Failed to update stage for deal %s", deal_id)

        return AgentResult(
            action_taken="email_sent" if email_sent_record else "email_drafted",
            email_sent=email_sent_record,
            stage_change=new_stage,
            activity_log=f"Qualification email to {contact_email}: {subject}",
            metadata={"reasoning": email_data.get("reasoning", "")},
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _summarise_messages(messages: list[dict[str, Any]]) -> str:
        """Create a compact text summary of recent messages."""
        if not messages:
            return "(no conversation history)"
        lines: list[str] = []
        for msg in messages[:10]:
            direction = msg.get("direction", "?")
            snippet = (msg.get("body") or msg.get("content") or "")[:300]
            lines.append(f"[{direction}] {snippet}")
        return "\n".join(lines)

    @staticmethod
    def _parse_email(raw: str) -> dict[str, Any]:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("[qualifier] Could not parse LLM email response as JSON")
            return {"subject": "", "body": raw, "reasoning": ""}

    async def _get_channel(self):
        """Retrieve the configured email channel (lazy import to avoid circular deps)."""
        # Channel is injected at app startup; for now return None if not configured.
        return getattr(self, "_channel", None)
