"""Follow-up agent -- sends escalating follow-up emails after silence."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from autosales.agents.base import AgentContext, AgentResult, BaseAgent
from autosales.channels.base import BaseChannel
from autosales.integrations.supabase_client import SupabaseClient
from autosales.utils.llm import LLMClient
from autosales.utils.templates import EmailTemplateEngine

logger = logging.getLogger("autosales.agents.followup")

MAX_FOLLOWUP_ATTEMPTS = 3

_FOLLOWUP_SYSTEM_PROMPT = """\
You are a B2B sales professional writing a follow-up email.
The prospect has not replied to previous outreach.

Guidelines:
- Attempt {attempt} of {max_attempts}.
- Earlier attempts should be friendly and add value.
- Later attempts should create gentle urgency and offer an easy opt-out.
- Always be respectful and professional.
- Reference something specific from our research or previous emails.

Return ONLY a JSON object:
{{
  "subject": "...",
  "body": "...",
  "tone": "friendly|value-add|urgent"
}}
"""


class FollowupAgent(BaseAgent):
    """Sends follow-up emails with increasing urgency over multiple attempts."""

    def __init__(self, db: SupabaseClient, channel: BaseChannel | None = None) -> None:
        self._db = db
        self._channel = channel
        self._llm = LLMClient()
        self._templates = EmailTemplateEngine()

    @property
    def name(self) -> str:
        return "followup"

    @property
    def description(self) -> str:
        return "Generates and sends escalating follow-up emails"

    async def execute(self, context: AgentContext) -> AgentResult:
        """Send the next follow-up email for a deal.

        Reads the follow_up_queue to determine the current attempt number,
        generates an appropriate email, sends it, and updates the queue.
        """
        deal = context.deal
        customer = context.customer or {}
        deal_id = deal.get("id", "unknown")
        contact_email = customer.get("email") or deal.get("contact_email", "")
        contact_name = customer.get("name") or deal.get("contact_name", "Unknown")

        if not contact_email:
            logger.warning("[followup] No email for deal %s", deal_id)
            return AgentResult(
                action_taken="skipped",
                activity_log="No contact email available",
            )

        # Determine attempt number from metadata / pending followups
        pending = (context.metadata or {}).get("pending_followups", [])
        attempt = max((f.get("attempt", 0) for f in pending), default=0) + 1

        if attempt > MAX_FOLLOWUP_ATTEMPTS:
            logger.info(
                "[followup] Deal %s exhausted all %d attempts",
                deal_id,
                MAX_FOLLOWUP_ATTEMPTS,
            )
            try:
                await self._db.update_deal(deal_id, {"stage": "lost"})
            except Exception:
                logger.exception("[followup] Failed to move deal %s to lost", deal_id)
            return AgentResult(
                action_taken="moved_to_lost",
                stage_change="lost",
                activity_log=f"All {MAX_FOLLOWUP_ATTEMPTS} follow-up attempts exhausted",
            )

        # Build LLM prompt
        system = _FOLLOWUP_SYSTEM_PROMPT.format(
            attempt=attempt, max_attempts=MAX_FOLLOWUP_ATTEMPTS
        )

        conversation_snippets = "\n".join(
            f"[{m.get('direction', '?')}] {(m.get('body') or '')[:200]}"
            for m in context.messages[:5]
        )

        user_message = (
            f"Contact: {contact_name} ({contact_email})\n"
            f"Company: {customer.get('company', deal.get('company_name', 'Unknown'))}\n"
            f"Follow-up attempt: {attempt}/{MAX_FOLLOWUP_ATTEMPTS}\n\n"
            f"--- Previous conversation ---\n{conversation_snippets}\n\n"
            f"--- Brand voice ---\n{context.soul_prompt[:1500]}\n\n"
            "Write the follow-up email."
        )

        try:
            raw = await self._llm.call(
                system_prompt=system,
                user_message=user_message,
                json_mode=True,
            )
            email_data = self._parse_email(raw)
        except Exception:
            logger.exception("[followup] LLM call failed for deal %s", deal_id)
            return AgentResult(
                action_taken="followup_failed",
                activity_log=f"Follow-up #{attempt} generation failed",
                metadata={"error": True, "attempt": attempt},
            )

        subject = email_data.get("subject", f"Following up, {contact_name}")
        body = email_data.get("body", "")

        # Send email
        email_sent_record: dict[str, Any] | None = None
        try:
            channel = getattr(self, "_channel", None)
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
            logger.exception("[followup] Failed to send email for deal %s", deal_id)

        # Update follow-up queue
        try:
            await self._db.upsert_followup(
                deal_id=deal_id,
                attempt=attempt,
                status="sent",
            )
        except Exception:
            logger.exception("[followup] Failed to update follow-up queue for deal %s", deal_id)

        # Update stage if needed
        current_stage = deal.get("stage", "")
        new_stage: str | None = None
        if current_stage != "follow_up":
            new_stage = "follow_up"
            try:
                await self._db.update_deal(
                    deal_id,
                    {"stage": "follow_up", "stage_entered_at": datetime.utcnow()},
                )
            except Exception:
                logger.exception("[followup] Failed to update stage for deal %s", deal_id)

        return AgentResult(
            action_taken="followup_sent" if email_sent_record else "followup_drafted",
            email_sent=email_sent_record,
            stage_change=new_stage,
            activity_log=f"Follow-up #{attempt} to {contact_email}: {subject}",
            metadata={
                "attempt": attempt,
                "tone": email_data.get("tone", ""),
            },
        )

    @staticmethod
    def _parse_email(raw: str) -> dict[str, Any]:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [
                line for line in lines if not line.strip().startswith("```")
            ]
            cleaned = "\n".join(lines)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("[followup] Could not parse LLM response as JSON")
            return {"subject": "", "body": raw, "tone": ""}
