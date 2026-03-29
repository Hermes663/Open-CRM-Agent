"""Abstract base for email channel adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


@dataclass
class EmailMessage:
    """Normalised representation of an email message."""

    from_addr: str
    to_addr: str
    subject: str
    body: str
    html_body: Optional[str] = None
    attachments: list[dict[str, Any]] = field(default_factory=list)
    received_at: Optional[datetime] = None
    message_id: Optional[str] = None


class BaseChannel(ABC):
    """Abstract interface that every email channel must implement."""

    @abstractmethod
    async def fetch_new_messages(self) -> list[EmailMessage]:
        """Retrieve unread / new messages from the mailbox.

        Returns:
            List of :class:`EmailMessage` instances.
        """

    @abstractmethod
    async def send_message(
        self,
        to: str,
        subject: str,
        body: str,
        attachments: list[dict[str, Any]] | None = None,
    ) -> bool:
        """Send an email message.

        Args:
            to: Recipient email address.
            subject: Email subject line.
            body: Plain-text body.
            attachments: Optional list of attachment dicts ``{filename, content_bytes}``.

        Returns:
            True on success, False otherwise.
        """

    @abstractmethod
    async def check_health(self) -> bool:
        """Verify that the channel connection is alive.

        Returns:
            True if the channel is operational.
        """
