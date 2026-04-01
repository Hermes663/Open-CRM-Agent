"""Factory for building the configured outbound/inbound email channel."""

from __future__ import annotations

import logging
import os

from autosales.channels.base import BaseChannel
from autosales.channels.gmail import GmailChannel
from autosales.channels.imap_smtp import IMAPSMTPChannel
from autosales.channels.outlook import OutlookChannel

logger = logging.getLogger("autosales.channels.factory")


def build_email_channel() -> BaseChannel | None:
    provider = os.environ.get("EMAIL_PROVIDER", "").strip().lower()
    if not provider:
        logger.warning(
            "[channels] EMAIL_PROVIDER not configured; "
            "agent will run without email sending"
        )
        return None

    if provider == "gmail":
        return GmailChannel()
    if provider == "imap":
        return IMAPSMTPChannel()
    if provider == "outlook":
        return OutlookChannel()

    logger.warning(
        "[channels] Unsupported EMAIL_PROVIDER=%s; "
        "agent will run without email sending",
        provider,
    )
    return None
