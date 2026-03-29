"""Research agent -- gathers company and contact intelligence before outreach."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from autosales.agents.base import AgentContext, AgentResult, BaseAgent
from autosales.integrations.supabase_client import SupabaseClient
from autosales.utils.llm import LLMClient

logger = logging.getLogger("autosales.agents.research")

# Path to the research prompt template (relative to repo root).
_PROMPT_PATH = Path("agent-config/prompts/research.md")

_DEFAULT_RESEARCH_PROMPT = """\
You are a B2B sales research analyst. Given the company and contact information
below, produce a concise research brief in JSON format.

Return ONLY valid JSON with these keys:
{
  "company_summary": "...",
  "industry": "...",
  "estimated_size": "...",
  "recent_news": ["..."],
  "pain_points": ["..."],
  "decision_makers": [{"name": "...", "title": "...", "relevance": "..."}],
  "recommended_angle": "...",
  "confidence_score": 0.0
}
"""


class ResearchAgent(BaseAgent):
    """Performs pre-outreach research on a prospect company and contact."""

    def __init__(self, db: SupabaseClient) -> None:
        self._db = db
        self._llm = LLMClient()
        self._prompt = self._load_prompt()

    @property
    def name(self) -> str:
        return "research"

    @property
    def description(self) -> str:
        return "Gathers company and contact intelligence before outreach"

    async def execute(self, context: AgentContext) -> AgentResult:
        """Run the research pipeline.

        1. Build a research request from deal + customer data.
        2. Call LLM to produce structured research JSON.
        3. Store research in agent_memory.
        4. Log an activity.
        """
        deal = context.deal
        customer = context.customer or {}
        deal_id = deal.get("id", "unknown")

        company_name = customer.get("company") or deal.get("company_name", "Unknown")
        contact_name = customer.get("name") or deal.get("contact_name", "Unknown")
        contact_email = customer.get("email") or deal.get("email", "")
        website = customer.get("website") or deal.get("website", "")

        user_message = (
            f"Company: {company_name}\n"
            f"Contact: {contact_name}\n"
            f"Email: {contact_email}\n"
            f"Website: {website}\n"
            f"Additional context: {json.dumps(customer, default=str)}"
        )

        logger.info("[research] Researching %s for deal %s", company_name, deal_id)

        try:
            raw_response = await self._llm.call(
                system_prompt=self._prompt,
                user_message=user_message,
                json_mode=True,
            )
            research_data = self._parse_research(raw_response)
        except Exception:
            logger.exception("[research] LLM call failed for deal %s", deal_id)
            return AgentResult(
                action_taken="research_failed",
                activity_log=f"Research failed for {company_name}",
                metadata={"error": True},
            )

        # Persist to agent_memory
        try:
            await self._db.store_memory(
                deal_id=deal_id,
                content=json.dumps(research_data, ensure_ascii=False),
                content_type="research",
            )
        except Exception:
            logger.exception("[research] Failed to store memory for deal %s", deal_id)

        # Update deal stage
        try:
            await self._db.update_deal(deal_id, {"stage": "first_email"})
        except Exception:
            logger.exception("[research] Failed to update deal stage for %s", deal_id)

        return AgentResult(
            action_taken="research_complete",
            stage_change="first_email",
            activity_log=f"Completed research on {company_name}",
            metadata={"research": research_data},
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load_prompt(self) -> str:
        """Load the research prompt from disk, falling back to the default."""
        try:
            return _PROMPT_PATH.read_text(encoding="utf-8")
        except FileNotFoundError:
            logger.debug("[research] Prompt file not found at %s, using default", _PROMPT_PATH)
            return _DEFAULT_RESEARCH_PROMPT

    @staticmethod
    def _parse_research(raw: str) -> dict[str, Any]:
        """Best-effort JSON parse of the LLM response."""
        # Strip markdown code fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("[research] Could not parse LLM response as JSON")
            return {"raw_response": raw}
