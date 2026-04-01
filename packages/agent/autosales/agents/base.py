"""Base classes and data models for all AutoSales agents."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentContext:
    """Everything an agent needs to make a decision and act.

    Assembled by :class:`~autosales.memory.manager.MemoryManager` before each
    agent execution.
    """

    deal: dict[str, Any]
    """The deal record."""

    customer: dict[str, Any] | None = None
    """The associated prospect / customer record."""

    messages: list[dict[str, Any]] = field(default_factory=list)
    """Recent conversation messages (newest first)."""

    memories: list[dict[str, Any]] = field(default_factory=list)
    """Relevant agent_memory entries."""

    soul_prompt: str = ""
    """Contents of SOUL.md -- brand voice / personality directives."""

    knowledge: str = ""
    """Contents of KNOWLEDGE.md -- product / company knowledge base."""

    metadata: dict[str, Any] | None = None
    """Arbitrary extra data passed by the runner (activities, followups, etc.)."""


@dataclass
class AgentResult:
    """Structured output returned by every agent execution."""

    action_taken: str
    """Short label describing what the agent did (e.g. ``email_sent``, ``research_complete``)."""

    email_sent: dict[str, Any] | None = None
    """If an email was sent: ``{to, subject, body, message_id}``."""

    stage_change: str | None = None
    """New stage to transition the deal to, or ``None``."""

    activity_log: str | None = None
    """Human-readable summary for the activity feed."""

    metadata: dict[str, Any] = field(default_factory=dict)
    """Free-form metadata to persist alongside the agent run."""


class BaseAgent(ABC):
    """Abstract base for all AutoSales agents.

    Subclasses must implement :meth:`execute` and provide :attr:`name`
    and :attr:`description`.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Short identifier used in routing (e.g. ``research``)."""

    @property
    @abstractmethod
    def description(self) -> str:
        """One-line description shown in logs and the UI."""

    @abstractmethod
    async def execute(self, context: AgentContext) -> AgentResult:
        """Run the agent's logic and return a structured result.

        Args:
            context: Pre-assembled execution context.

        Returns:
            AgentResult with at least ``action_taken`` populated.
        """
